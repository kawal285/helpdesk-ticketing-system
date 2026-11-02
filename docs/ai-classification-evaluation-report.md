# Ticket classification evaluation (issue #87)

Criterion 4 of #87 asks to compare AI category/priority predictions
against manually labelled tickets and record the results. Run against
the live pipeline via `node scripts/ai/evaluate-classification.js`,
using `getAiSuggestions()` — the exact function `ticket.controller.js`
calls on real ticket creation. Raw, unedited output for every ticket is
in [ai-classification-evaluation-raw.json](./ai-classification-evaluation-raw.json)
(overwritten by each run — this report quotes the 2026-11-03 numbers).

## Method

20 realistic ticket descriptions
(`tests/classification/ticket-classification-evaluation-set.json`),
spanning all five categories and all five priorities, each hand-labelled
with the expected category and priority *before* the run, plus a
reasoning note explaining the call against this project's own agreed
priority criteria (the P1–P5 business-day definitions already shown to
users in the ticket form).

## Current result (2026-11-03): category is solid, priority needs work

**Category accuracy: 90.0% (18/20). Priority accuracy: 55.0% (11/20).**

This is a real measurement now — see "What changed" below for why the
first run (2026-10-27) couldn't produce one at all.

### Category: one real miss, one defensible one

| Expected → Predicted | Count |
| --- | --- |
| (all correct pairs) | 18 |
| Hardware → Other | 1 |
| Other → Software | 1 |

- **Hardware → Other** (#9, "my keyboard is missing the 'E' key cap...
  still types fine"): a defensible miss — it's a borderline cosmetic
  case, and the labelled reasoning for this item already flags it as
  minor/non-blocking.
- **Other → Software** (#20, "can't find the setting to change my
  display language in the student portal"): a real miss. This is a
  how-to question about a software system, not a software *fault*, and
  the model picked the system mentioned (software) over the actual
  nature of the request (a question, not a problem) — `Other`'s only
  representative in the set, so this single miss is 100% of that
  category's error rate. Worth watching once more `Other`-category
  examples exist to label.

### Priority: a real, systematic pattern, not noise

| Expected → Predicted | Count |
| --- | --- |
| Medium → Medium | 6 |
| Trivial → Low | 3 |
| High → Critical | 2 |
| High → Medium | 2 |
| Low → Low | 2 |
| Critical → Critical | 2 |
| High → Low | 1 |
| High → High | 1 |
| Critical → Low | 1 |

Two clear patterns, not scattered randomness:

1. **Every single "Trivial" case (3/3) came back "Low."** The model
   never once used the bottom tier in this run. Worth checking whether
   `ticketPrompt.js` gives the model enough to distinguish "minor
   annoyance" (Low) from "not actually a problem, no urgency" (Trivial)
   — the current prompt (see `src/prompts/ticketPrompt.js`) names the
   five levels but doesn't define them, unlike the agreed P1–P5
   criteria already shown to users in the ticket form itself.
2. **"High" is the least reliable prediction (1/6 correct)**, scattered
   across Critical (2), Medium (2), Low (1), and High (1) — this is the
   tier *between* "has a workaround" and "this is an outage/safety/
   security issue," and the model doesn't appear to have a consistent
   read on where that line sits either direction.

Category confusion stayed within one or two steps of the real pattern;
priority confusion crosses multiple tiers (Critical → Low is a 3-tier
miss), which matters more in practice — a wrongly-Low ticket that should
have been High or Critical is the failure mode that actually hurts a
help desk.

## What changed since the first run

The first run (2026-10-27) scored 0%/0% with AI unavailable on 20/20 —
not a model-accuracy finding, but `GEMINI_API_KEY` being an invalid
credential (`401`, wrong token type). That run's full writeup is
preserved in git history (see `ed8bd6b`) rather than deleted here.

Since then, a teammate (Ramandeep) rewrote `aiAnalysisService.js` to go
through the same local Ollama generation provider the RAG assistant
already uses (`src/services/rag/generationService.js`), instead of
calling Gemini directly — removing the Gemini/API-key dependency for
ticket classification entirely. `aiService.js`'s timeout was also raised
from 8s to 20s (configurable via `AI_TIMEOUT_MS`) to allow for a local
model's cold-load time, and its own comment now explicitly credits the
original finding: *"This wrapper previously swallowed failures in
silence, so a broken API key looked exactly like a working classifier
from the outside -- tickets were being filed with default categories for
weeks before anyone noticed."* The fix landed on `main` via the
`rag-knowledge-base` branch merge; re-run here on `main` after merging
`backend-harpreet` into it.

While testing this change, found and fixed a related issue in the same
commit this report's results come from: `ticket.controller.js` was
awaiting `getAiSuggestions()` and the newly-added `detectEmotion()`
(emotion-detection feature, also merged from a teammate's branch)
sequentially rather than concurrently, measured at 12+ seconds per
ticket creation live, worst case 68s. Fixed to run both with
`Promise.all` — see commit `41607e3`.

## What's needed next

- **Priority, not category, is where effort should go.** Consider
  adding the P1–P5 business-day definitions (already user-facing in the
  ticket form) directly into `ticketPrompt.js`, so the model has the
  same rubric a human would use, then re-run this harness to see if it
  closes the Trivial/High gaps.
- **Expand the labelled set once more real categories/priorities are
  seen in production**, particularly more `Other`-category and
  `Trivial`/`High`-priority examples — single-example categories can't
  distinguish a real miss from a one-off edge case.

## Labelled set used (for reference)

| Category | Count | Priority | Count |
| --- | --- | --- | --- |
| Hardware | 7 | High | 6 |
| Software | 5 | Medium | 6 |
| Account | 4 | Critical | 3 |
| Network | 3 | Trivial | 3 |
| Other | 1 | Low | 2 |
