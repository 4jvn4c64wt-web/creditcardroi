# Agent Playbook — Credit Card Value Tracker

**Purpose:** This document tells Claude *when and how to spin up sub-agents* so work on
creditcardvaluetracker.com is done in parallel, by the right specialist, without dropping
the many side-effects (databases, docs, sitemap, cross-links) that every change drags along.

Read this together with `DEVELOPMENT_GUIDE__3.md` — that guide is the source of truth for
*how the code works*; this file is the source of truth for *who does what*.

---

## Core operating rules

1. **Default to delegation for multi-file tasks.** Any task that touches more than one of
   {card logic, a public page, SEO assets, the Notion databases, the dev guide} should be
   split across the agents below rather than done inline. Single-line fixes do not need an agent.
2. **One orchestrator, many specialists.** The main session acts as the **Orchestrator**: it
   reads the request, picks the agents, runs independent agents *in parallel* (one message,
   multiple `Agent` calls), and runs dependent agents in sequence.
3. **Every code change has a paper trail.** No task is "done" until the **Records Keeper**
   agent has synced the relevant Notion databases and on-repo docs (see the registry below).
   This is the step that is most often forgotten — it is mandatory, not optional.
4. **Respect the smallest-safe-change principle** (Dev Guide §16). Agents make surgical edits,
   not redesigns, unless a redesign was explicitly requested.
5. **Hand off facts, not files.** A sub-agent returns a concise summary (what changed, which
   files, which numbers, what still needs syncing) — the Orchestrator relays only what matters.

---

## The "things that must stay in sync" registry

These are the databases and documents the user means by *"many databases and documents that
need to be updated when changes are made."* Every agent is responsible for flagging which of
these its change touches; the **Records Keeper** is responsible for actually updating them.

**On-repo (this git repo):**
| Artifact | Update when |
|---|---|
| `DEVELOPMENT_GUIDE__3.md` | A new file, card, function, state field, pattern, or analytics event is added (Dev Guide §"Maintaining This Document") |
| `sitemap.xml` | Any new indexable page (extension-less `<loc>`, accurate `<lastmod>`) |
| `robots.txt` | New path that should/shouldn't be crawled |
| `insights.html` / `compare.html` | New article or new comparison page (add to the index/hub) |
| Umami event inventory (Dev Guide §19.4) | A new `umami.track()` call is added |
| `app.html` + `app-pro.html` | A new `cards/*.js` script tag, in both files |

**Notion workspace (the user's dashboards — mirror, not source):**
| Database / page | Update when |
|---|---|
| **Decision Log** | A non-obvious design/architecture decision is made |
| **App Updates & Features** | A user-facing feature ships or changes |
| **Content Marketing Posts** | A new insights/comparison article is published |
| **Productivity Briefings** | A work session of note is completed |
| **SUB tracking / card logic pages** | Earning rates, fees, or credit logic for a card change |

> Note: Notion is Chris's dashboard, *not* Claude's session context — Claude does **not** read
> it at session start (per the workspace's own note). Treat it as a publish target the Records
> Keeper writes to *after* the code change lands.

---

## Agent roster

### 1. Orchestrator (the main session)
- **Role:** Interprets the request, selects agents, runs them in parallel/sequence, integrates
  results, owns the final commit/push to the working branch.
- **Never:** writes feature code itself when a specialist exists; skips the Records Keeper step.

### 2. Compare-Page Builder
- **Role:** Creates a new `<cardA>-vs-<cardB>.html` comparison page (root-level, extension-less
  URL like `/amex-gold-vs-chase-sapphire-preferred`) and registers it in the `compare.html` hub.
- **Must produce:** full `<head>` SEO (unique title 50–60 chars, meta description 140–155,
  canonical **without** `.html`, OG + Twitter tags, `Article`/`CreditCard`/`FAQ` JSON-LD), a
  Key-Takeaway box, query-style H2s, at least one side-by-side math table, author bio, the
  Umami snippet before `</body>`, and `data-umami-event="Go to Tracker"` on tracker CTAs.
- **Hard constraints:** every card number (fee, multiplier, credit) **must match the
  `cards/*.js` definition**; CTA buttons use the multi-state `.cta-btn` white-text rule
  (Dev Guide §18 Step 6). Follows Playbook H structure.
- **Hands off to:** SEO/Crawlability (sitemap + cross-links), Records Keeper (Content Marketing
  Posts), Design Reviewer (mobile/UX pass).

### 3. Card-Module Builder
- **Role:** Adds or edits a card in `cards/<card-id>.js` per Dev Guide §14 Playbook E.
- **Must produce:** the card definition; any needed hooks **in the card file only**
  (`getMultiplier`, `getCategories`, `getAnnualFee`, `getDisplayRate`, `getCategoryFilter`,
  `pluginState.stateFields`) — never edits `app-core.js` for one card; `<script>` tag in
  **both** `app.html` and `app-pro.html`; the card name in the `index.html` supported-cards list.
- **Hands off to:** QA/Test (verify multipliers on a sample CSV), Records Keeper (Dev Guide
  card table §3 + SUB/card-logic Notion pages), Compare-Page Builder if the card will be featured.

### 4. Classification & Merchant
- **Role:** Owns `merchants.js` and `classification.js` — known-merchant mappings, keyword/POS/
  address heuristics, category hierarchy, `classifyMerchant()`.
- **Watch for:** substring ordering (`uber eats` before `uber`); default safely to 1x with a
  `reason` string. Per Dev Guide §"Maintaining This Document", merchant/keyword adds do **not**
  require a dev-guide update.
- **Hands off to:** QA/Test (classification spot-checks).

### 5. Design / Style-Guide Reviewer
- **Role:** Audits any changed page against Dev Guide §16 (Design Principles) and §18 Step 6
  (Mobile & UX): 375px viewport, responsive/scrollable tables, ≥44px CTA height, Key-Takeaway
  visible without scrolling, and the recurring **white CTA text** bug (`.cta-btn:link/:visited/
  :hover/:active`). Enforces visual consistency across all pages (copies rules verbatim rather
  than per-page `!important` patches).
- **Mode:** read + targeted fixes only; never a redesign unless asked.

### 6. SEO / Crawlability
- **Role:** Owns the SEO mandate (Dev Guide §17). Verifies unique title/description, canonical
  + `og:url` + JSON-LD `url` + sitemap `<loc>` + internal links are all **extension-less**
  (`.html` is always a redirect on the host), home links are `href="/"`, JSON-LD validates,
  `sitemap.xml`/`robots.txt` updated, no `noindex`. Confirms the **`SEO Lint` GitHub Action**
  will pass (runs the `grep` audits locally first).
- **Hands off to:** Records Keeper (sitemap/lastmod changes are noted in the dev guide if structural).

### 7. Analytics
- **Role:** Ensures every public page has the Umami snippet (§19.1), CTAs reuse canonical event
  strings (`Go to Tracker`, `See a Demo` — §19.2), programmatic `umami.track()` calls are
  guarded (§19.3) and **appended to the §19.4 inventory in the same edit**.

### 8. QA / Test
- **Role:** Runs `node test-csv-parser-v2.js` and `node test-tier-gating.js`; walks the manual
  testing checklist (Dev Guide §15) — import a CSV, verify known merchants classify, check
  multipliers, "Needs Review" filter, export/import round-trip. Reports pass/fail honestly with
  output; does not declare green on a failure.

### 9. Records Keeper  *(the always-run closer)*
- **Role:** After code lands, updates the **on-repo docs** (dev guide tables, sitemap, insights/
  compare index, Umami inventory) and the **Notion databases** (Decision Log, App Updates &
  Features, Content Marketing Posts, card-logic/SUB pages) per the sync registry above.
- **Rule:** the Orchestrator does not consider any task complete until this agent has run and
  reported which artifacts it touched (or confirmed none applied).

---

## Task → agent assignments

### A. "Create a new compare page" (e.g., Card A vs. Card B)
Run in this order (some steps parallel):
1. **Card-Module Builder** (or Classification) *only if* a featured card isn't defined yet — confirm both cards exist in `cards/*.js` and pull their exact numbers.
2. **Compare-Page Builder** — build `/<a>-vs-<b>.html` from Playbook H, numbers sourced from step 1.
3. *(parallel)* **SEO/Crawlability** — sitemap `<loc>` + `<lastmod>`, cross-link from ≥2 existing pages, register in `compare.html`; **Analytics** — Umami snippet + `Go to Tracker` events; **Design Reviewer** — mobile/CTA pass.
4. **QA/Test** — confirm the page's cited math matches the card definitions.
5. **Records Keeper** — Content Marketing Posts (Notion) + dev guide if a new pattern/asset was introduced.

### B. "Add a new card module"
1. **Card-Module Builder** — `cards/<id>.js`, hooks in-file, script tags in `app.html` + `app-pro.html`, `index.html` supported-cards entry (Playbook E).
2. **QA/Test** — upload a sample CSV, verify multipliers/credits on known merchants.
3. *(if rates/credits are novel)* **Classification & Merchant** — add any merchants the card's bonus categories depend on.
4. **Records Keeper** — dev guide §3 card table + Function Index if a shared helper was added; Notion card-logic/SUB pages.

### C. "Check the style / design guide"
1. **Design Reviewer** — audit the target page(s) against §16 + §18 Step 6 (CTA color, 375px, table overflow, tap targets, consistency).
2. *(parallel)* **SEO/Crawlability** — confirm no canonical/extension-less regressions; **Analytics** — confirm Umami snippet + event strings present.
3. **Records Keeper** — log any pattern decisions in Decision Log only if a *new* rule was set.

### D. "General update to the website"
1. **Orchestrator** classifies the change (logic vs. content vs. SEO vs. design) and fans out to the matching specialists in parallel.
2. The touched specialists make surgical edits.
3. **QA/Test** runs the relevant tests/checklist.
4. **SEO/Crawlability** runs the lint audits so the `SEO Lint` Action passes.
5. **Records Keeper** closes the loop across the sync registry (this is where "many databases and documents" get updated).

---

## Parallel vs. sequential

- **Parallel** (independent — dispatch in a single message): SEO + Analytics + Design Reviewer
  passes on a finished page; QA/Test reads while docs are drafted.
- **Sequential** (data dependency): Card-Module Builder → QA/Test (needs the card to exist);
  Compare-Page Builder → SEO/Crawlability (needs the file before sitemap/cross-links);
  *everything* → Records Keeper (runs last, after the code is final).
