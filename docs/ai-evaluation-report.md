# AI assistant answer evaluation

This is Part B of the accuracy question: not the design argument for why
the assistant *should* be accurate (see
[ai-accuracy-design.md](./ai-accuracy-design.md)), but actual evidence of
whether it *is*, on real questions. Run against the live pipeline
(Ollama, `llama3.2` generation / `nomic-embed-text` embeddings, dev
database with the current 23-article knowledge base indexed) on
2026-09-03, via `node scripts/rag/evaluate-answers.js`. Raw, unedited
model output for every question is in
[ai-evaluation-raw.json](./ai-evaluation-raw.json).

## Method

15 realistic questions (`tests/rag/answer-evaluation-set.json`) — 12
covering a spread of the knowledge base (VPN, password, lockout, MFA, ID
card, Wi-Fi, printing, print credit, Office install, phishing, OneDrive,
ticket SLAs) plus 3 deliberately out-of-domain — each with a short
"correct answer must cover" checklist written from the real article text
*before* the assistant was asked, so scoring couldn't be adjusted to fit
whatever came back. Each answer was then read against its checklist and
scored:

- **Correct** — directly and accurately answers the question asked, no
  invented details.
- **Partial** — grounded in the right article and not factually wrong,
  but missing a point a user would need, or padded with something
  irrelevant/incorrect alongside the useful part.
- **Wrong** — the answer states something as fact that the source
  article does not say.

## Results

| # | Question | Source cited | Score | Why |
| --- | --- | --- | --- | --- |
| 1 | My laptop won't connect to the VPN when I'm working from home | Art. 7 ✓ | Partial | Assumes an unstated symptom ("keeps disconnecting after a few seconds") the user never described, rather than covering first-time setup too |
| 2 | How do I reset my password? | Art. 1 ✓ | **Correct** | All three checklist points covered accurately |
| 3 | I've been locked out after too many failed attempts | Art. 2 ✓ | Partial | Correct steps, but drops the "raise a ticket if it keeps relocking" escalation path |
| 4 | How do I set up two-factor authentication? | Art. 3 ✓ | **Correct** | Full, accurate setup flow for the question asked |
| 5 | I lost my student ID card, what should I do? | Art. 4 ✓ | Partial | Correct immediate action, but omits the replacement process/fee, and ends with a stray bracketed aside ("[Note: you don't need to bring photo ID at this stage]") that reads like a leaked internal comment |
| 6 | The wifi in the library keeps dropping out | Art. 6 ✓ | Partial | Covers signal/location causes but drops the single most actionable fix in the article (the laptop power-management setting) and the escalation guidance |
| 7 | My print job isn't coming out of the printer | Art. 8 ✓ (+9) | Partial | Correct on checking the panel, but blends in print-release steps from a co-retrieved article instead of the specific "clear the stalled queue" steps |
| 8 | How do I top up my print credit? | Art. 9 ✓ | **Wrong** | Invents a specific "Top-up Print Credit" button on the "IT self-service site" — the article says top-ups happen on the *student portal*, a different site, and names no such button |
| 9 | Can I install Microsoft Office on my own personal laptop? | Art. 11 ✓ | Partial | Correctly says yes and to remove any existing copy, but never gives the actual install steps -- defers to a citation-style reference ("follow the steps in [2] ...") instead of stating them |
| 10 | I think I received a phishing email, what should I do? | Art. 13 ✓ | Partial | Correct for someone who hasn't clicked anything, but silently drops the "if you already clicked" path entirely |
| 11 | My OneDrive files aren't syncing anymore | Art. 15 ✓ | Partial | Same pattern as #1: opens by assuming the user already checked sign-in status, which they never said; also skips the icon-status and storage-quota checks |
| 12 | How long should it take for my ticket to get sorted out? | Art. 23 ✓ | Partial | The five SLA numbers are all correct, but the answer ends with an unrelated sentence about the 30-minute account-lockout wait, pulled in from a different co-retrieved article and wrong in this context |
| 13 | Who won the football match last night? | — (refused) | **Correct** | Correctly refused rather than guessing |
| 14 | Can you help me write an essay about climate change? | — (refused) | **Correct** | Correctly refused rather than guessing |
| 15 | What's the best restaurant near campus? | — (refused) | **Correct** | Correctly refused rather than guessing |

## Summary

**5 of 15 (33%) answered fully correctly; 9 of 15 (60%) were partially
correct — grounded and mostly useful, but missing a point or carrying an
irrelevant/wrong addition; 1 of 15 (7%) stated something the knowledge
base does not actually say.**

Split differently, by what actually failed:

- **Retrieval found the right article for all 12 in-domain questions
  (12/12)** and correctly refused all 3 out-of-domain ones — this
  matches [rag-evaluation.md](./rag-evaluation.md)'s separate retrieval
  measurement. The weak link is generation, not retrieval: given the
  right source material, the model still doesn't always turn it into a
  complete or accurate answer.
- **Two repeating, specific failure patterns**, not random noise:
  1. **Presumed context** (#1, #11) — the model opens as if continuing
     troubleshooting the user never described ("you've tried...",
     "you've checked..."), rather than answering the question actually
     asked.
  2. **Cross-contamination from a co-retrieved chunk** (#7, #12) and
     **invented specifics when the source is thin** (#8) — the one
     clear factual error (#8) wasn't the model refusing to answer or
     answering off-topic, it was stating a plausible-sounding but
     unsupported UI detail with full confidence.
  3. A smaller, cosmetic issue: leaked citation/meta-text (#5, #9)
     appearing inside the user-facing answer.

## What this means for the system as it stands

The refusal behaviour is reliable (3/3) and retrieval is reliable
(12/12) — the two failure-safety properties that matter most for not
actively misleading someone are solid. The part that needs work before
this could be trusted unsupervised is generation completeness and
occasional fabrication under a co-retrieved or thin context, which
`docs/ai-accuracy-design.md`'s narrower retrieval controls
(threshold/relative-cutoff/per-article cap) reduce the *chance* of but
evidently don't eliminate. Concretely: **known limitation, to state
plainly rather than hide** — do not treat a "grounded: true" answer as
verified correct; #8 shows a fully grounded answer can still contain an
invented specific. A human reviewing agent's ticket responses (or a
student relying on the assistant for something with real consequences)
should treat it as a strong first draft pointing at the right article,
not a final answer.

## Reproducing this

```
node scripts/rag/evaluate-answers.js
```

Requires Ollama running locally with `nomic-embed-text` and `llama3.2`
pulled, and the dev database's `kb_chunks` table indexed
(`npm run kb:index`). Results will vary run to run — the model is not
deterministic — so treat this as one honest sample, not a fixed
benchmark; re-running periodically as the knowledge base is replaced
with real AIC content is worth doing again from scratch.
