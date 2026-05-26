# Decisions log

A running record of architectural and product calls — what was decided, when, and why.

## Why keep this

When a decision comes up again three months later ("should we add a backend?"), the log answers it without re-running the same analysis. It also keeps a Claude session from quietly relitigating something that was already settled.

## How to log a decision

1. Copy `_template.md` to a new file: `YYYY-MM-DD-short-name.md`.
2. Fill in the four fields.
3. Keep entries short. The point is "what was decided and why" — not a meeting transcript.

## What counts as a decision worth logging

- Anything that changes the *shape* of the codebase (new dependency, new layer, new persistence strategy).
- Product decisions that determine what the app is for (audience, scope, pricing tiers).
- Anything where the obvious answer was rejected. Especially these — future-you needs to know why.

## What doesn't

- Small refactors. Bug fixes. Adding a card or merchant.
- Anything fully captured by a commit message and the DEVELOPMENT_GUIDE.

## Keeping this folder accurate

Individual decision files are immutable once written. If a decision is reversed or superseded, update its `Status` field — do not edit the decision content itself. Reversed/superseded entries can be moved to `_archive/decisions/` during compaction.

This README is the index for the folder. It should stay short (soft threshold ~100 lines). If it grows, the growth probably belongs in individual decision files or in `MAINTENANCE.md`, not here.
