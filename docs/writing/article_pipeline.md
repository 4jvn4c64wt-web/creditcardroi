# Article pipeline

Tracker for insights articles. Update when an article moves between stages.

---

## Published

| Date | Slug | Title |
|------|------|-------|
| 2026-05-24 | `amex-gold-vs-chase-sapphire-preferred` | Amex Gold vs. Chase Sapphire Preferred: I Ran the Actual Numbers |
| TBD | `bilt-palladium-year-one` | Bilt Palladium — Year One |
| TBD | `chase-sapphire-cardholders-free-year-whoop-life` | Chase Sapphire Cardholders' Free Year of WHOOP Life |

*(Fill in publication dates by checking git log on the corresponding HTML file in `site/creditcardroi/insights/`.)*

---

## In draft (`_management/drafts/`)

*(empty)*

---

## Queued / Ideas

*(empty)*

---

## How to use this file

- Move an entry from Queued → In draft when work starts. Note the slug.
- Move from In draft → Published when the HTML lands in `site/creditcardroi/insights/` and the sitemap is updated.
- Don't track sub-tasks here. Notion is for that.

## Keeping this file accurate

Update in the same response that moves an article between stages — don't batch it for "later." When the Published table grows past ~30 entries, move the oldest entries (anything more than two years old) to a `## Archive` section at the bottom; that keeps the active part scannable without losing history. Soft length threshold for the whole file: ~150 lines. See `MAINTENANCE.md` for compaction.
