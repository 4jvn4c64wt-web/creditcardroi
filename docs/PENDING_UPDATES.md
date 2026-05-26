# Pending Card File Updates

Items here require a **manual edit on a specific date** because the app has no mechanism to date-bind credit eligibility in advance. Date-binding via plugin hooks only works retrospectively — the hook receives a transaction date and can compare it against a cutoff. Credits are static arrays with no equivalent evaluation point, so future-dated credit changes must be applied by hand when the date arrives.

**Delete each item after completing the update. Delete this file once empty.**

---

## 2026-07-01 — Amex Gold dining credit keyword cleanup

**File:** `site/creditcardroi/cards/amex-gold.js`

**What to do:** Remove `'GOLDBELLY'` and `'WINE.COM'` from the `Dining Credit` keywords array. These partners expire June 30, 2026. Buffalo Wild Wings, Wonder, and Five Guys are already in the list and remain valid.

**Result after edit:**
```js
{ name: 'Dining Credit', amount: 120, keywords: ['DINING CREDIT', 'GRUBHUB', 'SEAMLESS', 'CHEESECAKE FACTORY', 'FIVE GUYS', 'BUFFALO WILD WINGS', 'BWW', 'WONDER'], manual: false, frequency: 'monthly' },
```

---

## 2026-07-01 — Amex Platinum Saks credit removal

**File:** `site/creditcardroi/cards/amex-platinum.js`

**What to do:** Delete the Saks credit entry entirely. The benefit ends June 30, 2026 for existing cardholders (already removed for new cardholders as of March 26, 2026).

**Line to remove:**
```js
// Saks credit discontinued: removed for new cardholders Mar 26 2026; existing cardholders lose it after Jun 30 2026.
{ name: 'Saks', amount: 100, keywords: ['SAKS'], manual: false, frequency: 'semi-annual', endDate: '2026-06-30' },
```
