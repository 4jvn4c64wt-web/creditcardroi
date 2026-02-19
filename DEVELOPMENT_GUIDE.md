# Credit Card Value Tracker — Development Guide

Last updated: February 19, 2026

This document is the single source of context for anyone (human or AI) making changes to the Credit Card Value Tracker codebase. Read the relevant section before touching any code.

---

## Maintaining This Document

**Rule: If you changed _how_ something works or _where_ something lives, update this guide before the work is considered done. If you followed an existing pattern without changing the pattern itself, no update needed.**

### Update the guide when you:

- Add a new card definition file (update the card table in Section 3)
- Add or rename a file (update the File Map in Section 3)
- Add a new function that other code will need to call (update the Function Index in the Appendix)
- Add a new state field (update the State Management table in Section 9)
- Change the data flow or processing pipeline (update Section 4)
- Add special-case logic in `getMultiplier()` for a new card (update Section 6)
- Introduce a new pattern that will be repeated in the future (add a Playbook in Section 14)
- Change how an existing system works (update the relevant section)

### Don't bother updating for:

- Adding merchants to `merchants.js`
- Adding keyword patterns to `classification.js`
- Changing multiplier values or credit amounts in an existing card definition
- Updating CFF quarterly bonus data
- Bug fixes that don't change architecture
- UI tweaks that don't add new sections or functions

### How to update

Edit this file directly. Update the "Last updated" date at the top. Keep entries concise — this is a reference, not a changelog.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [File Map](#3-file-map)
4. [Data Flow](#4-data-flow)
5. [Classification System](#5-classification-system)
6. [Points Calculation](#6-points-calculation)
7. [Credit Detection & Tracking](#7-credit-detection--tracking)
8. [Card Definitions](#8-card-definitions)
9. [State Management](#9-state-management)
10. [Tier System](#10-tier-system)
11. [CSV Parsing](#11-csv-parsing)
12. [UI Rendering](#12-ui-rendering)
13. [Card Scenarios (What-If)](#13-card-scenarios-what-if)
14. [Playbooks: Common Changes](#14-playbooks-common-changes)
15. [Testing](#15-testing)
16. [Design Principles](#16-design-principles)

---

## 1. Product Overview

The Credit Card Value Tracker answers one question: **is each credit card worth its annual fee?**

Users upload CSV transaction exports. The app classifies each transaction, applies the correct card-specific point multiplier, detects statement credits, and produces a net value calculation:

```
Net Value = (points earned × point value) + statement credits used − annual fee
```

Everything runs locally in the browser. Transaction data never leaves the user's machine. The app uses localStorage for persistence.

**Audience:** Credit card optimizers and churners making annual fee renewal decisions. This is a retrospective analysis tool, not a daily spending optimizer.

**Freemium tiers:**
- **Free** (`app.html` → `app.js`): Read-only analysis, 12 months of data
- **Decision Pass** ($5): Unlocks editing for one card for 7 days
- **Pro** (`app-pro.html` → `app-pro.js`): Full editing, 6 years of data, What-If scenarios ($12/year)

---

## 2. Architecture

### High-Level Structure

```
Browser loads HTML page
  → loads card definition scripts (cards/*.js)
  → loads merchants.js, classification.js, csv-parser.js
  → loads app-core.js (all shared business logic + UI)
  → loads tier wrapper (app.js OR app-pro.js)
  → loads tutorial.js
  → tier wrapper calls initCore()
```

All business logic and UI rendering live in `app-core.js`. The tier wrappers (`app.js` and `app-pro.js`) are thin — they set `window.TIER_CONFIG` and add tier-specific event handlers (newsletter popup, upgrade modals for free; license validation for pro). Both call `initCore()` on DOMContentLoaded.

### Module System

There is no bundler. Scripts register onto `window.CardTracker` namespace and are loaded via `<script>` tags in HTML. Constants are aliased to local names at the top of `app-core.js` for convenience:

```
window.CardTracker.cards          → const CARDS
window.CardTracker.merchants      → const KNOWN_MERCHANTS
window.CardTracker.monarchMap     → const MONARCH_MAP
window.CardTracker.classification → CATEGORY_HIERARCHY, CONFIDENCE_ADJUSTMENTS, etc.
window.CardTracker.csvParser      → detectCSVFormat, showColumnMapping, parseCSV, etc.
window.CardTracker.cffQuarterlyData → CFF quarterly bonus history
```

### No Network Calls

The core application makes zero network requests. Fonts are loaded from Google Fonts. Analytics (Cloudflare Web Analytics) are passive. There is no API, no backend, no LLM calls during normal operation.

---

## 3. File Map

### Pages
| File | Purpose |
|------|---------|
| `index.html` | Marketing landing page |
| `app.html` | Free-tier application (loads all scripts) |
| `app-pro.html` | Pro-tier application (identical HTML, different tier wrapper) |
| `demo.html` | Interactive demo with synthetic data |
| `insights.html` | Insights blog index — lists all articles with SEO (Open Graph, Twitter Card, JSON-LD CollectionPage) |
| `insights/*.html` | Individual insight articles (e.g., `bilt-palladium-year-one.html`) |

### Core Logic (loaded by app.html and app-pro.html)
| File | Lines | Purpose |
|------|-------|---------|
| `app-core.js` | ~9,809 | **Everything shared**: utilities, state, tier logic, classification wrappers, points calculation, credit detection, CSV parsing wrappers, all UI rendering, export/import, card config editor, card scenarios, data management, initCore() |
| `app.js` | ~264 | Free-tier wrapper: sets TIER_CONFIG='free', newsletter popup, upgrade modals, Card Scenarios pro gate, calls initCore() |
| `app-pro.js` | ~28 | Pro-tier wrapper: validates license, sets TIER_CONFIG='pro', calls initCore() |

### Data & Classification
| File | Lines | Purpose |
|------|-------|---------|
| `merchants.js` | ~268 | Known merchant → category mapping (KNOWN_MERCHANTS) + Monarch CSV category map |
| `classification.js` | ~824 | Category hierarchy, confidence scoring, keyword/POS/address heuristics, travel classification, main classifyMerchant() |
| `csv-parser.js` | ~705 | Column auto-detection, format detection (Monarch, Chase, Wells Fargo, etc.), column mapping UI, CSV parsing |

### Card Definitions (cards/*.js)
Each file registers one card into `window.CardTracker.cards[cardId]`. Files are named by card ID.

| File | Card |
|------|------|
| `cards/chase-sapphire-reserve.js` | Chase Sapphire Reserve (legacy + current rates) |
| `cards/chase-sapphire-preferred.js` | Chase Sapphire Preferred |
| `cards/chase-freedom-flex.js` | Chase Freedom Flex (quarterly rotating) |
| `cards/chase-freedom-flex-quarters.js` | CFF quarterly bonus history data |
| `cards/chase-freedom-unlimited.js` | Chase Freedom Unlimited |
| `cards/amex-platinum.js` | Amex Platinum |
| `cards/amex-gold.js` | Amex Gold |
| `cards/bilt-blue.js` | Bilt Blue |
| `cards/bilt-obsidian.js` | Bilt Obsidian |
| `cards/bilt-palladium.js` | Bilt Palladium |
| `cards/us-bank-cash-plus.js` | U.S. Bank Cash+ (user-selected quarterly) |
| `cards/capital-one-venture-x.js` | Capital One Venture X |
| `cards/capital-one-venture-rewards.js` | Capital One Venture Rewards |
| `cards/amazon-prime.js` | Amazon Prime Rewards Visa |
| `cards/skip.js` | Skip placeholder (for unmapped cards) |

### Supporting
| File | Purpose |
|------|---------|
| `tutorial.js` (~978 lines) | Help system, guided tour, feature education tooltips |
| `test-csv-parser-v2.js` | CSV parser tests (run with Node) |
| `test-tier-gating.js` | Tier/Decision Pass logic tests (run with Node) |
| `robots.txt`, `sitemap.xml` | SEO — sitemap includes index, insights.html, and individual insight articles |

---

## 4. Data Flow

### Upload → Results Pipeline

```
1. User uploads CSV file
   ↓
2. csv-parser.js: detectCSVFormat() auto-detects columns
   ↓
3. User confirms/adjusts column mapping (showColumnMapping)
   ↓
4. csv-parser.js: parseCSV() extracts raw transactions
   Each raw txn = { id, date, merchant, amount, last4, account, monarchCategory, original }
   ↓
5. Raw transactions merged with savedTransactions (deduplication via content-based IDs)
   ↓
6. User maps last-4 digits → card IDs (showMapping)
   ↓
7. processTransactions() — THE SINGLE SOURCE OF TRUTH
   For each transaction:
   a. Skip detection (payments, transfers, fees — with annual fee extraction)
   b. Check confirmed transactions (user overrides)
   c. classifyMerchant() → { subcategory, confidence, source, reason }
   d. Sibling transaction boost (post-processing confidence)
   e. mapToCardCategory() → maps subcategory to card's earning categories via hierarchy
   f. getMultiplier() → { rate, reason } with full date/card-specific logic
   g. detectCredit() for positive-amount transactions
   h. Calculate points = amount × multiplier × pointValue
   ↓
8. Summary aggregation: group by card → spend, points, credits, annual fee, net value
   ↓
9. renderView() displays results (summary, all transactions, card scenarios)
```

### Key Principle: processTransactions() Is the Only Calculator

All views (summary, transactions, card scenarios) derive from the same `processTransactions()` output. There are no parallel calculation paths. If the number is wrong, the bug is in processTransactions() or the functions it calls.

---

## 5. Classification System

### Three-Layer Architecture

```
Layer 1: Subcategory Detection
  classifyMerchant() → "coffee-shop", "drugstore", "flights-direct", etc.
  
Layer 2: Category Hierarchy Rollup
  mapToCardCategory() walks CATEGORY_HIERARCHY to find what the card actually earns on
  Example: "coffee-shop" → "dining" (because card has dining bonus but not coffee-shop)

Layer 3: Card-Specific Multiplier
  getMultiplier() applies the rate for the resolved category
  Example: dining on CSR → 3x (legacy) or per current rates
```

### Priority Order (in classifyMerchant)

1. **Skip patterns** — payments, transfers, statement balance lines (always filter first)
2. **User-defined merchant rules** — `state.merchantRules[cacheKey]` (user chose this)
3. **Known merchant list** — `KNOWN_MERCHANTS` in merchants.js (hardcoded high-confidence)
4. **Multi-signal heuristics** — CSV category + keyword matching + POS patterns + address patterns
5. **Fallback** — `other` with confidence 0

### Confidence Scoring

Additive system. Each signal adds or subtracts points:

| Signal | Base (CSV present) | Discovery (CSV vague) |
|--------|-------------------|----------------------|
| CSV category maps cleanly | +50 (base) | — |
| Known merchant list | 100 (override) | 100 (override) |
| Keyword match agrees | +10 | +25 |
| POS pattern agrees | +15 | +25 |
| Address pattern agrees | +10 | +25 |
| 2+ heuristics agree | +10 bonus | +10 bonus |
| Signal conflicts | −10 to −15 | — |
| Sibling transactions | +15 each (max +50) | +15 each (max +50) |

**Threshold: 50.** Below this, the transaction is flagged "Needs Review."

### Category Hierarchy (CATEGORY_HIERARCHY)

Defined in `classification.js`. Maps child → parent. Walk upward to find the card's earning category.

```
coffee-shop → dining → null (top-level)
uber-ride → transit → null
hotels-direct → travel → null
cell-phone → utilities → null (but cell-phone is its own earning category on some cards)
```

**Important:** `lyft` is top-level (not under transit) because Chase has a specific Lyft partnership bonus.

### Where to Find Things

| What | File | Search |
|------|------|--------|
| Category hierarchy | classification.js | `CATEGORY_HIERARCHY` |
| Known merchants | merchants.js | `window.CardTracker.merchants` |
| Keyword patterns | classification.js | `SPECIFIC_CATEGORY_KEYWORDS` |
| Keyword exclusions | classification.js | `KEYWORD_EXCLUSIONS` |
| Travel classification | classification.js | `classifyTravel` |
| Online grocery detection | classification.js | `ONLINE_GROCERY_PATTERNS` |
| Main classifier | classification.js | `classifyMerchant` |
| CSV-to-subcategory map | classification.js | `CSV_TO_SUBCATEGORY` |
| Monarch category map | merchants.js | `monarchMap` |
| Confidence thresholds | classification.js | `CONFIDENCE_ADJUSTMENTS` |

---

## 6. Points Calculation

### The One Function: getMultiplier()

`getMultiplier(cardId, category, txnDate, merchantDesc)` → `{ rate, reason }`

This is the single source of truth for "how many points does this card earn on this category." Every view calls it. The `reason` string is the audit trail.

**Location:** `app-core.js` ~line 977

### Special Card Logic (in priority order within getMultiplier)

1. **Cash+ quarterly categories** — User-selected 5% and 2% categories per quarter/year. Walks hierarchy to match.
2. **CFF quarterly rotating categories** — Stored historical data with PayPal December-only handling and merchant-keyword bonuses.
3. **Bilt cards (legacy vs 2.0)** — Before Feb 7, 2026: flat 3x dining, 2x travel, 1x else. After: card-specific rates with rent ratio calculation (housing-only) or Bilt Cash flexible option. **Bilt Cash (4%) is a flat rebate on ALL non-rent spend on any Bilt card. It is completely independent of points/multipliers — do not mix or combine them.** See Section 13 for how Bilt Cash is handled in scenarios.
4. **Chase Lyft partnership** — Date-dependent: CSR had 10x before April 2025, 5x after. CFU had 5x before, 2x after.
5. **CSR legacy rates** — Before Oct 26, 2025: 10x Chase Travel, 3x dining, 3x all travel. After: new rate structure.
6. **Capital One Venture X portal sub-types** — Hotels/rental cars get 10x, flights/other get 5x on Capital One Travel portal.
7. **Amex Platinum portal sub-types** — Hotels/flights get 5x, car rentals/other get 1x on Amex Travel.
8. **Streaming keyword validation** — Cards with `streamingKeywords` only give streaming bonus for approved services.
9. **Standard hierarchy walk** — `getEffectiveCategory()` walks up CATEGORY_HIERARCHY to find the card's best match.

### Annual Fee Calculation

`getEffectiveAnnualFee(cardId, transactions)` handles:
- **Detected fees from transaction data** — Annual fees are detected in `processTransactions()` via a two-step pass: (1) text matching against skip patterns including "annual membership fee", "annual fee", and "membership fee", then (2) amount validation against the card definition's `annualFee` value. Both label and amount must match. When detected, fees appear as a subcategory of spend on the All Transactions page with a point value of 0. The actual amount and date are stored in `state.detectedAnnualFees` and used for the most accurate fee calculation.
- **CSR legacy fee** — $550 before Oct 26, 2025; $795 after.
- **Bilt fee start date** — No fee before Feb 7, 2026 for Obsidian/Palladium.
- **Card definition fallback** — Uses `card.annualFee` if no fee detected in transaction data.

### Card Year vs Calendar Year

Users can toggle between calendar year (Jan–Dec) and card year (anniversary-to-anniversary) for each card. Card year is determined by when the annual fee posts.

Functions: `getCardYearPeriod()`, `calculateCardYearMetrics()`, `getCardYearManualCredits()`, `getCardYearCreditsUsed()`

---

## 7. Credit Detection & Tracking

### How Credits Work

Statement credits are positive-amount transactions (refunds from the bank). The app identifies them by matching merchant/description keywords against each card's credit definitions.

`detectCredit(merchant, originalStatement, cardId, txnId, txnDate)` → `{ name, disabled }` or `null`

**Priority:**
1. Manual override (`state.creditOverrides[txnId]`)
2. Card credit keyword matching (`card.credits[].keywords`)
3. Generic rewards redemption patterns
4. If no match → treated as a refund (points deducted)

### Two Types of Credits

- **Auto-detected** (`manual: false`): Matched by keywords in transaction descriptions. Examples: Global Entry, Uber Cash, DoorDash credits.
- **Manual** (`manual: true`): User marks which months they claimed. Examples: Uber Cash monthly credit (since it may not appear as a distinct line item from every bank).

### Streaming Credits (Custom Sub-UI)

Amex Platinum has a streaming credit that can be Paramount+ or Peacock. This uses `state.streamingCredits` with a per-month service selection. Rendering is inline in the card config editor.

### Credit Implementation Checklist

For **simple credits** (auto-detected or manual): just add the entry to the card's `credits` array in `cards/<card-id>.js`. Everything else is dynamic.

For **credits with custom UI** (like the streaming selector): follow the full checklist in the [Credit Implementation Guide](#credit-implementation-guide-integration) section below.

---

## 8. Card Definitions

Each card file registers into `window.CardTracker.cards` (or `window.CardTracker.cardsList` which auto-registers). A card definition includes:

```javascript
{
  name: 'Chase Sapphire Reserve',        // Full display name
  shortName: 'CSR',                       // Abbreviated name for tables
  annualFee: 795,                         // Current annual fee
  pointValue: 0.018,                      // Default cents per point
  baseRate: 1,                            // Multiplier for uncategorized spend
  categories: ['chase-travel', 'dining', 'flights-direct', 'hotels-direct', 'lyft', ...],
  multipliers: { 'chase-travel': 8, 'flights-direct': 4, 'hotels-direct': 4, 'dining': 3, 'lyft': 5 },
  credits: [
    { name: 'Travel Credit', amount: 300, keywords: ['TRAVEL CREDIT'], manual: false },
    { name: 'Lyft Credit', amount: 120, keywords: [], manual: true }
  ],

  // Optional: legacy support
  legacyCutoffDate: '2025-10-26',
  legacyAnnualFee: 550,
  legacy: { categories: [...], multipliers: {...} },

  // Optional: special flags
  isBilt: true,                           // Enables Bilt-specific logic
  annualFeeStartDate: '2026-02-07',       // Fee didn't exist before this date
  lyftPartnershipStart: '2020-01-12',     // Chase Lyft partnership start

  // Optional: streaming validation
  streamingKeywords: ['netflix', 'spotify', 'hulu', ...],

  // Optional: annual bonus points
  annualBonusPoints: 10000                // Points awarded on card anniversary
}
```

### Adding a New Card

1. Create `cards/<card-id>.js`
2. Register the card object into `window.CardTracker.cards['<card-id>']` (or use the cardsList auto-register pattern if present)
3. Add a `<script src="cards/<card-id>.js"></script>` tag in both `app.html` and `app-pro.html` (before `app-core.js`)
4. If the card has special earning logic (quarterly categories, date-dependent rates, partner bonuses), add handling in `getMultiplier()` in `app-core.js`
5. If the card has a legacy earning structure, add `legacy` object with `categories` and `multipliers`

### Changing Earning Rates

For simple rate changes, just update the `multipliers` object in the card definition file. The rest is automatic.

For **date-dependent rate changes** (like CSR's Oct 2025 transition), you need:
- A cutoff date field on the card definition
- A conditional block in `getMultiplier()` that checks the transaction date
- A legacy section with old rates
- Corresponding logic in `getEffectiveAnnualFee()` if the fee also changed
- Update `getCardCategories()` if the category list changed

---

## 9. State Management

All app state lives in the `state` object (defined ~line 237 of `app-core.js`). State splits into two types:

### Persistent State (survives page reload)

Stored in localStorage with `ccTracker_` prefix. Loaded on page init with `safeLocalStorageGet()`.

| State Key | localStorage Key | Purpose |
|-----------|-----------------|---------|
| `cardMappings` | `ccTracker_cardMappings` | last4 → cardId mapping |
| `merchantCache` | `ccTracker_merchantCache` | Classification cache |
| `customPointValues` | `ccTracker_pointValues` | User-adjusted point valuations |
| `creditOverrides` | `ccTracker_creditOverrides` | Manual credit/refund assignments |
| `disabledCredits` | `ccTracker_disabledCredits` | Credits user turned off |
| `monthlyCredits` | `ccTracker_monthlyCredits` | Manual credit month claims |
| `streamingCredits` | `ccTracker_streamingCredits` | Paramount/Peacock monthly selections |
| `merchantRules` | `ccTracker_merchantRules` | User-created merchant → category rules |
| `confirmedTransactions` | `ccTracker_confirmedTxns` | Single-transaction category confirmations |
| `cashPlusCategories` | `ccTracker_cashPlusCategories` | Cash+ quarterly 5%/2% selections |
| `cffCategories` | `ccTracker_cffCategories` | CFF quarterly data (legacy) |
| `cffPaypalDecemberOnly` | `ccTracker_cffPaypalDecemberOnly` | CFF PayPal December flag by year |
| `biltConfig` | `ccTracker_biltConfig` | Bilt-specific settings per card |
| `customAnnualBonusPoints` | `ccTracker_annualBonusPoints` | User-adjusted anniversary bonus |
| `cardYearToggles` | `ccTracker_cardYearToggles` | Which cards show card year view |
| `columnMappings` | `ccTracker_columnMappings` | Remembered CSV column mappings by shape |
| `savedTransactions` | `ccTracker_transactions` | All raw transactions |
| `decisionPasses` | `ccTracker_decisionPasses` | Active Decision Pass keys |
| `proAccess` | `ccTracker_proAccess` | Pro license key |
| `dpBannersDismissed` | `ccTracker_dpBannersDismissed` | Dismissed upgrade banners |
| `featureEducation` | `ccTracker_featureEducation` | Tracks which feature tutorials have been shown |

### Session State (reset on reload)

| Key | Purpose |
|-----|---------|
| `transactions` | Working copy of raw transactions |
| `results` | Output of processTransactions() |
| `detectedAnnualFees` | Fees found in transaction data |
| `activeView` | Current tab (summary/transactions/cardscenarios) |
| `selectedYear` | Year filter |
| `cardScenarios` | What-If wizard state |

### When Adding New State

If you add a new persistent state field, you must update **all** of these locations (search terms in parentheses):

1. **State initialization** — `let state = {` (~line 237)
2. **Save logic** — wherever the state is modified, add `safeLocalStorageSet()`
3. **Export JSON** — search `version: '1.1'`
4. **Import validation** — search `Validate object types for settings`
5. **Import restore** — search `backup.monthlyCredits` (nearby)
6. **Clear settings** — search `Clear all settings button`
7. **Delete all data** — search `Type DELETE to confirm`

---

## 10. Tier System

### How Tiers Work

`window.TIER_CONFIG` is set by the tier wrapper before `initCore()` runs. Values: `'free'` or `'pro'`.

Decision Passes are per-card temporary upgrades stored in `state.decisionPasses`. They last 7 days.

### Key Functions

| Function | Purpose |
|----------|---------|
| `isCardEditable(cardId, editType)` | Can user edit this card's settings? |
| `hasActiveDecisionPass(cardId)` | Does this card have an active DP? |
| `applyTierDateFiltering(transactions)` | Limit data window by tier |
| `pruneTransactionsForStorage(transactions)` | Trim old data before saving |
| `isNeedsReviewVisible(t, dpLookup)` | Should low-confidence flag show? |

### Special Cases

- Cash+ quarterly category selection is always editable (even on free tier)
- Bilt config (rent settings, reward options) is always editable except for credits and point values
- Export is gated by tier for most cards
- **Card Scenarios tab** is visible in both free and pro tiers. In the free tier, clicking it shows a pro-gating modal (`#cardScenariosProModal`) instead of rendering the feature. The click is intercepted in `app.js` via `stopImmediatePropagation()` before `initCore()` registers its own tab handler.

---

## 11. CSV Parsing

### Column Auto-Detection

`detectCSVFormat(headers, previewRows)` uses a three-pass approach:
1. Exact phrase match within header text
2. Data format inspection (checks actual cell values for date patterns, amounts, etc.)
3. Word-boundary partial match

### Supported Formats

The parser handles Monarch Money, Chase, Amex, Wells Fargo (headerless), and generic CSVs. Format detection is based on column names and data patterns, not bank identification.

### Column Mapping UI

Users always confirm the auto-detected mapping before processing. Previous mappings are remembered by CSV "shape" (sorted header hash) in `state.columnMappings`.

### Key Fields Extracted

| Field | Required | Purpose |
|-------|----------|---------|
| date | Yes | Transaction date |
| merchant/description | Yes | Primary classification input |
| amount | Yes | Dollar amount |
| account/card number | Yes | Last-4 extraction for card mapping |
| category | No | CSV-provided category (used as classification signal) |
| original statement | No | Secondary classification input (often more detailed) |
| account name | No | Display hint during card mapping |

---

## 12. UI Rendering

### Page Structure

The app has several sections that show/hide:
- `uploadSection` — Initial CSV upload zone
- `columnMappingSection` — Column confirmation step
- `mappingSection` — Card number → card mapping
- `resultsSection` — Main results view with a shell topbar, details strip, and tab navigation
- `cardConfigSection` — Per-card configuration editor (not a tab — shown/hidden separately via `showCardConfigEditor()`)

### Shell Tabs

Three tabs in the results view:
- **Summary** (`data-view="summary"`) — Per-card ROI breakdown, credits, net value
- **All Transactions** (`data-view="transactions"`) — Full transaction list with classification details, filters, and drill-down
- **Card Scenarios** (`data-view="cardscenarios"`, `id="cardScenariosTab"`) — What-If wizard (pro-gated in free tier)

### Main Render Functions

| Function | Location (~line) | Purpose |
|----------|-----------------|---------|
| `showMapping()` | 2232 | Card number mapping UI |
| `showCardConfigEditor()` | 2281 | Per-card config (point values, credits, quarterly categories, Bilt settings) |
| `renderCardConfig()` | 2419 | Renders card config content (called inside `showCardConfigEditor()`) |
| `showResults()` | 3350 | Sets up results view, year filter, metrics banner |
| `renderCardScenarios()` | 5252 | What-If calculator wizard |
| `renderDetailSection()` | 6391 | Transaction detail drill-down |
| `renderView(view)` | 7122 | Switches between summary/transactions/cardscenarios tabs |
| `showCreditModal()` | 8279 | Reassign credit/refund classification |
| `showCategoryModal()` | 8359 | Recategorize a transaction |

### Badge Colors

Category badges compare across the user's wallet:
- **Green** — Optimal card for this category (or tied)
- **Yellow** — Good, but a better card exists (within 60% of best)
- **Red** — Another card would earn significantly more

Logic is in `getCategoryBadgeStyle()` (~line 1738).

---

## 13. Card Scenarios (What-If)

The Card Scenarios feature is a multi-step wizard in `app-core.js` (~lines 5252–7100). The tab is visible in both free and pro tiers, but free users see a pro-gating modal instead of the wizard (handled in `app.js`).

### Scenario Types
- **Add a card** — "What if I got card X?"
- **Remove a card** — "What if I cancelled card X?"
- **Swap cards** — "What if I replaced card X with card Y?"

### Calculation Functions

| Function | Purpose |
|----------|---------|
| `calculateOptimizationRate()` | Measures how well user currently routes spend |
| `calculateAddCardValue()` | Projects value of adding a new card |
| `calculateRemoveCardValue()` | Projects loss from cancelling a card |
| `calculateSwapValue()` | Net impact of replacing one card with another |
| `calculateCardScenariosNetImpact()` | Final net impact including credits |

### Bilt Cash in Scenarios

Bilt Cash is a **flat 4% rebate on all non-rent spend on any Bilt card**. It is independent of points. In scenarios, a cap-aware routing algorithm (`computeBiltRouting()`) determines which categories to route to Bilt by sorting categories by sacrifice cost and routing cheapest-sacrifice spend first, up to the rent cap.

**Key concepts:**
- **Sacrifice cost**: `altValuePerDollar - biltBaseValuePerDollar` — the points you give up by routing spend to Bilt instead of the alternative card
- **Rent uplift**: `(0.04 / 3) × 100 × biltPointValue` per dollar — the value of rent points you gain from Bilt Cash earned on that dollar (~$0.024/dollar at PV $0.018)
- **Net benefit**: `rentUpliftPerDollar - sacrificeCost` — if positive, routing to Bilt is worthwhile
- **Rent cap**: Monthly rent × $0.03 monthly Bilt Cash needed → annual Bilt spend cap = `monthlyRent × 0.75 × 12`

### Bilt Rewards (Bilt Cash → Rent Points → Remaining)

Bilt Rewards is displayed as a collapsible section in scenario results, separate from points and credits. **Bilt Cash is CONSUMED to earn rent points — do not double-count them.**

#### How Bilt Cash Works

1. **Earned**: 4% of all non-rent spend on any Bilt card
2. **Redeemed**: You must SPEND Bilt Cash to buy rent points ($3 Bilt Cash = 100 Bilt Points, capped at 1 point per $1 rent)
3. **Remaining**: Earned − Redeemed = leftover cash (counted as value only when plan is NOT 'maximize')

**Total Bilt Rewards = Rent Points Value + Bilt Cash Remaining (if plan ≠ maximize)**

#### Rent Points (Bilt 2.0 Flexible Mode)

Under Bilt 2.0 (effective Feb 7, 2026), rent points require redeeming Bilt Cash:
- **$3 of Bilt Cash = 100 rent points** (i.e. $1 Bilt Cash = 33.33 points)
- Rent points are capped at 1 point per $1 rent per month
- `rentUpliftPerDollar = (0.04 / 3) × 100 × biltPointValue` — always computed dynamically, never hardcoded
- At PV $0.018: uplift = ~$0.024/dollar. Break-even PV is $0.03/point.

#### Cap-Aware Routing Algorithm (`computeBiltRouting()`)

Replaces the old `getBiltBenefitPerDollar()` static approach. The algorithm:

1. **Collect candidates**: Each category has a Bilt option and a non-Bilt alternative
2. **Compute sacrifice cost** per category: `altValuePerDollar - biltBaseValuePerDollar`
3. **Separate into two groups**:
   - `biltWins` (sacrifice ≤ 0): Bilt already wins on pure points → always route to Bilt
   - `altWins` (sacrifice > 0): Alternative card wins on points → route to Bilt only if rent uplift exceeds sacrifice
4. **Sort `altWins` by sacrifice ascending** (cheapest sacrifice first)
5. **Route `altWins` to Bilt** while `netBenefit > 0` AND rent cap not reached
6. **Handle partial splits**: When a category straddles the cap boundary, split the spend
7. **Post-cap**: Pure points comparison; Bilt Cash is tiebreaker only (never overrides a card that wins on points)

**Bilt Cash Plans** (selected in step 2b):
- `'maximize'` (default): Route spend to fill rent cap. Remaining Bilt Cash NOT counted as value.
- `'cash'`: No rent uplift in routing. Bilt Cash acts as tiebreaker ONLY for equal-value cards.
- `'custom'`: User specifies monthly Bilt Cash to redeem. Remaining cash IS counted as value.

Each route result includes a `routeReason` string explaining the routing decision.

#### Step 2b Rent & Plan Prompt

The rent/plan prompt (step 2b) appears whenever **any Bilt card is in the current wallet or involved in the scenario**. Controlled by `scenarioInvolvesBilt()`. It collects:
- Monthly rent amount
- Bilt Cash plan (maximize / keep as cash / custom)
- Custom monthly redemption amount (if custom plan)

#### Display

Bilt scenario results look nearly identical to non-Bilt scenarios. The only additions are a rent points row inside Point Value Change and a Bilt Cash line in the top-level summary.

**Top-level summary (Bilt scenarios):**
```
Credits                                +$XX
Point value change (incl. rent pts)    +$XX  ← collapsible flat table + rent points row
Bilt Cash (kept)          [$input]     +$XX  ← editable input, controls rent points
Annual fee                             -$XX
─────────────────────────
Estimated net impact                   +$XX
```

**Non-Bilt scenarios**: Same structure without Bilt Cash line or rent points row.

**Point Value Change section**: Uses the same flat `renderUnifiedSpendTable()` for all scenarios. For Bilt, appends a single "Rent points (N pts @ $X.XXX)" summary row below the table showing the rent points value delta.

**Bilt Cash input**: Editable number input controlling how much Bilt Cash to keep (not redeemed). The remainder is redeemed for rent points. Capped at `[0, finalBiltCashEarned]`. Defaults: maximize plan → $0, cash plan → full earned amount. On blur/enter, updates rent points and all dependent values.

**Key rendering functions:**
- `renderPointValueContent(prefix, rows, baseTotal, biltImpact, tableId, annualizationFactor)` — flat table + optional rent points row
- `updatePointValueContent(prefix, biltImpact)` — live-updates rent points display
- `_updateBiltCashDisplay(prefix, biltImpact)` — updates Bilt Cash input constraints

#### State Properties

- `wi.biltCashPlan` — `'maximize'` | `'cash'` | `'custom'` (default: `'maximize'`)
- `wi.biltCustomMonthlyRedemption` — Monthly $ of Bilt Cash to redeem (for custom plan)
- `wi.biltCashKeptOverride` — User-set Bilt Cash to keep (from the editable input). When set, overrides plan-based computation. Cleared when plan changes.
- `wi.rentAmount` — Monthly rent amount

#### Calculation (in `calculateCardScenariosNetImpact()`)

The return object includes:
- `pointValueChange` — `spendingImpact + rentPointsValueDelta` (Point Value Change line, includes rent points, excludes Bilt Cash)
- `biltCashKeptDelta` — `finalBiltCashRemaining - currentBiltCashRemaining` (Bilt Cash line, separate from points)
- `spendingImpact` — net value change from card-to-card spend shifts only
- `rentPointsValueDelta` — change in annual rent points value
- `totalImpact` — `pointValueChange + creditsImpact + biltCashKeptDelta + feeImpact`
- `finalBiltCashEarned`, `finalBiltCashRedeemed`, `finalBiltCashRemaining`
- `finalRentPointsAnnual`, `finalRentPointsValue`
- `finalBiltSpend`, `currentBiltSpend`
- `currentBiltCashEarned`, `currentBiltCashRedeemed`, `currentBiltCashRemaining`, `currentRentPointsValue`
- `biltCashPlan`, `countCashAsValue`, `monthlyRent`
- `annualBiltSpendCap`, `rentCapUsedPct`

| Scenario | finalBiltSpend | Impact |
|----------|---------------|--------|
| Remove only Bilt card | 0 | Lose all Bilt Cash + Rent Points |
| Remove Bilt card (another Bilt remains) | Spend routed to remaining Bilt via computeBiltRouting | Partial loss |
| Swap Bilt → Bilt | Routed by computeBiltRouting | Delta based on routing changes |
| Swap Bilt → non-Bilt (no other Bilt) | 0 | Lose all Bilt Cash + Rent Points |
| Swap non-Bilt → Bilt | current + newly routed | Gain Bilt Cash + Rent Points |
| Add Bilt | current + newly routed | Gain Bilt Cash + Rent Points |
| Add non-Bilt (wallet has Bilt) | May decrease if spend shifts away from Bilt | Reduced Bilt Cash |

### Fairness Principle

Both the current and hypothetical wallets must use the same spending assumptions. Applying optimization to only the hypothetical wallet would credit it for fixing existing suboptimal behavior, not just the value of the change itself.

---

## 14. Playbooks: Common Changes

### A. Adding a New Merchant to the Known List

**File:** `merchants.js`

Add an entry to `window.CardTracker.merchants`:
```javascript
'new merchant name': 'category'
```

The key is matched against normalized (lowercase, alphanumeric-only) merchant descriptions. Use the most specific substring that uniquely identifies the merchant.

**Watch for:** Ordering matters when one key is a substring of another (e.g., `uber eats` must come before `uber`). Test with representative transaction descriptions.

### B. Adding/Changing Earning Rates on an Existing Card

**File:** `cards/<card-id>.js`

Update the `multipliers` object and/or `categories` array. If the rate change is date-dependent:

1. Add a cutoff date field to the card definition
2. Add conditional logic in `getMultiplier()` in `app-core.js`
3. Add a `legacy` object if the old rates need to be preserved
4. Test transactions before and after the cutoff date

### C. Adding a Simple Credit

**File:** `cards/<card-id>.js`

Add to the `credits` array:
```javascript
{ name: 'Credit Name', amount: <annual_value>, keywords: ['KEYWORD1', 'KEYWORD2'], manual: false }
```

- `amount` = annual dollar value (e.g., $12.95/mo = 155.40)
- `keywords` = uppercase strings matched against transaction descriptions
- `manual: true` if user must toggle months manually

For simple credits, **that's it**. The UI, ROI calculation, save/load, export/import all work dynamically.

### D. Adding a Credit with Custom Sub-UI

This is the complex case (like the Paramount+/Peacock streaming selector). Follow every step in **both `app.js` AND `app-pro.js`** (if they have parallel UI code) or in `app-core.js` (if shared):

1. Card definition — add credit with custom flag
2. State initialization — add new state field with localStorage persistence
3. Credit UI rendering — add custom sub-section in `renderCardConfig()`
4. Event listeners — add handlers for new interactive elements
5. ROI calculation — update these 5 locations:
   - Summary pre-calc (search: `Pre-calculate totalCredits and netValue`)
   - Credits-used map (search: `Add monthly credits to the map`)
   - Transaction view (search: `Add manual credits - respect year filter`)
   - Card-year manual credits (search: `function getCardYearManualCredits`)
   - Card-year credits-used (search: `function getCardYearCreditsUsed`)
6. Summary credits panel — add line in expanded credits detail
7. Save logic — persist new state to localStorage
8. Export/Import — add to export object, import validation, import restore
9. Clear settings / Delete all — add to both reset paths

### E. Adding a New Card to the App

1. Create `cards/<card-id>.js` with full definition
2. Add `<script>` tag in `app.html` and `app-pro.html` (before `app-core.js`)
3. If card has special logic (quarterly categories, partner bonuses, legacy rates), add to `getMultiplier()`
4. If card has special annual fee logic, add to `getEffectiveAnnualFee()`
5. If card has special category lists by date, add to `getCardCategories()`
6. Add card name to `index.html` supported cards section
7. Test: upload a CSV, map the card, verify multipliers on known merchants

### F. Updating CFF Quarterly Bonus Categories

**File:** `cards/chase-freedom-flex-quarters.js`

Add the new quarter's entry to `window.CardTracker.cffQuarterlyData`:
```javascript
'2026-Q2': [
  { key: 'gas', label: 'Gas Stations', rate: 5 },
  { key: 'home-improvement', label: 'Home Improvement', rate: 5 }
]
```

For quarters with merchant-specific bonuses (like McDonald's), use:
```javascript
{ key: 'dining', label: "McDonald's", rate: 5, merchantKeywords: ['mcdonald'] }
```

For PayPal quarters, include `isPaypal: true` and optionally `decemberOnly: true`.

---

## 15. Testing

### Existing Test Files

- `test-csv-parser-v2.js` — Tests CSV column detection and parsing across formats
- `test-tier-gating.js` — Tests Decision Pass, tier filtering, editability logic

Run with: `node test-csv-parser-v2.js` and `node test-tier-gating.js`

### Manual Testing Checklist

After any change, verify:

**Classification:**
- [ ] Import a CSV → check that known merchants (CVS, Starbucks, Delta) classify correctly
- [ ] Check a specific transaction's classification reason in the transactions table (hover/click category badge)
- [ ] Verify "Needs Review" filter shows only low-confidence transactions

**Points:**
- [ ] Pick a card with known multipliers → verify a dining transaction shows correct rate and reason
- [ ] Check a travel transaction → verify portal vs direct vs OTA classification
- [ ] If date-dependent: test transactions before and after the cutoff date

**Credits:**
- [ ] Verify auto-detected credits appear with correct names
- [ ] Verify manual credits show month checkboxes in card config
- [ ] Toggle a credit off → verify it's excluded from totals
- [ ] Check the summary credits dropdown shows correct breakdown

**Net Value:**
- [ ] Net Value = Points Value + Credits − Annual Fee (verify the math)
- [ ] Year filter: selecting a specific year shows only that year's data
- [ ] "All Years" shows combined totals with fees counted once per card

**Export/Import:**
- [ ] Export JSON → Clear all → Import JSON → verify data restored
- [ ] Export CSV → open in spreadsheet → verify columns and data

### Writing New Tests

For classification changes, the most valuable test is a simple assertion:
```javascript
// Test that CVS classifies as drugstore
const result = classifyMerchant('CVS PHARMACY #1234', 'Shopping', 'chase-sapphire-reserve');
assert(result.subcategory === 'drugstore', 'CVS should be drugstore');
assert(result.confidence === 100, 'CVS should be high confidence (known merchant)');
```

For points calculation:
```javascript
const mult = getMultiplier('chase-sapphire-reserve', 'dining', '2025-06-15');
assert(mult.rate === 3, 'CSR dining should be 3x');
```

---

## 16. Design Principles

These are non-negotiable and should guide every decision:

**Correctness over cleverness.** When unsure, default safely (usually 1x) and explain why in the reason string. Never silently guess.

**One source of truth for points logic.** `getMultiplier()` is the one function. All views must agree because they all call the same function.

**Auditability.** Every transaction carries a `reason` string explaining the multiplier decision and a `classificationReason` explaining the category decision. These are user-visible for trust and debugging.

**Transparency over automation.** Ask the user explicit questions rather than making assumptions. Surface limitations (low confidence, missing data) rather than hiding them.

**Minimize UI changes.** Do not redesign unless requested. Prioritize small, safe edits. When making a functional change, touch the minimum amount of rendering code necessary.

**The smallest safe change.** When fixing a bug or adding a feature, change as few lines as possible. Prefer surgical edits over wholesale rewrites.

**Privacy first.** No data leaves the browser. No network calls for core functionality. localStorage only.

**Evidence-based choices.** Prefer shipping a working solution and gathering real user feedback over speculating about what users might want.

---

## Appendix: Function Index

Quick lookup for the most commonly needed functions in `app-core.js`:

| Function | ~Line | Purpose |
|----------|-------|---------|
| `parseDateString()` | 72 | Unified date parsing (multiple formats) |
| `generateTransactionId()` | 175 | Content-based deduplication IDs |
| `normalize()` | 556 | Lowercase + strip non-alphanumeric |
| `extractLast4()` | 560 | Get last 4 digits from account string |
| `getCardCategories()` | 620 | Valid categories for a card (date-aware) |
| `mapToCardCategory()` | 673 | Map generic category → card's earning category |
| `getPointValue()` | 814 | Get point value (user-customizable) |
| `isBiltCardConfigured()` | 850 | Checks if Bilt card has meaningful config |
| `calculateBiltRentPoints()` | 870 | Bilt 2.0 rent point calculation with spend-ratio tiers |
| `detectBiltRentPayments()` | 932 | Auto-detects or manually matches rent payments |
| `getMultiplier()` | 977 | **THE** multiplier function |
| `getEffectiveAnnualFee()` | 1344 | Annual fee (date/detection-aware) |
| `getCardYearPeriod()` | 1463 | Card anniversary period |
| `calculateCardYearMetrics()` | 1547 | Metrics for a card year window |
| `getCategoryBadgeStyle()` | 1738 | Green/yellow/red badge logic |
| `detectCredit()` | 1797 | Identify statement credits |
| `processTransactions()` | 1871 | **MAIN PIPELINE** — classify, calculate, summarize |
| `showMapping()` | 2232 | Card mapping UI |
| `showCardConfigEditor()` | 2281 | Card config UI |
| `renderCardConfig()` | 2419 | Card config content (inside showCardConfigEditor) |
| `showResults()` | 3350 | Results page setup |
| `calculateOptimizationRate()` | 3517 | Wallet optimization measurement |
| `calculateAddCardValue()` | 3576 | Projects value of adding a new card |
| `calculateRemoveCardValue()` | 3732 | Projects loss from cancelling a card |
| `calculateSwapValue()` | 3901 | Net impact of replacing one card with another |
| `computeBiltRouting()` | 4409 | Cap-aware Bilt routing algorithm (sacrifice-cost sorting, rent cap enforcement) |
| `calculateCardScenariosNetImpact()` | 4880 | Final net impact including credits |
| `renderCardScenarios()` | 5252 | What-If wizard |
| `renderPointValueContent()` | 5728 | Flat table + optional rent points row |
| `updatePointValueContent()` | 5772 | Live-updates rent points display |
| `renderUnifiedSpendTable()` | 5799 | Spend allocation table for all scenario types |
| `renderDetailSection()` | 6391 | Transaction detail drill-down |
| `_updateBiltCashDisplay()` | 6886 | Updates Bilt Cash input constraints |
| `renderView()` | 7122 | Tab switching (summary/transactions/cardscenarios) |
| `showCreditModal()` | 8279 | Reassign credit/refund classification |
| `showCategoryModal()` | 8359 | Transaction recategorization |
| `exportAsJSON()` | 8768 | Full data export |
| `handleFile()` | 8804 | CSV/JSON file upload handler |
| `runProcessing()` | 9137 | Trigger full reprocessing |
| `initCore()` | 9177 | Application initialization |
