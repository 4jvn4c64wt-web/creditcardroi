# Workflows — Credit Card Value Tracker

Recipes for the recurring tasks. Each one says what to read first, the order of operations, and how to verify.

These are deliberately short. The authoritative how-to lives in `site/creditcardroi/DEVELOPMENT_GUIDE__3.md` — these are session-level checklists that point at the right section.

**Keeping this file accurate:** add a recipe when a new task recurs (i.e., it's come up at least twice). Update a recipe when the DEVELOPMENT_GUIDE playbook it points to changes, or when the recipe stops working. Same-response rule: update this file in the same response as the change that prompted the update. Soft length threshold: ~600 lines. See `MAINTENANCE.md` for compaction.

---

## Before any code change

1. Confirm the feature branch. Chris often has two features in flight; never assume.
2. Open `site/creditcardroi/DEVELOPMENT_GUIDE__3.md` and read the section that governs the area you're touching.
3. If the change might be controversial or sprawling, propose the plan first — do not start editing.

## After any code change

1. Update the DEVELOPMENT_GUIDE if the rules of the codebase changed (new file, new pattern, renamed function used elsewhere, new state field, new playbook). Skip if you just followed an existing pattern.
2. Tell Chris: *what changed*, *which files/sections*, *how to test it in the browser* (one or two concrete steps), and *any judgment calls he should sanity-check*.
3. If the change touches points math, label the units and call out the assumptions explicitly.

---

## Recipe: change an earning rate on an existing card

**File:** `site/creditcardroi/cards/<card-id>.js`

For a simple rate bump:
1. Update the `multipliers` object. Done.
2. Test: upload a CSV, find a transaction in the affected category, verify the displayed rate and `reason` string.

For a **date-dependent** rate change:
1. Add a `<cutoff>Date` field to the card definition.
2. Add a `getMultiplier` hook on the card that checks the transaction date and returns legacy rates for dates before the cutoff.
3. Add a `getCategories` hook if the category list also changes.
4. Add a `legacy` object with the old `categories` and `multipliers`.
5. Add `legacyAnnualFee` and/or a `getAnnualFee` hook if the fee also changed.
6. Test transactions on both sides of the cutoff date.

See DEVELOPMENT_GUIDE Section 14 Playbook B.

---

## Recipe: add a new card

1. Create `cards/<card-id>.js`. Use an existing card as a template; match the field shape.
2. Add a `<script src="cards/<card-id>.js"></script>` tag in **both** `app.html` and `app-pro.html`, before `app-core.js`.
3. Special earning logic → `getMultiplier` hook **in the card file**. Do not add card-specific logic to `app-core.js`.
4. Date-dependent categories → `getCategories` hook.
5. Special annual fee logic → `getAnnualFee` hook or `legacyAnnualFee` field.
6. Custom rate display in the recategorization modal → `getDisplayRate` hook.
7. Filtered category list in recategorization modal → `getCategoryFilter` hook.
8. Persistent custom state → declare `pluginState.stateFields`. Do not add fields to the global state object.
9. Add the card name to the supported cards section of `index.html`.
10. Test: upload a CSV, map the card, verify multipliers on known merchants in each category.

See DEVELOPMENT_GUIDE Section 14 Playbook E for the full version.

---

## Recipe: add a known merchant

**File:** `site/creditcardroi/merchants.js`

1. Add an entry to `window.CardTracker.merchants`: `'merchant lowercase normalized': 'category'`.
2. Ordering matters: if one key is a substring of another, the more specific one goes first (e.g., `uber eats` before `uber`).
3. Test: import a CSV with a transaction at that merchant, verify classification and `reason` string.

This is a low-risk change. Does not need a DEVELOPMENT_GUIDE update.

---

## Recipe: a transaction is being misclassified

1. Click the category badge on the transaction in the All Transactions tab. The reason string tells you which signal won.
2. Walk the classification hierarchy in your head (DEVELOPMENT_GUIDE Section 5):
   - Is the merchant in `merchants.js`? Should it be?
   - Are keywords in `classification.js` matching when they shouldn't, or missing when they should?
   - Is the CSV category mapping doing something wrong?
3. **Prefer the most specific fix.** Adding to `merchants.js` is more surgical than changing keyword patterns. Changing one card's `getMultiplier` is more surgical than touching `app-core.js`.
4. If confidence is below threshold, the transaction shows as Needs Review — that's working as intended, not a bug.

---

## Recipe: add a credit (simple case)

**File:** `site/creditcardroi/cards/<card-id>.js`

Add an entry to the `credits` array:
```js
{ name: 'Credit Name', amount: <annual_dollars>, keywords: ['UPPERCASE_KEYWORD'], manual: false }
```

- `amount` is annual value in dollars.
- `manual: true` if the user has to check off each month.
- For monthly credits, compute the annual amount: `monthly × 12`.

For simple credits, that's it. UI, ROI, save/load, export/import are all dynamic.

For credits with custom sub-UI (like the streaming selector): DEVELOPMENT_GUIDE Section 14 Playbook D — there are nine places to update.

---

## Recipe: publish a new insights article

**Read first:** DEVELOPMENT_GUIDE Section 18, `_management/writing/STYLE_GUIDE.md`, `_management/writing/ARTICLE_TEMPLATE.md`.

1. Draft in `_management/drafts/<slug>.md`. Markdown first; iterate on substance and structure there.
2. Run the editing checklist from the style guide (claim stated early? at least one concession-pivot? skimmer test? load-bearing finding in first 200 words?).
3. Convert to HTML using `ARTICLE_TEMPLATE.md` as the skeleton. Match the meta tags, OG tags, JSON-LD structured data, and visual styling of an existing article (e.g., `insights/bilt-palladium-year-one.html`). Ensure the Umami Analytics script is present before `</body>` (see ARTICLE_TEMPLATE.md for the snippet).
4. Save the HTML to `site/creditcardroi/insights/<slug>.html`.
5. Add an entry to `insights.html` (the article index) following the existing pattern.
6. Add the new URL to `site/creditcardroi/sitemap.xml`.
7. Update `_management/writing/article_pipeline.md`: move the article from "in draft" to "published" with the publication date.
8. Local-preview check: double-click `preview.bat`, navigate to insights, verify the article renders, OG image previews correctly, and the index links work.

---

## Recipe: add a data migration

Only needed if you're *changing the structure* of existing persisted data. Adding a brand-new localStorage key does not require a migration.

1. Increment `DATA_VERSION` in `app-core.js`.
2. Add a function to the end of `DATA_MIGRATIONS` (index N = v(N) → v(N+1)).
3. The function reads localStorage, transforms, writes back. Log `[Migration] Running vN → vN+1`.
4. Make it idempotent if possible. Never delete user data.
5. If the migration touches keys re-read during import, add a re-read line in the import migration block.
6. Test three paths: (a) fresh install, (b) existing data at previous version, (c) export from old version → import on new version.

See DEVELOPMENT_GUIDE Section 9 + Section 14 Playbook G.

---

## Recipe: state field that needs to persist

**For card-specific state** (one card or plugin owns it): declare `pluginState.stateFields` on the card. The app auto-initializes it.

**For global state**, you must update all of these (DEVELOPMENT_GUIDE Section 9):
1. State initialization (`let state = {`)
2. Save logic (`safeLocalStorageSet`)
3. Export JSON (search `version: '1.1'`)
4. Import validation
5. Import restore
6. Clear settings button
7. Delete all data
8. Data migration if you changed structure

Missing any of these = silent data loss on export/import or settings reset.

---

## Recipe: when Chris asks "should I add X feature?"

Don't say yes by default. Run it through:

1. Does it serve the one question the app answers (is each card worth its annual fee)?
2. Does it require new infrastructure (backend, API calls, dependencies)? If so, can it be done locally with localStorage instead?
3. Does it duplicate logic already in `app-core.js`, `classification.js`, or the card definitions?
4. Would it cause two views to disagree on the same number? (Hard no — single source of truth principle.)
5. What's the smallest version that tests whether the feature is worth more than this?

Tell him the answer to each. Recommend simpler than what he proposed if simpler is sufficient.
