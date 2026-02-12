# Refactor Prompt: Extract app-core.js from app.js / app-pro.js

## Goal

Refactor this credit card rewards tracking application so that all shared logic lives in a single `app-core.js` file. Currently `app.js` (~6,060 lines) and `app-pro.js` (~5,831 lines) are 95% identical, and every bug fix or feature change must be applied to both files across ~12 sync points. This is unsustainable.

After the refactor:
- **`app-core.js`** — contains ALL shared logic (~5,800 lines of utilities, state, processing, rendering, event handlers, etc.)
- **`app.js`** — thin wrapper (~100-200 lines): sets `TIER_CONFIG = 'free'`, registers free-only UI (upgrade modals, newsletter popup, DP badge), calls `initCore()`
- **`app-pro.js`** — thin wrapper (~50-100 lines): validates Pro license key, sets `TIER_CONFIG = 'pro'`, calls `initCore()`

---

## Architecture

### Script load order (both HTML files)
```
merchants.js → classification.js → csv-parser.js → cards/*.js → app-core.js → [app.js OR app-pro.js] → tutorial.js
```

Both `app.html` and `app-pro.html` must be updated to add `<script src="app-core.js"></script>` before their respective wrapper script. The wrapper scripts (`app.js`, `app-pro.js`) should load AFTER `app-core.js`.

### Core exports from app-core.js

`app-core.js` should expose an initialization function (e.g. `window.initCore(tierConfig)`) and any functions/state that the thin wrappers or `tutorial.js` need access to. Currently `tutorial.js` references these globals from `app.js`/`app-pro.js`: `state`, `CARDS`, `renderView`, `showCardConfigEditor`, `safeJSONParse`, `safeLocalStorageSet`, `safeLocalStorageGet`. These must remain on `window` or be otherwise accessible.

### Tier configuration object

Instead of scattered `if (window.TIER_CONFIG === 'pro')` checks, `app-core.js` should accept a tier config at initialization. The tier config drives all behavioral differences. Design the gating so that `app-core.js` reads from a single `TIER_CONFIG` value (set by the wrapper) and all feature checks reference it.

---

## Complete list of tier-gated features

These are the ONLY behavioral differences between tiers. Everything else is shared code.

### 1. Data date filtering (CHANGED from current behavior)

**Current behavior:** Free = 12 months rolling; Pro = unlimited. Filtering is display-only (all data stored regardless).

**New behavior — filter at STORAGE time, not display time:**

| Tier | Max data window | Mechanism |
|------|----------------|-----------|
| **Free** | 1 year (12 months rolling from today) | Transactions older than 12 months are filtered out BEFORE saving to localStorage |
| **Free + Decision Pass on a card** | 4 years for that specific card; 1 year for all other cards | DP cards get the 4-year window; non-DP cards stay at 12 months |
| **Pro** | 4 years | All transactions older than 4 years are filtered out BEFORE saving to localStorage |

**Implementation:**
- Rename `FREE_DATA_MONTHS = 12` and add `PRO_DATA_MONTHS = 48` (4 years).
- Rewrite `applyTierDateFiltering()` to use the appropriate cutoff based on tier and per-card DP status.
- **CRITICAL CHANGE**: Apply filtering at storage time (during CSV upload/merge AND on page load for existing data), not just at display time. When transactions are saved to `ccTracker_transactions` in localStorage, prune anything outside the window first. This prevents localStorage from growing unbounded.
- On page load, also re-filter stored transactions against the current date window (the window rolls forward daily, so data that was within range yesterday may be out of range today).
- Keep the display-time filtering too as a safety net, but storage-time filtering is the primary mechanism.

### 2. Card editing (`isCardEditable`)

| Tier | Behavior |
|------|----------|
| **Free** | `false` for all cards (no editing) |
| **Free + Decision Pass** | `true` for the specific DP card only |
| **Pro** | `true` for all cards |

This function is already implemented correctly and uses `window.TIER_CONFIG`. It stays in `app-core.js` as-is.

### 3. Card Year toggle (CY button in summary table)

The CY toggle shows when ALL of these are true:
- A specific calendar year is selected (`displayYear` is set)
- The card has `annualFee > 0` AND a detected annual fee with a date (`canShowCardYearToggle(cardId)`)
- The card is editable OR the card is a Bilt card (`isCardEditable(cardId, 'config') || CARDS[cardId]?.isBilt`)

**Per-tier behavior:**
| Tier | CY toggle visible? |
|------|-------------------|
| **Free** | Only for Bilt cards (via the `isBilt` exception). All other cards: hidden. |
| **Free + Decision Pass** | Visible for the DP card + Bilt cards |
| **Pro** | Visible for all qualifying cards |

**Special exceptions:**
- **Bilt cards** (`card.isBilt === true`): Always show CY toggle regardless of tier. This is an explicit carve-out because Bilt has no annual fee in some cases but uses the toggle differently.
- **Cash+ cards**: Never show CY toggle (Cash+ has `annualFee: 0`, so `canShowCardYearToggle` returns `false`). Cash+ has a SEPARATE quarterly category year selector in the card config panel that is always editable (see #5).

The CY toggle code stays in `app-core.js`. The gating already flows through `isCardEditable`.

### 4. Credit customization and point value editing

| Feature | Free | Free + DP | Pro |
|---------|------|-----------|-----|
| Toggle credits on/off | Locked (CSS `pointer-events:none;opacity:0.55`) | Unlocked for DP card | Unlocked for all cards |
| Monthly credit claiming | Locked | Unlocked for DP card | Unlocked for all cards |
| Point value (cpp) editing | Locked (input disabled) | Unlocked for DP card | Unlocked for all cards |
| Annual bonus points editing | Locked | Unlocked for DP card | Unlocked for all cards |
| Streaming benefit picker | Locked | Unlocked for DP card | Unlocked for all cards |
| Credit override per transaction (`showCreditModal`) | Always available (NOT gated) | Always available | Always available |

This gating already flows through `isCardEditable` and the `lockedStyle`/`creditsLockedStyle` CSS in `renderCardConfig()`. It stays in `app-core.js` as-is.

**Special exceptions in card config:**
- **Cash+ quarterly categories**: Always editable for free users. Implemented via `cashPlusEditable = isCashPlus || cardEditable`. The quarterly section bypasses `lockedStyle` when `isCashPlus` is true.
- **Bilt config** (rent day, reward options, Bilt Cash redemption): Always editable for free users. Implemented via `biltEditable = card.isBilt || cardEditable`. But Bilt **credits and point values** remain locked for free users — those use `creditsLockedStyle` / `lockedStyle` which require `isCardEditable`.

### 5. Low-confidence transaction review

| Feature | Free | Pro |
|---------|------|-----|
| Stats footer "N need review" badge | Shown | Shown |
| Warning icon (⚠️) on low-conf transaction rows | Shown | Shown |
| "Needs Review" filter checkbox in Transactions view | Available and functional | Available and functional |
| Auto-popup modal on new upload | **Shown** (changed from current) | Shown |
| Category badge clickable (to recategorize) | **No** — badge renders at 0.7 opacity, no click handler | Yes — clickable, opens `showCategoryModal` |

**CHANGE FROM CURRENT**: The low-confidence review modal auto-popup is currently commented out in app.js (free) with a "COMING SOON" note. **Uncomment it.** Free users should see the modal so they know low-confidence transactions exist. They just can't edit categories (the category badges are non-clickable). The modal text says "You can always find these later in All Transactions → Needs Review filter" which works for both tiers.

**Implementation:** The auto-popup code should live in `app-core.js` and fire unconditionally (when `isNewUpload && lowConfidenceCount > 0 && !state.tourActive`). The editing gate is already handled by `isCardEditable` on the category badges — no additional tier check needed on the modal itself.

### 6. Export data

| Tier | Behavior |
|------|----------|
| **Free** (no DP) | Blocked — shows "Coming Soon" modal |
| **Free + Decision Pass** | Allowed |
| **Pro** | Allowed |

This check (`window.TIER_CONFIG !== 'pro' && getActiveDecisionPasses().length === 0`) stays in `app-core.js`.

### 7. Stats footer badge/copy

| Tier | Badge | Message |
|------|-------|---------|
| **Free** | Amber "BETA" (`background:#f59e0b`) | "This tool is in beta — features may change and bugs may exist. Feedback welcome:" |
| **Pro** | Black "PRO" (`background:#1c1917`) | "Thanks for supporting the tracker! Feedback welcome:" |

This is a small conditional in `showResults()`. It stays in `app-core.js` and checks `TIER_CONFIG`.

### 8. Decision Pass "DP" badge on card rows (summary table)

| Tier | Behavior |
|------|----------|
| **Free** | Shows green "DP" badge next to cards with an active Decision Pass |
| **Pro** | Badge is suppressed (hardcoded to `''`) — all cards already have full access |

This conditional stays in `app-core.js` and checks `TIER_CONFIG`.

### 9. Debug version switcher (internal testing tool)

The version switcher (triggered by typing special confirmation strings in the "clear everything" dialog) has navigation logic that differs based on which page is "home":

| Action | From app.js (free) | From app-pro.js (pro) |
|--------|-------------------|----------------------|
| Switch to DP | `window.location.reload()` | `window.location.href = 'app.html'` |
| Switch to Pro | `window.location.href = 'app-pro.html'` | `window.location.reload()` |
| Switch to Base | `window.location.reload()` | `window.location.href = 'app.html'` |

This logic should stay in `app-core.js`. The navigation target can be determined by checking `TIER_CONFIG`: if the target tier matches the current page, `reload()`; otherwise, `href` to the other page.

---

## What goes in each thin wrapper

### app.js (Free tier wrapper)
```
1. window.TIER_CONFIG = 'free';
2. Call initCore() (or let app-core.js auto-init on DOMContentLoaded)
3. Free-only event handlers and UI:
   a. "Coming Soon" modal handlers (close, backdrop click, email assembly)
   b. DP upgrade link interceptor (delegated click on .dp-upgrade-link → opens Coming Soon modal)
   c. DP banner dismiss buttons (delegated click on .dp-banner-close → persists dismissal)
   d. Upgrade button (#upgradeBtn → opens Coming Soon modal)
   e. Upgrade modal infrastructure (open/close for #upgradeModal, #dpInfoModal, #proInfoModal)
   f. Decision Pass key activation flow (validate key, select card, activate, re-render)
   g. Pro key activation flow (validate key, activate, redirect to app-pro.html)
   h. Newsletter popup system (initNewsletterPopup + showNewsletterPopup)
4. Call initTutorial() — OR this can be in app-core.js since both tiers call it
```

### app-pro.js (Pro tier wrapper)
```
1. window.TIER_CONFIG = 'pro';
2. Pro access guard: check localStorage for ccTracker_proAccess, redirect to app.html if missing
3. Call initCore()
4. Call initTutorial() — OR this can be in app-core.js
```

### Hooks for tier-specific behavior from within app-core.js

`app-core.js` needs to call tier-specific functions at certain points:

1. **`showResults()` in app-core.js** currently calls `showNewsletterPopup()` (free only) and `initFeedbackEmail()`. The newsletter call should be conditional: `if (typeof showNewsletterPopup === 'function') showNewsletterPopup(delay);` — this pattern already exists in the current code and works because the function is only defined in the free wrapper.

2. **`DOMContentLoaded` handler**: The core init should be in `app-core.js`. The free wrapper adds its event handlers before or after `initCore()`. The order matters: `app-core.js` sets up all shared DOM event listeners, then the wrapper adds its tier-specific ones.

---

## Files that need changes

| File | Change |
|------|--------|
| **`app-core.js`** | NEW FILE — extract ~5,800 lines of shared logic from app.js |
| **`app.js`** | REWRITE to ~100-200 line thin wrapper |
| **`app-pro.js`** | REWRITE to ~50-100 line thin wrapper |
| **`app.html`** | Add `<script src="app-core.js"></script>` before `<script src="app.js">` |
| **`app-pro.html`** | Add `<script src="app-core.js"></script>` before `<script src="app-pro.js">` |
| **`tutorial.js`** | No changes needed if globals remain on `window` |
| **`merchants.js`** | No changes |
| **`classification.js`** | No changes |
| **`csv-parser.js`** | No changes |

---

## Data filtering change: Storage-time pruning

This is the most significant behavioral change in the refactor. Currently ALL transactions are stored in localStorage regardless of age, and filtering happens only at render time. After the refactor:

### New storage-time filtering logic

Create a function like `pruneTransactionsForStorage(transactions)`:

```
function pruneTransactionsForStorage(transactions) {
  const now = new Date();
  const isPro = window.TIER_CONFIG === 'pro';
  const dpLookup = getActiveDecisionPassLookup();

  // Pro: 4 years max. Free: 1 year (DP cards: 4 years)
  const proMonths = 48;   // PRO_DATA_MONTHS
  const freeMonths = 12;  // FREE_DATA_MONTHS
  const dpMonths = 48;    // same as pro for DP cards

  const proCutoff = new Date(now.getFullYear(), now.getMonth() - proMonths, now.getDate());
  const freeCutoff = new Date(now.getFullYear(), now.getMonth() - freeMonths, now.getDate());
  const dpCutoff = new Date(now.getFullYear(), now.getMonth() - dpMonths, now.getDate());

  return transactions.filter(t => {
    if (!t.cardId || t.cardId === 'skip') return true;
    const parsed = parseDateString(t.date);
    if (!parsed) return true;

    if (isPro) {
      return parsed.date >= proCutoff;
    }
    // Free tier
    if (dpLookup[t.cardId]) {
      return parsed.date >= dpCutoff;
    }
    return parsed.date >= freeCutoff;
  });
}
```

### Apply at these save points in app-core.js:

1. **After CSV upload/merge** (currently around line 5147-5159 in app.js): After deduping and sorting, call `pruneTransactionsForStorage()` before `safeLocalStorageSet('ccTracker_transactions', ...)`.

2. **On page load** (in `DOMContentLoaded`): After loading `savedTransactions` from localStorage, re-prune against the current date window and re-save if any transactions were removed.

3. **After backup restore**: Prune imported transactions before saving.

### Keep display-time filtering as a safety net

`applyTierDateFiltering()` should still run at render time with the same tier-appropriate cutoffs. This ensures correctness even if storage pruning missed something.

---

## Verification checklist

After the refactor, verify:

- [ ] Free user sees upload section, can upload CSV, sees results with 12-month data window
- [ ] Free user can view (but not edit) low-confidence transactions via Needs Review filter
- [ ] Free user sees the low-confidence review auto-popup modal on new upload
- [ ] Free user cannot click category badges to recategorize (badges render at 0.7 opacity, non-clickable)
- [ ] Free user can always edit Cash+ quarterly categories
- [ ] Free user can always edit Bilt config (rent day, reward options) but NOT Bilt credits or point values
- [ ] Free user sees Bilt CY toggle but not CY toggles for other cards
- [ ] Free user sees "BETA" badge in stats footer
- [ ] Free user sees "Coming Soon" modal for export
- [ ] Free user sees upgrade modals and can activate Decision Pass / Pro keys
- [ ] Free user sees newsletter popup after results load
- [ ] Decision Pass extends one card to 4-year data window + full editing
- [ ] Decision Pass card shows green "DP" badge in summary table
- [ ] Pro user is redirected to app.html if no valid license key in localStorage
- [ ] Pro user sees all data up to 4 years (older data pruned at storage time)
- [ ] Pro user can edit all cards (categories, credits, point values)
- [ ] Pro user sees CY toggle on all qualifying cards (annualFee > 0 + detected fee)
- [ ] Pro user sees "PRO" badge in stats footer
- [ ] Pro user does NOT see upgrade modals, newsletter, or DP badges
- [ ] Pro user can export data without gate
- [ ] Transactions older than the tier-appropriate window are pruned from localStorage on save and page load
- [ ] Debug version switcher works from both tiers
- [ ] tutorial.js still works (all globals accessible)
- [ ] test-csv-parser-v2.js still passes (it doesn't touch app.js, so this should be automatic)

---

## Important: What NOT to change

- Do NOT refactor `merchants.js`, `classification.js`, `csv-parser.js`, or `tutorial.js` — they're fine as-is
- Do NOT change any card definitions in `cards/`
- Do NOT change the HTML structure of modals/sections — only change `<script>` tags
- Do NOT change CSS (all inline styles stay as they are)
- Do NOT add a build step, bundler, or module system — this is a plain `<script>` tag application
- Do NOT rename localStorage keys — users have existing data
- Do NOT change the `showCreditModal` function's ungated behavior — credit overrides per transaction remain available to all tiers
- Preserve all existing functionality exactly. This is a structural refactor + the specific data filtering change described above. No other features should change.
