# Card Scenarios Engine — Debugging Guide

Reference for the swap/add/remove scenario calculator in the Credit Card Value Tracker. Captures architecture, the rules the engine enforces, common bug patterns, and the specific traps that have bitten us before.

## Table of Contents

1. [What the Card Scenarios tool does](#1-what-the-card-scenarios-tool-does)
2. [File map](#2-file-map)
3. [Function map — the call graph](#3-function-map--the-call-graph)
4. [The core calculation: `calculateSwapValue`](#4-the-core-calculation-calculateswapvalue)
   - 4.1 Component 1: removed-card redistribution
   - 4.2 Component 2: shifts from other wallet cards
   - 4.3 The routing plugin handoff
5. [The Bilt routing plugin](#5-the-bilt-routing-plugin)
   - 5.1 sacrificeCost and the three buckets
   - 5.2 Steps C, E, F, G
   - 5.3 Why `_sourceCardId` matters
6. [The rules the engine enforces](#6-the-rules-the-engine-enforces)
   - 6.1 Spend only moves when rate differs or rent-motivated
   - 6.2 Equalized PV for routing, real PV for impact
   - 6.3 Refunds offset same-bucket charges
7. [Cross-file contracts](#7-cross-file-contracts)
8. [Common bug patterns we've seen](#8-common-bug-patterns-weve-seen)
   - 8.1 Phantom spend attributed to wrong card
   - 8.2 Rent-uplift rows on tied rates that look like phantom shifts
   - 8.3 PV mismatch causing fake 1x→1x value shifts
   - 8.4 Charges without offsetting refunds inflating spend
9. [Where the UI display can lie](#9-where-the-ui-display-can-lie)
10. [Debugging playbook](#10-debugging-playbook)
11. [Functions I touched but didn't fully migrate](#11-functions-i-touched-but-didnt-fully-migrate)

---

## 1. What the Card Scenarios tool does

Models "what if I swap card A for card B" (also add-only and remove-only). Output: an annualized point-value impact, broken down by subcategory, plus credits delta, fees delta, and (for Bilt) rent uplift.

Three scenario types (`state.cardScenarios.scenarioType`):

- **add** — append a new card to the wallet, route existing spend to it where it earns more.
- **remove** — drop a card, route its spend to whatever card in the remaining wallet earns the most.
- **swap** — combination: remove one card AND add a new one. Two parallel calculations:
  - **Component 1**: the removed card's spend → redistributed across the rest of the hypothetical wallet (including the new card).
  - **Component 2**: existing wallet cards' spend → shifted to the new card where it earns more.

The Component 1 / Component 2 split is critical and most bugs live at their interaction boundary.

---

## 2. File map

| File | Role |
|---|---|
| `site/creditcardroi/app-core.js` | All shared engine logic. ~10K lines. The scenario functions live here. |
| `site/creditcardroi/app-pro.js` | Tiny wrapper (12 lines) that sets `TIER_CONFIG='pro'` and calls `initCore()`. No business logic. |
| `site/creditcardroi/app.js` | Free-tier wrapper. Same idea. |
| `site/creditcardroi/cards/bilt-plugin.js` | Shared Bilt logic. Owns the `computeRouting` algorithm that handles rent-uplift optimization. |
| `site/creditcardroi/cards/bilt-{blue,obsidian,palladium}.js` | Per-card configs that delegate to `biltPlugin`. |
| `site/creditcardroi/cards/*.js` | Other card definitions (CSR, Amex Plat, etc.). Each can optionally provide `scenarioPrompt.computeRouting` to opt into routing optimization. |
| `site/creditcardroi/classification.js` | Maps merchant strings → subcategory (transit, dining, hotels-direct, etc.). |
| `site/creditcardroi/app-pro.html` | What `preview.bat` loads. Lists script tags in order. **`app-pro.js` loads after `app-core.js`** — if you ever wonder which file overrides which. |
| `preview.bat` | Starts `python -m http.server 8787` and opens `app-pro.html`. Files served from disk; no build step. |

---

## 3. Function map — the call graph

UI entry point is `renderCardScenarios()` (around line 4351 in app-core.js). It calls one of three result renderers based on `scenarioType`, which call into the calculation functions:

```
renderCardScenariosStep4
├── renderStep4Add     → calculateAddCardValue           (~line 2889)
├── renderStep4Remove  → calculateRemoveCardImpact       (~line 3035)  // (was `calculateRemoveCardValue` in older code)
└── renderStep4Swap    → calculateSwapValue              (~line 3201)
                          ↓
                          calls bilt-plugin.js computeRouting for routing optimization

calculateCardScenariosNetImpact (~line 4225)
  - master orchestrator called by the UI to get the headline number
  - dispatches to per-scenario calc, then calls the active card's `scenarioPrompt.calculateImpact`
    (Bilt's lives in bilt-plugin.js, computes rent-points delta + Bilt Cash delta)

Helpers:
  getCardScenariosMultiplier (~line 2754)  — rate lookup with plugin hook
  getRoutingPV               (~line ~2750) — returns 0.018 constant for routing decisions
  getPointValue              (~line 983)   — real per-card PV from state.customPointValues
  getActiveCardIds           (~line 4210)  — wallet membership from txn data
  getAnnualizedCardSpend     (~line 3699)  — per-card subcategory totals, annualized
  getCurrentWalletBiltSpend  (~line 3784)  — routing-engine-predicted Bilt spend baseline
  mapToCardCategory          (~line 838)   — generic subcategory → card-specific category
  getAddCardShiftRows        (~line 3870)  — used by "Add" scenario for display rows
  getRemoveCardShiftRows     (~line 4070)  — used by "Remove" scenario for display rows
```

---

## 4. The core calculation: `calculateSwapValue`

Returns `{ removeChange, removeRows, addGain, addRows, totalSpendChange, annualizationFactor, ... }`. The two row arrays drive the displayed table.

### 4.1 Component 1: removed-card redistribution (lines ~3253–3450)

1. Filters all txns where `t.cardId === removeCardId` for the selected year. **Includes credits/refunds** so they offset charges in the same bucket.
2. Iterates txns, builds `removeSpendBuckets[sub] = { spend, sourceRate, sourcePV, sourceValue, bestRouting, bestAlt }` per subcategory.
   - For each subcategory, scans the hypothetical wallet (= active cards minus the removed card plus the added card) to find:
     - `bestRouting`: highest-value routing-capable card (currently only Bilt cards)
     - `bestAlt`: highest-value non-routing card
   - **Selection uses equalized PV** (`mult.rate * getRoutingPV(cid)`), but `entry.val` stores the real-PV value for downstream impact math.
3. Clamps negative bucket spend to 0 (in case refunds exceed charges).
4. Builds `routingCandidates[]` for subs where both routing and alt destinations exist. Equalized PVs are written to `biltPV`/`altPV`; real PVs are stashed on `_realBiltPV`/`_realAltPV`.
5. Calls `routingPlugin.computeRouting(routingCandidates, routingCard, existingRoutingSpend, ctx)` → see §5.
6. Maps each returned route back into a `removeBuckets[sub]` entry with `bestPointValue: destRealPV` (real PV recovered from the candidate's `_realBiltPV`/`_realAltPV`) so the displayed $ impact uses real PVs.
7. Rent (subcategory `'rent'`) is handled separately because only Bilt cards earn on rent.

### 4.2 Component 2: shifts from other wallet cards (lines ~3475–3625)

1. Filters txns to exclude `removeCardId` AND `addCardId` (those are handled by Component 1 or are the new card itself). Includes credits/refunds for offsetting.
2. Builds `addSpendBuckets[sub] = { spend, cardSpend: { cardId → spend } }`. **Crucially split per source card** — earlier versions collapsed all source cards into one bucket and falsely attributed the total to whichever card had the highest rate.
3. Clamps negative spends to 0.
4. **Inner loop iterates `(sub, sourceCard)` pairs**, not just `sub`. For each, decides:
   - Pure rate comparison (no routing involved): if `newRoutingVal > srcRoutingVal`, push a direct row. Strict `>`, no ties.
   - Routing optimization needed: build a candidate with equalized PVs, push to `addRoutingCandidates`.
5. Calls `comp2Plugin.computeRouting(addRoutingCandidates, ...)`.
6. Maps routes back to rows. Two key checks:
   - `matchedCandidates` Set prevents two routes with the same `sub` from matching the same candidate twice.
   - `_sourceCardId` carried on the route disambiguates when multiple sources share a sub.
7. **Belt-and-suspenders guard at row emit**: `if (ratesEqual && !isRentMotivatedRoute) continue;` — even if the plugin returned a tied-rate route to Bilt with no rent motivation, the row is suppressed.

### 4.3 The routing plugin handoff

The plugin (`bilt-plugin.js::computeRouting`) takes candidates and decides per-sub:

- Route to Bilt (returns route with `destCardId === biltCardId`)
- Route to alt (returns route with `destCardId === altCardId`)
- Split into two routes if a cap is reached partway through

app-core then maps each route into a display row. **Routes destined for the alt card produce NO row in Component 2** — that spend isn't shifting to the new card, so it doesn't appear in the table. Only routes destined for `addCardId` produce rows.

---

## 5. The Bilt routing plugin

Lives in `cards/bilt-plugin.js::scenarioPrompt.computeRouting` (around line 896). Implements a sacrifice-cost optimization for rent-uplift routing.

### 5.1 sacrificeCost and the three buckets

For each candidate:
```js
biltBaseVal = biltRate * biltPV
altVal = altRate * altPV
sacrificeCost = altVal - biltBaseVal
```

With equalized routing PVs (both 0.018), this reduces to `(altRate - biltRate) * 0.018`. Sign:

- `sacrificeCost < 0` → **biltWins** bucket (Bilt's rate strictly beats alt's)
- `sacrificeCost > 0` → **altWins** bucket (alt strictly beats Bilt)
- `sacrificeCost === 0` → **tied** bucket (rates equal)

The strict `<` vs `<=` distinction matters. Earlier code used `<=` and routed tied-rate spend to Bilt "for the Bilt Cash tiebreaker" — that violated the rule and inflated the headline.

### 5.2 Steps C, E, F, G

- **Step C** — biltWins → unconditionally route to Bilt.
- **Step E** — altWins → if `rentUpliftPerDollar > sacrificeCost`, route to Bilt within remaining cap. Greedy by cheapest sacrifice first. May split a candidate (some to Bilt, remainder to alt) if cap fills mid-candidate.
- **Step F** — altWins not handled by Step E → route to alt.
- **Step G** — tied → only route to Bilt if cap has room (rent-motivated). Otherwise route to alt (= no movement). Splits if cap fills mid-candidate.

`annualBiltSpendCap = monthlyRent * 0.75 * 12` for `biltCashPlan === 'maximize'`. Set to 0 for `biltCashPlan === 'cash'`. Custom plan caps based on user-specified monthly redemption.

### 5.3 Why `_sourceCardId` matters

Component 2 emits one candidate per `(sub, sourceCard)`. The plugin's `handledSubs` dictionary used to key only by `sub`, which collided when two candidates shared a sub from different sources. Fix: `candidateKey(c) = sub + '|' + (_sourceCardId || '')`. Routes also carry `_sourceCardId` so the app-core route matcher can pair routes to candidates 1:1.

For Component 1, candidates all have the same source (the removed card), so `_sourceCardId` is undefined and `candidateKey` degenerates to `sub + '|'` — backward compatible.

---

## 6. The rules the engine enforces

These are the user-stated invariants. Anything that violates them is a bug.

### 6.1 Spend only moves when rate differs or rent-motivated

Two paths produce a Component 2 row:
1. **Rate diff**: `newRate > srcRate` (strict).
2. **Rent uplift**: Bilt plugin's Step G routes a tied-rate candidate to Bilt because the cap has room. The user counts this as rent-motivated, even though no rate advantage exists — the gain comes from the 4% Bilt Cash funding more rent points.

Belt-and-suspenders at app-core line ~3650:
```js
if (ratesEqual && !isRentMotivatedRoute) continue;
```
Catches any plugin output that violates rule 1.

### 6.2 Equalized PV for routing, real PV for impact

`getRoutingPV(cardId)` always returns `SCENARIO_ROUTING_PV = 0.018`. Used in every `rate * pv` comparison that drives a routing decision. This prevents a card with a slightly lower configured PV (e.g. Amex Plat at $0.016) from being preferred over Bilt at $0.018 purely on PV grounds at tied rates.

`getPointValue(cardId)` returns the user's real configured PV. Used in every `additionalValue` / `valueChange` calculation so the displayed $ impact reflects what the user actually earns.

Each routing candidate carries both: `biltPV`/`altPV` are equalized (the plugin only sees these), `_realBiltPV`/`_realAltPV` (or `_srcRealVal`/`_newRealVal`) carry real PVs for the route-processing step.

### 6.3 Refunds offset same-bucket charges

`removeTxns` and `addTxns` filters used to exclude `isCredit` and `isRefund`. That made gross spend look higher than net spend — a $96 Uber charge offset by a $96 Uber One credit appeared as $96 of transit when net is $0.

Fix: include credits/refunds in the filter, aggregate with `-t.amount` (charges have negative `amount`, so `-amount` is positive; refunds have positive `amount`, so `-amount` is negative and subtracts). Clamp final bucket spend to 0 in case refunds exceed charges in a sub.

This fix is applied in `calculateSwapValue` Component 1 and Component 2 only. **Not yet applied** to `calculateRemoveCardImpact`, `calculateAddCardValue`, `getAddCardShiftRows`, `getRemoveCardShiftRows`, `getAnnualizedCardSpend` — see §11.

---

## 7. Cross-file contracts

The contract between app-core's route processor and the Bilt plugin's `computeRouting`:

**Candidate fields the plugin reads** (from app-core):
- `sub`, `spend`
- `biltCardId`, `biltRate`, `biltPV` (equalized), `biltCat`, `biltName`
- `altCardId`, `altRate`, `altPV` (equalized), `altCat`, `altName`
- `sourceRate`, `sourcePV`
- `_sourceCardId` (new)

**Route fields the plugin returns** (app-core reads):
- `sub`, `spend`
- `destCardId`, `destRate`, `destPV` (equalized), `destCat`, `destName`
- `sourceRate`, `sourcePV`
- `routeReason` (string — used to detect rent motivation via `.includes('Rent uplift')`)
- `_sourceCardId` (new — forwarded from candidate for matcher disambiguation)

**Route processor expects from candidate (kept on `orig`)**:
- `_newCardHasRouting`, `_existingHasRouting`
- `_bestExisting` (object with `cardId`, `name`, `rate`, `pv`, `val`)
- `_displayCardId`, `_displayCardName`, `_displayRate`
- `_newRate`, `_newPV`, `_newCat`
- `_srcRealVal`, `_newRealVal` (Component 2 — real-PV impact precomputed)
- `_realBiltPV`, `_realAltPV` (Component 1 — real-PV recovery for destValue)

Any change to candidate construction in app-core must preserve these. Any change to `computeRouting` must preserve route fields.

---

## 8. Common bug patterns we've seen

### 8.1 Phantom spend attributed to wrong card

**Symptom**: a Component 2 row shows category X with source = card Y, but card Y has no (or little) spend in category X. The spend amount equals the sum across multiple cards.

**Cause**: Component 2's bucket aggregation collapsing all source cards into one bucket per sub, then attributing the total to whichever card had the highest rate × PV.

**Fix**: emit one candidate per `(sub, sourceCard)` pair, with that source card's individual spend. See §4.2 and §5.3.

### 8.2 Rent-uplift rows on tied rates that look like phantom shifts

**Symptom**: a 1x→1x row appears in Component 2 (e.g. `Streaming | Amex Plat 1x → Obsidian 1x | $147 | +$0.30`).

**Cause**: this is actually the Bilt plugin's Step G correctly routing tied-rate spend to Bilt for rent uplift. The `routeReason` will say "Rent uplift on tied rate". The 4% Bilt Cash → rent points → $0.018/pt = $0.024 uplift per dollar is real value.

**Not a bug.** Per the user's stated rule, rent-motivated routing is allowed. Confirm with the console log (add `console.log` at the route processor with `routeReason` to see).

**Cosmetic confusion**: the rate column shows 1x→1x without flagging that the movement is rent-motivated. Adding a small "(rent uplift)" badge on those rows would prevent future confusion.

### 8.3 PV mismatch causing fake 1x→1x value shifts

**Symptom**: 1x→1x rows show positive impact like `+$0.30`, where `impact ≈ spend × 0.002`. The 0.002 is `0.018 - 0.016` = PV difference between destination and source card.

**Cause (historical, now fixed)**: routing decisions used `rate × realPV` for both cards. A card with lower PV (Amex Plat at $0.016) lost ties to one with higher PV ($0.018 Bilt). Even at rate parity, the routing engine "shifted" spend to capture the PV difference.

**Fix**: `getRoutingPV()` returns a constant 0.018 used everywhere routing decisions are made. Real PVs only enter the impact calculation. See §6.2.

### 8.4 Charges without offsetting refunds inflating spend

**Symptom**: Component 2 row's spend is roughly 2x what the source card actually netted in that category. E.g. Amex Plat transit showed $1,134 annualized when the real net was ~$240.

**Cause**: filter excluded `isCredit`/`isRefund`, then summed `Math.abs(t.amount)` over remaining txns. Each charge was counted at face value with no offset.

**Fix**: include credits/refunds in filter, sum `-t.amount` (signed), clamp negatives to 0. See §6.3.

---

## 9. Where the UI display can lie

The "Bilt Cash (non-rent) ? $X of $Y available" line in the swap result is rendered by Bilt's `scenarioPrompt.renderSummaryLines` or similar. **It can show "$0.00 of $0.00 available" even when the plugin's internal `annualBiltSpendCap` is non-zero.**

This bit us hard during one debug session — the UI's $0 cap led me to conclude rent-uplift routing was inactive, when actually it was firing on every tied-rate candidate.

**When debugging cap-related behavior, instrument the plugin directly** rather than trusting the UI. A quick `console.log(annualBiltSpendCap, cumulativeBiltSpend)` inside `computeRouting` will tell the truth.

Not yet fixed because it's cosmetic. The display field name suggests it represents the user's chosen redemption target (`biltCashKeptOverride`?), not the actual routing cap. Worth a future cleanup pass.

---

## 10. Debugging playbook

When a Card Scenarios row looks wrong, ask in order:

1. **Is the row in Component 1 (removed-card source) or Component 2 (other-wallet-card source)?** They have separate code paths and separate bug surfaces. The source card in the row tells you: if it's the removed card → Component 1; otherwise → Component 2.

2. **Verify the raw data**. Pull the JSON export, group `processedTransactions` by `(cardName, subcategory)`, and check the actual net spend for that bucket. Use signed amounts so refunds offset. If the raw data doesn't match the row's spend, you have a bucketing or filter bug. If the raw data does match, the row is mathematically correct given the rules.

3. **For Component 2 specifically**, check if the row is rent-motivated. Add a `console.log` at app-core ~line 3650 that prints `route.routeReason`. If it says "Rent uplift" — not a bug, the routing is by design.

4. **Routing decision vs impact calculation**. If a row shouldn't have moved but did, check the routing path uses `getRoutingPV`. If a row's $ impact is wrong but the movement is correct, check the impact uses real `getPointValue`.

5. **Cache trap**. `preview.bat` serves from disk via `python -m http.server`. If you edit a JS file but reload shows old behavior, check (a) the file actually saved (search for a unique string you added) and (b) browser hard-refresh (Ctrl+Shift+R). I've personally been bit by phantom "stale browser" diagnoses when the issue was actually correct behavior — verify with `console.log` before assuming caching.

6. **Cross-check the plugin output before blaming app-core**. The plugin can return routes that pass through app-core's filters unchanged. Print every route the plugin returns AND every row app-core emits, then diff.

---

## 11. Functions I touched but didn't fully migrate

These functions have the SAME bug patterns (PV mismatch, abs-not-signed spend) but were not patched because they feed Add/Remove scenarios, not Swap, and the user's active scenario was Swap during the debug session. If Add or Remove scenarios produce wrong numbers, these are the suspects:

- `calculateAddCardValue` (~line 2889) — has the PV equalization fix; does NOT have the refund offset fix.
- `calculateRemoveCardImpact` (~line 3035) — has the PV equalization fix; does NOT have the refund offset fix.
- `getAddCardShiftRows` (~line 3870) — has the PV equalization fix; does NOT have the refund offset fix.
- `getRemoveCardShiftRows` (~line 4070) — has the PV equalization fix; does NOT have the refund offset fix.
- `getAnnualizedCardSpend` (~line 3699) — uses `Math.abs(t.amount)`, excludes credits/refunds. Used as a helper by other functions. If patched, the change propagates everywhere — review usages first.

When propagating the refund-offset fix:
1. Drop `!t.isCredit && !t.isRefund` from the filter.
2. Change `Math.abs(t.amount)` to `-t.amount`.
3. Clamp resulting bucket spends to 0.
4. Verify downstream consumers don't break on zero-spend buckets (e.g. the `if (annualizedSpend <= 0) continue` guards already handle this in most places).

---

*Document created during debug session that fixed: phantom-card attribution in Component 2 (split per source), strict-rate-only routing rule in bilt-plugin, equalized routing PV across all scenario functions, refund-offset spend in calculateSwapValue, and the user education that "Rent uplift on tied rate" routing is correct behavior, not a bug.*
