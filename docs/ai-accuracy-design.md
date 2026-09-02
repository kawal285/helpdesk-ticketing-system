# Why the AI assistant should give correct answers

This is the design side of the accuracy question: what about how the
assistant is built makes its answers trustworthy, before any test is run.
For the actual test results, see [ai-evaluation-report.md](./ai-evaluation-report.md).

## 1. It's RAG, not a general-knowledge chatbot

The assistant (`src/services/rag/`) never answers from what the model
learned during training. Every question goes through:

```
question -> embed -> retrieve matching knowledge-base chunks -> generate
                                                                  an answer
                                                                  using only
                                                                  those chunks
```

`generationService.js` builds a prompt (`prompt.js`) that hands the model
the retrieved chunk text and instructs it to answer from that text alone.
If nothing in the knowledge base clears the relevance bar, the assistant
refuses rather than guessing — see `ragService.js`'s `grounded: false`
path, exercised by `tests/aiAssistant.test.js`'s "recommends a ticket when
nothing relevant is retrieved" case. A general chatbot would improvise an
answer to "how do I connect to eduroam" from whatever it saw during
training, which could be wrong, outdated, or describe a different
institution's process entirely. This one physically cannot do that: if
the knowledge base doesn't say it, the model isn't shown anything to say
it from.

## 2. The source material is meant to be real, approved content

The knowledge base currently in `src/data/knowledgeBase.json` is a
placeholder set of 23 IT-helpdesk articles covering the topics this
system's tickets actually fall into (password resets, Wi-Fi, printing,
VPN, phishing, etc.). Per the project's meeting minutes, this is intended
to be replaced with real content sourced from AIC's own approved
documentation, not written or lightly-edited from general internet
sources. That distinction matters for accuracy specifically: a RAG system
is only as correct as what it's allowed to retrieve from. Swapping in
approved AIC material doesn't require any code change — the knowledge-base
provider abstraction (`src/services/knowledgeBaseProviders/`, documented
in [PROVIDERS.md](./PROVIDERS.md)) means new source content is a data/config
change, not a rewrite of the retrieval or generation logic.

## 3. Retrieval is deliberately narrow, not "grab everything vaguely related"

`retrievalService.js` applies three separate filters before anything
reaches the model, each guarding against a different failure mode:

- **An absolute similarity threshold** (`RAG_SIMILARITY_THRESHOLD`) — is
  anything actually relevant, or is this an out-of-domain question that
  should be refused? Measured empirically against real questions in
  `scripts/rag/measure-threshold.js`, not copied from a tutorial (see
  [rag-evaluation.md](./rag-evaluation.md)).
- **A relative cutoff** (`RAG_RELATIVE_CUTOFF`, default 0.06) — drops
  chunks that score meaningfully below the best match, so a
  neighbouring-but-different topic doesn't get pulled in alongside the
  real answer and blur the two together.
- **A per-article cap** (`RAG_MAX_PER_ARTICLE`, default 2) — stops one
  article from dominating every slot in the context window, which would
  otherwise starve a genuinely two-topic question of the second topic's
  material.

The net effect: the model is shown the smallest set of chunks that are
actually relevant to *this* question, not a broad dump of "somewhat
related" content. Less irrelevant material in the prompt means fewer
opportunities for the model to blend unrelated details into a wrong
answer.

## What this section does *not* claim

None of the above is evidence the assistant gives correct answers in
practice — it's an argument for why the *design* should produce correct
answers, based on what RAG structurally prevents. Whether it actually
does, on real questions, is a separate empirical question, answered in
[ai-evaluation-report.md](./ai-evaluation-report.md).
