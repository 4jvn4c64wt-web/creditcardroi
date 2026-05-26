# Article template — Insights pieces

Use this as the structural skeleton for new insights articles. The HTML shell and SEO scaffolding live in `site/creditcardroi/insights/<existing-article>.html` — copy that file, swap content, follow this content structure.

**Keeping this file accurate:** update when the HTML scaffolding in `insights/` changes (new SEO requirement, new structural section in the rendered article, OG image dimensions change, etc.). Old versions of the template go to `_archive/writing/`. Soft length threshold: ~200 lines. See `MAINTENANCE.md` for compaction.

---

## Content structure

### 1. The TL;DR block (above the fold)

Three or four lines, decision-first. State who should do what and why. The skimmer can stop here. The close reader will skip it.

> *Example (good):* "Bilt Palladium is worth keeping if you charge at least ~$2,300/month to it. Below that, the annual fee eats the rewards. My 2025 spend cleared it by $400 — I'm renewing. Here's the math."

### 2. The opening claim (first 200 words)

The load-bearing finding goes here. If the article has a "the thing that's actually true is X" moment, it lives in the first 200 words, not the last 200.

The opening should *stake the position* — see STYLE_GUIDE worked examples for what this looks like vs. filler.

### 3. The body — argument with proof-of-work

Organize around the structure of the argument, not chronologically.

- Use section headers as load-bearing argument beats. A skimmer reading only the headers should be able to reconstruct the conclusion.
- Use the concession-pivot move at least once. Granting the strongest counter-position sharpens the pivot.
- Defer dense tables and full transaction data until *after* the conclusion they support — framed as "here's the underlying work if you want to check it."
- First-principles, not appeals to authority. If a number appears, show where it came from.

### 4. The synthesis (end)

Extract implications. Do not summarize. A reader who got to the bottom should leave with the *consequences* of the finding, not a restated version of it.

Common forms: "What I'll Be Watching," "Why This Matters," "What I'd Do Differently."

---

## HTML scaffolding to copy

Open the most recently published article in `site/creditcardroi/insights/` and copy:

- `<title>`, meta description, canonical URL
- Open Graph tags (og:title, og:description, og:image, og:url)
- Twitter Card tags
- JSON-LD structured data (`@type: Article`, headline, datePublished, author)
- Stylesheet imports
- Page header / footer
- Umami Analytics script (must appear before `</body>` on every page):
  ```html
  <!-- Umami Analytics -->
  <script defer src="https://cloud.umami.is/script.js" data-website-id="00612bf4-1142-4343-8b98-2339353027be"></script>
  ```

Then replace the body content.

---

## Pre-publication checklist

Run the STYLE_GUIDE editing checklist (items 1–14). Then:

- [ ] TL;DR block present at the top
- [ ] Load-bearing finding in the first 200 words
- [ ] At least one concession-pivot
- [ ] Headers carry the argument when read alone
- [ ] Numbers all sourced (units labeled, assumptions stated)
- [ ] No "in conclusion" / "to summarize" / "it is important to note" anywhere
- [ ] No exclamation points
- [ ] Canonical URL set to the final published path
- [ ] OG image exists at the referenced path
- [ ] Umami Analytics script present before `</body>`
- [ ] Article added to `insights.html` index
- [ ] URL added to `sitemap.xml`
- [ ] Local preview check: title, meta tags, body all render correctly
- [ ] `_management/writing/article_pipeline.md` updated
