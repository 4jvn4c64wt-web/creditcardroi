# Claude onboarding — Credit Card Value Tracker

If you're a Claude session opening this project, read this file first. It will save Chris from re-explaining the basics.

---

## The project in three sentences

The Credit Card Value Tracker is a client-side web app that ingests credit card transaction CSVs and tells the user whether each card's annual fee is worth it. Everything runs in the browser — no backend, no API, no LLM calls at runtime. The site is deployed via Cloudflare from a GitHub repo, and the code lives at `site/creditcardroi/`.

## Where to look first

1. **`site/creditcardroi/DEVELOPMENT_GUIDE__3.md`** — the authoritative dev reference. Architecture, file map, data flow, classification system, points calculation, state management, playbooks for common changes. **Read the relevant section before touching code.** Do not duplicate this file; update it directly when the rules of the codebase change.
2. **`_management/WORKFLOWS.md`** — recipes for the recurring tasks. If Chris asks for one of those tasks, follow the recipe.
3. **`_management/writing/STYLE_GUIDE.md`** — required reading before producing or editing any prose for the site or for Chris's voice generally.
4. **`_management/decisions/`** — past architectural calls. Skim before proposing changes that touch architecture.

## Stack (don't relitigate)

- Frontend: vanilla HTML, CSS, JavaScript. **No framework.** Scripts are loaded via plain `<script>` tags onto a `window.CardTracker` namespace. No bundler.
- Hosting: Cloudflare Pages, served from the GitHub repo inside `site/creditcardroi/.git`.
- Local preview: `preview.bat` at the project root opens `index.html` in the default browser. No dev server; no `npm`.
- Data: localStorage only. No backend. The single Gumroad license-verification call is the lone exception.
- Versioning: git, on feature branches. The repo only contains the contents of `site/creditcardroi/`. Anything outside that folder (including `_management/`) is not tracked by the site repo.

## How Chris works

Chris directs and reviews code; he does not write it. When you generate code:

- Use clear comments on non-obvious logic.
- At the end of a change, give him a short list of *what you changed, where, and how to test it in the browser*. He needs to be able to evaluate, not debug.
- Flag any judgment calls you made so he can sanity-check.
- He has no coding background — explain in plain language, not just by showing code.

He pushes back on optimization theater. Before adding any layer (a tool, abstraction, dependency, "best practice"), the burden is on the layer to justify itself for this specific use case. Default to simpler.

## House rules for code changes

These come directly from the project's existing custom instructions and the DEVELOPMENT_GUIDE — they are not negotiable.

1. **Correctness beats cleverness.** When unsure, default safely (usually 1x multiplier) and explain why in the transaction's `reason` string.
2. **One source of truth for points.** All points/multiplier logic flows through `getMultiplier()` in `app-core.js`, which delegates to per-card `getMultiplier` hooks in `cards/<card-id>.js`. Do not add card-specific logic to `app-core.js`. Do not create parallel calculation paths.
3. **Every transaction must have a `reason` string.** This is the audit trail. If you change how a multiplier is decided, update the reason text.
4. **Don't redesign the UI** unless explicitly asked. Default to small, safe edits.
5. **Minimize internet use.** The app is intentionally local-first. No new network calls, no LLM calls at runtime, without an explicit ask from Chris.
6. **Classification hierarchy is fixed**: (1) card-actually-used → (2) travel-channel detection → (3) merchant rules → (4) CSV category fallback → (5) LLM only if confidence is below threshold. Don't reorder.
7. **Ask before implementing if the spec is ambiguous.** Do not guess at architecture decisions.

## Branching workflow

Chris works on feature branches. When making non-trivial changes:

- Confirm which branch you're on before editing. He often has two features in flight.
- Structure proposed changes as logical commits he could review one at a time.
- If a change would produce a sprawling diff, say so *before* generating it.
- Math and finalization deserve extra scrutiny — label units, show the work, call out any assumption (redemption value, transfer ratio, etc.) that would change the conclusion if disputed.

## Don't rebuild what exists

The Card Definition Generator (each `cards/<card-id>.js`) handles earning rules, custom categories, portals, stackable bonuses, date-dependent rates, and plugin hooks. Use it or extend it. Do not create parallel systems for card logic.

The classification system (`classification.js` + `merchants.js`) is the only place for merchant/category logic. Add merchants to `merchants.js`, keyword patterns to `classification.js`. Do not write ad-hoc classifiers elsewhere.

## Writing for the site

If Chris asks for prose — an insights article, landing copy, an email, a tooltip — read `_management/writing/STYLE_GUIDE.md` before drafting. The style guide is not optional; his voice is specific and the failure modes are predictable.

Public-facing pieces have two readers: a skimmer who leaves in 90 seconds and a close reader who wants the work shown. The piece needs to work for both. Pull the conclusion forward; defer the proof-of-work.

## Tone with Chris

- Skip preamble. Show the output, then briefly note tradeoffs or things to verify.
- No hedge-everything legal-memo voice. He gets enough at work.
- Push back when he's wrong. The constructive criticism is the value-add.
- No reframing his request before answering. If he asked for X, give him X, then note if Y would be better.
- No emojis unless he uses one first.

## Quick reference — what's where

| File | What it is |
|------|-----------|
| `site/creditcardroi/DEVELOPMENT_GUIDE__3.md` | Authoritative code reference |
| `site/creditcardroi/index.html` | Landing page |
| `site/creditcardroi/app.html`, `app-pro.html` | Free and Pro app pages |
| `site/creditcardroi/app-core.js` | All shared logic + UI rendering (~9800 lines) |
| `site/creditcardroi/app.js`, `app-pro.js` | Tier wrappers (thin) |
| `site/creditcardroi/classification.js` | Category hierarchy, confidence scoring, classifier |
| `site/creditcardroi/merchants.js` | Known merchant → category mapping |
| `site/creditcardroi/csv-parser.js` | Column detection, format detection, parsing |
| `site/creditcardroi/cards/<card-id>.js` | One card per file |
| `site/creditcardroi/insights/*.html` | Published insights articles |
| `_management/MAINTENANCE.md` | Update triggers + compaction procedure |
| `_management/WORKFLOWS.md` | Recipes for common tasks |
| `_management/writing/STYLE_GUIDE.md` | Voice and structure rules |
| `_management/decisions/` | Why-we-did-it log |

---

## Keeping this file (and the rest of `_management/`) accurate

You — the session reading this — are responsible for keeping these docs in sync with the project. The rule:

> **If you change how something works in the project, or where something lives, update the relevant management doc in the same response as the change.**

Specific triggers for *this* file:

- A new core code file appears in `site/creditcardroi/` that any future session should know about → add it to the Quick Reference table.
- A house rule changes (e.g., a new non-negotiable from Chris, a stack swap) → update the House Rules section.
- A new file is added to `_management/` → add a pointer to it in the Quick Reference table.

The full update-trigger matrix for every doc in `_management/`, along with the compaction procedure for when a doc grows too long, lives in `_management/MAINTENANCE.md`. Read it before making structural changes to the management folder.

**A note on compaction:** management docs that grow past their soft length threshold (defined in MAINTENANCE.md) should be compacted via the three-step procedure there: *split* before *archive* before *summarize*. Do not summarize first. The STYLE_GUIDE is never compacted; only Chris edits that file.
