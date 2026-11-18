# Ticket classification evaluation (issue #87)

Criterion 4 of #87 asks to compare AI category/priority predictions
against manually labelled tickets and record the results. Run against
the live pipeline via `node scripts/ai/evaluate-classification.js`,
using `getAiSuggestions()` — the exact function `ticket.controller.js`
calls on real ticket creation. Raw, unedited output for the current
state is in [ai-classification-evaluation-raw.json](./ai-classification-evaluation-raw.json)
(overwritten by each run — every number below is also preserved
verbatim in the git history of that file and in each run's own commit).

## Latest result (2026-11-19): 40 tickets, full metrics

Set grown from 35 to 40 tickets (five added to the smallest groups:
Other, Low and Medium), the prompt now names the P1-P4 levels, and the
harness reports a confusion matrix, precision, recall, F1 and Cohen's
kappa. Full tables: [ai-classification-metrics.md](./ai-classification-metrics.md).
Priority rules: [priority-criteria.md](./priority-criteria.md).

| Measure | Accuracy | Macro F1 | Cohen's kappa |
| --- | --- | --- | --- |
| Category | 82.5% (33/40) | 0.759 | 0.777 (substantial) |
| Priority, five levels | 65.0% (26/40) | 0.632 | 0.564 (moderate) |
| Priority level, P1-P4 | 77.5% (31/40) | 0.755 | 0.696 (substantial) |

What it shows:

- **Software, Network and Account are always found** (recall 1.0).
  **Hardware** is the weak category: 3 of 11 went to Other.
  **Other** is weakest overall (F1 0.25), but it only has 4 tickets.
- **Trivial is still mostly called Low** (5 of 8). Both are P4, so this
  doesn't change the target times, which is why P1-P4 accuracy (77.5%)
  is much higher than five-level accuracy (65.0%).
- **The AI leans towards over-rating High as Critical** (4 of 11). That
  is the safer mistake (faster target), but it would pull agents away
  from real P1s, so agents should check P1 suggestions.
- **Low is never missed** (recall 1.0), but its precision is 0.545
  because Trivial tickets land there.

Kappa here measures agreement between the AI and the hand labels. To
check the labels themselves, a second person could label the same 40
tickets on their own and the two sets could be compared the same way.

The earlier results below are kept for the record.

## Earlier result (2026-11-03, after the lean prompt fix)

**Category accuracy: 82.9% (29/35). Priority accuracy: 60.0% (21/35).**

This is the end state after a four-step investigation on a 35-ticket
labelled set (`tests/classification/ticket-classification-evaluation-set.json`,
all five categories and priorities represented). Each step was measured
before changing anything else, so the comparison below is real,
recorded evidence, not a before/after guess:

| Step | Category | Priority | Trivial | High |
| --- | --- | --- | --- | --- |
| 1. Baseline (plain prompt) | 85.7% (30/35) | 45.7% (16/35) | 0/8 | 3/11 (27.3%) |
| 2. Examples added to all 5 tiers | 74.3% (26/35) | 54.3% (19/35) | 4/8 | 2/11 (18.2%) |
| 3. Lean: one rule, Trivial only | **82.9% (29/35)** | **60.0% (21/35)** | **4/8** | **5/11 (45.5%)** |

### Step 1: establishing a real baseline (expanded from the original 20-ticket run)

An earlier run on 20 tickets (3 Trivial, 6 High) scored 90%/55% and
flagged two patterns, but the samples were too small to tell a real
systematic issue from small-sample noise. Expanded to 35 tickets (8
Trivial, 11 High, plus more Network and Other examples) and re-ran
against the *unchanged* prompt first, to get a real baseline before
touching anything: **85.7% / 45.7%**. The larger sample sharpened both
patterns into confirmed findings:

- **Trivial: 0/8 (0.0%).** Every single Trivial ticket came back Low
  (7) or Medium (1) — the model never once used the bottom tier.
- **High: 3/11 (27.3%)**, scattered across Critical (4), Medium (3),
  Low (1) — genuine ordinal confusion, not a one-directional bias like
  Trivial's.
- **Other (category): 1/3 (33.3%)**, also confirmed weak.

### Step 2: the first fix attempt made things worse, not better

The prompt's priority section already *named* all five tiers with
short definitions (a teammate had added this — see "What changed"
below), so the hypothesis was that definitions alone weren't enough for
a small local model to separate adjacent tiers reliably. Added one or
two concrete example scenarios to *every* tier (Critical through
Trivial), checked for zero overlap with the labelled set's own wording,
and re-ran:

**74.3% / 54.3%.** Priority improved overall — Trivial jumped to 4/8 —
but **category accuracy dropped 11.4 points**, and **High got worse**
(27.3% → 18.2%, now leaning toward Critical instead of scattering
evenly). Nothing in the category section of the prompt had changed.
The likely cause: a much longer, example-heavy priority section
diluted how reliably the model followed the category instructions that
come earlier in the same system prompt — and the added Critical example
specifically looks like it pulled some High cases upward with it.

### Step 3: isolating what actually worked

Trimmed the examples back out everywhere except Trivial, keeping only
the one addition that looked load-bearing: an explicit rule that
low-urgency wording in the reporter's own message ("not a big deal,"
"no rush," "whenever you get a chance") should tip the call toward
Trivial over Low. Re-ran:

**82.9% / 60.0%** — the best priority result of the three runs, with
category accuracy mostly recovered. Trivial kept its full fix (4/8,
same as step 2). High *also* improved past the original baseline
(27.3% → 45.5%) despite nothing in the High definition changing —
indirect evidence that the step-2 regression really was about prompt
length/dilution, not content, since removing unrelated examples fixed
a tier those examples never touched.

### What's still genuinely weak

- **High is still the least reliable tier (45.5%)**, now biased toward
  Critical (`High → Critical`: 4/11) rather than scattering across all
  four other tiers like the baseline did. An improvement over 27.3%,
  but not solved — a borderline High case is still more likely to be
  called Critical than any other single wrong answer.
- **Other (category) is still weak (1/3 across all three runs)** — too
  small a sample (3 examples) to separate a real weakness from one hard
  example; needs more labelled `Other` tickets before concluding
  anything further.
- Category confusion in step 3 leans toward `Other` as the catch-all
  wrong answer (`Hardware → Other`: 2, `Software → Other`: 1,
  `Other → Software`: 2) — worth watching if the category prompt is
  ever revisited.

## What changed since the broken-API-key finding

The first-ever run (2026-10-27) scored 0%/0% with AI unavailable on
20/20 — not a model-accuracy finding at all, but `GEMINI_API_KEY` being
an invalid credential (`401`, wrong token type). That full writeup is
preserved in git history (`ed8bd6b`) rather than deleted here.

Since then, a teammate (Ramandeep) rewrote `aiAnalysisService.js` to go
through the same local Ollama generation provider the RAG assistant
already uses, instead of calling Gemini directly — removing the
Gemini/API-key dependency for ticket classification entirely, and
adding real priority definitions to `ticketPrompt.js` in the same pass.
`aiService.js`'s timeout was also raised from 8s to 20s to allow for a
local model's cold-load time, and its own comment now explicitly
credits the original finding in this report.

While testing that change, also found and fixed a related reliability
issue: `ticket.controller.js` was awaiting `getAiSuggestions()` and the
newly-merged `detectEmotion()` sequentially rather than concurrently —
12+ seconds per ticket creation live, worst case 68s. Fixed with
`Promise.all` (commit `41607e3`).

## What's needed next

- **Re-measure once more real tickets exist** to see whether the High
  → Critical lean and the thin `Other` sample hold up outside a
  hand-written test set.
- **If High accuracy still matters more than it does today, consider a
  harder constraint rather than more prose** — e.g. asking the model
  for a 1–5 severity score plus a separate "is this an outage/safety/
  security event?" yes/no, then deriving Critical only from the second
  answer, instead of asking a small model to place five ordinal labels
  correctly in one pass.

## Labelled set used (for reference)

| Category | Count | Priority | Count |
| --- | --- | --- | --- |
| Hardware | 11 | High | 11 |
| Software | 9 | Trivial | 8 |
| Network | 6 | Medium | 6 |
| Account | 6 | Critical | 6 |
| Other | 3 | Low | 4 |
