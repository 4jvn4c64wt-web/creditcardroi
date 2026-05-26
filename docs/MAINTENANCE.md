# Maintenance — keeping _management/ accurate and compact

This file defines two things:

1. **Update triggers** — when each document gets updated, and by whom.
2. **The compaction procedure** — what to do when a document outgrows its job.

A Claude session should read this file once at the start of any work that involves the management folder, and re-read the compaction procedure when invoking it.

---

## Update triggers (the load-bearing rule)

> **If you changed *how* something works in the project, or *where* something lives, update the relevant management doc before the work is considered done. If you followed an existing pattern without changing the pattern itself, no update needed.**

This rule is borrowed from the DEVELOPMENT_GUIDE and applies to every file in `_management/`. Specific triggers per doc:

| Doc | Update when… |
|-----|--------------|
| `CLAUDE_ONBOARDING.md` | The stack changes; the house rules change; a new core file is added that any session should know about. |
| `WORKFLOWS.md` | A recurring task gets a new step, a new playbook is added to the DEVELOPMENT_GUIDE, or a recipe stops working. |
| `writing/STYLE_GUIDE.md` | Only Chris updates this. A session may suggest additions, but should not silently revise voice rules. |
| `writing/ARTICLE_TEMPLATE.md` | The HTML scaffolding in `insights/` changes (new SEO requirement, new structural section, etc.). |
| `writing/article_pipeline.md` | An article moves between Queued / In draft / Published. |
| `decisions/` | A new decision is made (see `decisions/README.md`). |
| `MAINTENANCE.md` (this file) | The compaction procedure changes; a new doc is added to `_management/` and needs a trigger. |

**Sessions should update docs in the same response as the change that prompted the update.** Not at the end of the conversation. Not "next time." The same response.

---

## Length thresholds — when to consider compaction

These are advisory, not hard limits. The point is to catch drift, not to enforce a word count.

| Doc | Soft threshold | What "too long" usually means |
|-----|----------------|------------------------------|
| `CLAUDE_ONBOARDING.md` | ~400 lines | New session reads this top-to-bottom. If it can't, the load is too high. |
| `WORKFLOWS.md` | ~600 lines | Recipes have accumulated past the point where they can be skimmed. |
| `STYLE_GUIDE.md` | n/a | Don't compact. This is canonical. Edits only by Chris. |
| `ARTICLE_TEMPLATE.md` | ~200 lines | The template should be a skeleton, not a manual. |
| `article_pipeline.md` | ~150 lines | Published table getting unwieldy → move oldest entries to an archive table. |
| `decisions/README.md` | ~100 lines | Should stay short. The decisions themselves grow; the index does not. |
| `MAINTENANCE.md` (this file) | ~250 lines | If this file is bloated, something has gone wrong. |

When a doc crosses its threshold, run the compaction procedure below. Crossing the threshold is not an emergency — it's a signal to look.

---

## The compaction procedure

Three steps, in order. Do not jump to the third one.

### Step 1 — Split before summarizing

The most common reason a doc has grown too long is that it now contains material that should be its own file. Before any summarization, look for:

- A workflow that's grown a full sub-procedure → extract to `_management/workflows/<name>.md` and link from `WORKFLOWS.md`.
- An onboarding section that's really a reference → move it to a dedicated reference doc.
- Decisions captured inside another doc → extract to a proper entry in `decisions/`.

**Splitting preserves all detail.** If splitting alone gets the parent file back under threshold, stop here.

### Step 2 — Archive material that's no longer load-bearing

Some content was useful once and isn't anymore. For each candidate section, ask:

- **Will a future session need this?** If the section describes the *current* state and the world has moved on, archive the old version.
- **Is this superseded?** A decision marked "Reversed" or "Superseded by [X]" should move to `_archive/decisions/`.
- **Is the article shipped?** Drafts in `_management/drafts/` should be deleted once their HTML lands in `insights/` — the HTML is the source of truth.

Move archived content to `_management/_archive/<original-path>` rather than deleting. Archive preserves history; deletion loses it. See `_archive/README.md` for conventions.

**Archiving preserves all detail at the cost of one extra hop to find it.** If archiving gets the parent file back under threshold, stop here.

### Step 3 — Summarize only what's left

After splitting and archiving, what remains should all be load-bearing. Summarization at this stage is real lossy compression and should be approached with the same caution as deleting code.

Before summarizing any section:

- **Identify the load-bearing claim.** What does this section make a future reader *do* differently?
- **Identify the supporting detail.** What's there to justify the claim?
- **Compress the supporting detail. Never the claim.**

Bad: "The classification hierarchy has five layers (card-actually-used, travel detection, merchant rules, CSV category, LLM fallback). Confidence scoring is additive with a threshold of 50."

Good: "Classification: 5-layer hierarchy, additive confidence, threshold 50. Full spec in DEVELOPMENT_GUIDE Section 5."

The second version preserves the *operational* content (what to do with it) and offloads the reference content (the details) to the canonical source. This works because the canonical source already exists. **Never compress reference material out of a doc unless a canonical source exists that the doc can point to.**

### Anti-patterns — don't do these

- **Summarizing the *first* time a doc grows.** Try splitting first.
- **Removing examples to save space.** Examples are usually doing more work than the surrounding prose.
- **Compressing the style guide.** It's calibrated to Chris's actual voice; compression breaks the calibration.
- **Deleting "old" sections instead of archiving them.** The reason it's old often matters later.

---

## When to invoke compaction

A session should consider running the compaction procedure when:

- A doc is over its soft threshold and is on the critical path of the current task.
- Chris explicitly asks for it.
- The session has just finished a large change that materially altered what the doc says (e.g., a major refactor that obsoleted half of WORKFLOWS.md).

A session should *not* run compaction:

- Proactively on docs that aren't relevant to the current task. Drive-by edits to docs create churn.
- On `STYLE_GUIDE.md` ever. That file is owned by Chris.
- On `decisions/` files. Individual decisions are immutable once written; their status field handles supersession.

---

## Reporting after a compaction pass

When a session compacts a doc, report to Chris:

1. **Which doc was compacted.**
2. **Which procedure step was used** (split, archive, summarize — usually one of these, sometimes two).
3. **What was moved or removed** (paths or section names — not full content).
4. **What the doc is meant to do *now* that's different from before**, if anything.

A compaction is a change to the project's working memory. Treat it with the same care as a code change to a load-bearing file.
