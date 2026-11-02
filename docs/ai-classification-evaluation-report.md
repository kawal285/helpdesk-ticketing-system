# Ticket classification evaluation (issue #87)

Criterion 4 of #87 asks to compare AI category/priority predictions
against manually labelled tickets and record the results. Run against
the live pipeline on 2026-10-27 via
`node scripts/ai/evaluate-classification.js`, using
`getAiSuggestions()` — the exact function `ticket.controller.js` calls
on real ticket creation. Raw, unedited output for every ticket is in
[ai-classification-evaluation-raw.json](./ai-classification-evaluation-raw.json).

## Method

20 realistic ticket descriptions
(`tests/classification/ticket-classification-evaluation-set.json`),
spanning all five categories and all five priorities, each hand-labelled
with the expected category and priority *before* the run, plus a
reasoning note explaining the call against this project's own agreed
priority criteria (the P1–P5 business-day definitions already shown to
users in the ticket form).

## Headline result: the AI integration is currently non-functional, not inaccurate

**Category accuracy: 0.0% (0/20). Priority accuracy: 0.0% (0/20). AI
unavailable on 20/20 tickets.**

That is not a measurement of how good the model is at classifying
tickets — every single call failed before reaching the model at all.
Calling `analyzeTicket()` directly (bypassing `aiService.js`'s
catch-everything wrapper, which is why real ticket creation degrades
silently to the `Trivial`/`Other` defaults instead of erroring) surfaces
the real cause:

```
ERROR status: 401
[GoogleGenerativeAI Error]: ... [401 Unauthorized] API key not valid.
Please pass a valid API key. [... "reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED" ...]
```

`GEMINI_API_KEY` in this environment's `.env` is not a valid credential
for the Generative Language API — Google's backend rejects it as the
wrong token type, not as expired or over quota. This is consistent with
what showed up earlier this session as a live ticket silently getting
`Trivial`/`Other` instead of a real AI suggestion: `aiService.js` is
working exactly as designed (never let an AI failure block ticket
creation), but it means **no one has seen a real Gemini classification
in this environment** for as long as this key has been invalid.

This is squarely the kind of thing #87 asks this evaluation to surface
("identify issues that need attention") — it just surfaced an
infrastructure problem instead of a model-accuracy one.

## What this run does confirm

- The evaluation harness itself works correctly: fast, consistent
  per-ticket timing (194–788ms, well under the 8s timeout), a clean run
  across all 20 tickets, correct accuracy/breakdown/confusion-pair
  output, and a raw JSON file written for every result.
- `aiService.js`'s "never block ticket creation" guarantee held under a
  real failure, not just the timeout case it was originally tested
  against.

## What's needed to get a real answer

1. Whoever owns the Gemini API key (AI model/prompt integration) issues
   a new valid key from Google AI Studio and updates `GEMINI_API_KEY`.
2. Re-run `node scripts/ai/evaluate-classification.js` — no code changes
   needed, it will report real category/priority accuracy the moment the
   key works.

## Labelled set used (for reference)

| Category | Count | Priority | Count |
| --- | --- | --- | --- |
| Hardware | 7 | High | 6 |
| Software | 5 | Medium | 6 |
| Account | 4 | Critical | 3 |
| Network | 3 | Trivial | 3 |
| Other | 1 | Low | 2 |
