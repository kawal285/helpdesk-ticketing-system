# Sensitive data redaction

Before any user-written text leaves the server, `src/utils/privacy.js`
replaces sensitive details with typed placeholders. The model still sees
*what kind* of detail was there ("my password is [PASSWORD]"), so tickets
classify and answer the same, but the value itself is never sent.

## What is redacted

| Type | Examples | Placeholder |
| --- | --- | --- |
| Labelled passwords and secrets | `password: hunter2`, `pwd=...`, `my password is Summer2024!`, `PIN to 4821` | `[PASSWORD]` |
| API keys | Google `AIza…`, OpenAI `sk-…`, Groq `gsk_…`, GitHub `ghp_…`, AWS `AKIA…`, Slack `xox…` | `[API_KEY]` |
| Tokens | `Bearer …`, JSON web tokens `eyJ….eyJ….…` | `[TOKEN]` |
| Private keys | `-----BEGIN … PRIVATE KEY-----` blocks | `[PRIVATE_KEY]` |
| Email addresses | `jo.smith@example.co.nz` | `[EMAIL]` |
| Phone numbers | `021 123 4567`, `(09) 123 4567`, `+64 21 987 6543`, `0800 123 456` | `[PHONE]` |
| Card numbers | 13–19 digits that pass the Luhn check | `[CARD]` |

Deliberately **not** redacted, because the AI needs them to help:
"my password is expired" (no secret-looking value), error codes such as
`0x80070005`, dates, IP addresses, ticket and order numbers, room codes
and version numbers. These are covered by the "leaves … unchanged" tests.

Only counts of what was removed are returned, never the values.

## Where it is applied

| Outbound call | Service | Redacted in |
| --- | --- | --- |
| Ticket classification (category / priority) | chat model (Ollama / Groq / college) | `aiAnalysisService.generateAnalysis` |
| Assistant answer and small talk | chat model | `ragService.ask` (question and follow-up history) |
| Question embedding for retrieval | Gemini embeddings | `embeddingService.embedQuery` |
| Web search | DuckDuckGo | `webSearchService.search` |
| Emotion detection | local Ollama | `emotionDetectionService.detectEmotion` |

`ragService.ask` redacts once, straight after the safety hazard check, and
the embedding and web search services redact again on their own, so a
future caller that skips `ask` is still covered.

The knowledge base is **not** redacted: help-desk articles carry the
desk's own phone numbers and emails, and the answers need them. Generated
answers are separately cleaned of credentials by `safety.redactSecrets`.

## Evidence

- `tests/privacy.test.js`: 21 sensitive examples are redacted, 10
  look-alike examples are left unchanged, plus a realistic mixed ticket.
- `tests/privacyOutbound.test.js`: every external provider is replaced
  with a recorder; a ticket containing an email, phone, password, API key
  and card number is sent through classification, the assistant (including
  follow-up history and small talk), embeddings, web search and emotion
  detection, and none of the original values appear in anything recorded.
  With redaction switched off, all 6 tests fail.
