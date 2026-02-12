# Credit Implementation Guide

Reference checklist for adding or modifying credits, benefits, and point valuations in this codebase. Every change must be mirrored identically in both `app.js` and `app-pro.js`.

---

## Quick Reference: File Locations

| What | Where |
|------|-------|
| Card definitions | `cards/<card-id>.js` |
| Free-tier app logic | `app.js` |
| Pro-tier app logic | `app-pro.js` |
| State initialization | Search: `// Persistent state` (~line 220) |
| Credit UI rendering | Search: `renderCreditRow` (~line 2600) |
| Credit grid building | Search: `Build credits grid HTML` (right after renderCreditRow) |
| Event listeners (month toggles) | Search: `Add event listeners for month claiming` (~line 2830) |
| ROI calc #1: Summary pre-calc | Search: `Pre-calculate totalCredits and netValue` (~line 3270) |
| ROI calc #2: Credits-used map | Search: `Add monthly credits to the map` (~line 3310) |
| ROI calc #3: Transaction view | Search: `Add manual credits - respect year filter` (~line 3830) |
| Card-year manual credits fn | Search: `function getCardYearManualCredits` (~line 1430) |
| Card-year credits-used fn | Search: `function getCardYearCreditsUsed` (~line 1470) |
| Save logic | Search: `Save disabled credits` (~line 5285) |
| Export JSON | Search: `version: '1.1'` (~line 4500) |
| Import validation | Search: `Validate object types for settings` (~line 4665) |
| Import restore | Search: `Restore all state` (~line 4690) |
| Clear settings | Search: `Clear all settings button` (~line 4990) |
| Delete all data | Search: `Type DELETE to confirm` (~line 5250) |
| Summary credits panel (expanded) | Search: `No credits available` (~line 3670) |

---

## A. Adding a Simple Credit (auto-detected or manual)

### 1. Card Definition
**File:** `cards/<card-id>.js`

Add to the `credits` array:
```javascript
{ name: 'Credit Name', amount: <annual_value>, keywords: ['KEYWORD1'], manual: false }
// or for manual:
{ name: 'Credit Name', amount: <annual_value>, keywords: [], manual: true }
```

- `amount` = annual dollar value (e.g., $12.95/mo = 155.40)
- `keywords` = uppercase strings matched against transaction descriptions (auto-detect)
- `manual: true` = user toggles months manually (shows Jan-Dec checkboxes)
- `manual: false` = auto-detected from transaction keywords

### 2. That's It for Simple Credits
The existing code dynamically renders all credits from the card definition. No changes needed in `app.js` or `app-pro.js` for standard credits. The following all work automatically:
- Toggle checkbox (enable/disable)
- Monthly claim toggles (for manual credits)
- ROI calculation
- Card Performance Summary
- Save/load/export/import

---

## B. Changing Point Valuations

### 1. Default Point Value
**File:** `cards/<card-id>.js`

Change the `pointValue` field:
```javascript
pointValue: 0.02  // 2 cents per point
```

### 2. Multiplier Categories
**File:** `cards/<card-id>.js`

Modify the `multipliers` object:
```javascript
multipliers: { 'flights-direct': 5, 'amex-travel': 5, 'dining': 3 }
```

Categories must match keys in the classification system (`classification.js`).

### 3. Base Rate
**File:** `cards/<card-id>.js`
```javascript
baseRate: 1  // 1x on everything else
```

### 4. No app.js/app-pro.js Changes Needed
Point values and multipliers are read dynamically from card definitions.

---

## C. Changing Annual Fee

### 1. Simple Fee Change
**File:** `cards/<card-id>.js`
```javascript
annualFee: 895
```

### 2. Date-Dependent Fee (like CSR legacy rate)
Requires `annualFeeStartDate` and additional logic in app files. Search for `getEffectiveAnnualFee` to see the pattern.

---

## D. Adding a Credit with Custom Sub-UI (like Paramount+/Peacock)

This is the complex case. Follow every step below in BOTH `app.js` AND `app-pro.js`.

### 1. Card Definition
**File:** `cards/<card-id>.js`

Add the parent credit with a custom flag:
```javascript
{ name: 'Parent Credit', amount: 155.40, keywords: [], manual: true, streamingBenefit: true }
```

### 2. State Initialization (both files)
**Search:** `// Persistent state`

Add new state field:
```javascript
newStateField: safeLocalStorageGet('ccTracker_newStateField', {}),
```

### 3. Credit UI Rendering (both files)
**Search:** `Build credits grid HTML`

Add a helper function before the `creditsHtml` line to render the custom sub-section. Then modify the creditsHtml builder to call it:
```javascript
const creditsHtml = card.credits.map(cr => {
  let html = renderCreditRow(cr, selectedCreditYear);
  if (cr.customFlag) {
    html += renderCustomSection(selectedCreditYear);
  }
  return html;
}).join('');
```

### 4. Event Listeners (both files)
**Search:** `Add event listeners for month claiming`

Add event listeners for any new interactive elements right after the existing month-claim listeners.

### 5. ROI Calculation — 5 Places (both files)

Each of these must include the new credit's value:

| # | Search Term | What It Does |
|---|------------|--------------|
| 1 | `Pre-calculate totalCredits and netValue` | Summary table card metrics |
| 2 | `Add monthly credits to the map` | Credits-used breakdown for expanded panel |
| 3 | `Add manual credits - respect year filter` | Transaction view top metrics |
| 4 | `function getCardYearManualCredits` | Card-year-specific total |
| 5 | `function getCardYearCreditsUsed` | Card-year-specific breakdown map |

### 6. Summary Credits Panel (both files)
**Search:** `No credits available`

Add a conditional line for the new credit in the expanded credits detail panel, between the regular credits map and the anniversary bonus section.

### 7. Save Logic (both files)
**Search:** `safeLocalStorageSet('ccTracker_monthlyCredits'`

Add persistence for the new state:
```javascript
safeLocalStorageSet('ccTracker_newStateField', state.newStateField);
```

### 8. Export (both files)
**Search:** `customAnnualBonusPoints: state.customAnnualBonusPoints`

Add the new field to the export object.

### 9. Import Validation (both files)
**Search:** `Validate object types for settings`

Add the new field name to the `objectFields` array.

### 10. Import Restore (both files)
**Search:** `backup.monthlyCredits`

Add restore block:
```javascript
if (backup.newStateField) {
  state.newStateField = backup.newStateField;
  safeLocalStorageSet('ccTracker_newStateField', backup.newStateField);
}
```

### 11. Clear Settings (both files)
**Search:** `Clear all settings button`

Add to state reset: `state.newStateField = {};`
Add to localStorage removal: `localStorage.removeItem('ccTracker_newStateField');`

### 12. Delete All (both files)
**Search:** `Type DELETE to confirm`

Add to state reset: `state.newStateField = {};`
(localStorage removal is automatic — the delete-all path removes all `ccTracker_*` keys.)

---

## E. Verification Checklist

After any change, confirm:

- [ ] `cards/<card-id>.js` updated
- [ ] Change made in `app.js`
- [ ] Identical change made in `app-pro.js`
- [ ] Grep for the feature keyword — count matches in both files (should be equal)
- [ ] If new state: initialization, save, export, import validation, import restore, clear settings, delete all — all updated in both files
- [ ] If new ROI impact: all 5 calculation points updated in both files
- [ ] If new UI: rendering + event listeners added in both files

---

## F. Common Patterns

### Disabling a credit
Credits are disabled by adding their `name` to `state.disabledCredits[cardId]` array. Always check:
```javascript
const isDisabled = (state.disabledCredits[cardId] || []).includes('Credit Name');
```

### Year-specific monthly claims
```javascript
state.monthlyCredits[cardId][creditName][year] = [0, 1, 2]; // Jan, Feb, Mar
```

### Manual credit ROI formula
```
value = claimedMonths.length * (credit.amount / 12)
```

### Legacy array migration
Old data may be `[0,1,2]` instead of `{ 2026: [0,1,2] }`. Always handle both:
```javascript
if (Array.isArray(yearData)) { /* legacy */ }
else if (typeof yearData === 'object') { /* new year-keyed format */ }
```
