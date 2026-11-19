# Knowledge-gap report

Every time the AI assistant can't answer properly from the knowledge base,
the question is logged. Admins get a **Knowledge Gaps** page that groups
those questions into topics, most asked first, so staff can see which
articles to write next. This follows the idea behind Knowledge-Centered
Service (KCS): the knowledge base grows from what people actually ask.

## What is logged

Every assistant answer is saved in the `ai_interactions` table, with
private details removed from the question first (see
[privacy-redaction.md](./privacy-redaction.md)). Each row records how the
question was answered:

| Outcome | Meaning | Counts as a gap? |
| --- | --- | --- |
| `kb` | Answered from the knowledge base | No |
| `kb_low_confidence` | Only a weak knowledge-base match ("Needs human check") | **Yes** |
| `web_only` | Nothing in the knowledge base, answered from web results | **Yes** |
| `refused` | Nothing relevant anywhere, so no answer | **Yes** |
| `small_talk` | A greeting | No |
| `blocked` | A prompt-injection attempt | No |
| `escalated` | A safety hazard, sent straight to a person | No |

The row also keeps the best match score, the web results used, the model
and agent, and the suggested category. The same table is meant to hold
H6's records of AI answers and staff corrections, so both features share
one log.

Logging never fails the assistant: if saving the row goes wrong, the user
still gets their answer and a warning is logged.

## The report (`GET /knowledge-gaps`, admins only)

- Questions asked, how many were gaps, and the gap rate, for the last
  7, 30 or 90 days.
- The top topics: what was asked, how many times and by how many people,
  when it was last asked, how it was answered, example questions, the
  likely category, and the web results the assistant used.
- **Save to knowledge base** next to each web result uses the existing
  "save web result to KB" feature. The new article is searchable by the
  assistant straight away, and the topic is marked as covered.
- **Mark as covered** is for when the article was written another way.
  Covered topics drop off the list (they can be shown again).

## How questions are grouped into topics

Each question is embedded with the same model as the knowledge-base search
(`nomic-embed-text`). Questions are taken oldest first: each one joins the
topic whose average it is closest to, if that is at least **0.68**,
otherwise it starts a new topic. The question closest to the topic's
average is used as its name.

The 0.68 was chosen by grouping 22 hand-labelled questions in 9 topics
(`tests/similarity/gap-questions.json`) at every value from 0.55 to 0.80.
Full results: [knowledge-gap-grouping-evaluation.md](./knowledge-gap-grouping-evaluation.md)
(`node scripts/ai/evaluate-gap-grouping.js`).

| Threshold | Topics (real: 9) | Pair precision | Pair recall | F1 |
| --- | --- | --- | --- | --- |
| 0.66 | 9 | 0.565 | 0.722 | 0.634 |
| **0.68 (used)** | 10 | 0.765 | 0.722 | **0.743** |
| 0.72 | 15 | 1.000 | 0.500 | 0.667 |

At 0.68, 7 of the 10 topics were exactly right. The mistakes were close
ones ("3D printer" grouped with "plotter printer"; one Linux Wi-Fi
question on its own). Below 0.68 grouping chains: one wrong join pulls
the topic's average towards other topics. For a "what to write next"
list, splitting a topic in two is less harmful than mixing two topics,
which would overstate how often something was asked. Short questions are
harder to group than tickets, so this works less precisely than duplicate
ticket detection. The threshold can be changed with
`KB_GAP_GROUP_THRESHOLD` in `.env`.

## Tests

`tests/knowledgeGaps.test.js`: each outcome is logged correctly and
only gaps count as gaps, web results are kept, private details are
removed, the assistant still answers if logging fails, the grouping
joins close questions and splits far ones, the report counts topics and
orders them by how often they were asked, covering a topic removes it
(and it can be shown again), and only admins can see the report.
