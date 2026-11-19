# Similar open tickets (duplicate detection)

When many people report the same problem (for example a network outage),
each report becomes its own ticket and agents can end up solving the same
thing several times. On a ticket's page, staff now see **Similar open
tickets**: open tickets whose wording looks like the same problem, each
with a match score and a **Mark as duplicate** button that links the
ticket to the original (`parentCaseId`).

## How it works

1. When a ticket is created, or its title or description changes, its
   text is embedded in the background with the same model the knowledge
   base search uses (`nomic-embed-text`, running locally in Ollama). The
   vector is stored in the `ticket_embeddings` table, with a hash of the
   text so it is only redone when the text changes.
2. `GET /tickets/:id/similar` (agents and admins only) compares the
   ticket with up to 500 open tickets the user is allowed to see, using
   cosine similarity, and returns the closest 5 at or above the
   threshold. Missing embeddings are filled in on the spot.
3. Linking a duplicate uses the existing `PATCH /tickets/:id` with
   `parentCaseId`, so nothing new is needed to store the link.

Private details (emails, phone numbers, passwords and so on) are removed
before a ticket is embedded, the same as for every other AI call (see
[privacy-redaction.md](./privacy-redaction.md)). Agents only ever see
tickets they can already open: their own plus the unassigned pool.

## Choosing the threshold

Picked from 30 hand-labelled pairs (`tests/similarity/ticket-duplicate-pairs.json`):
12 duplicates, 10 "related but different problem" pairs (the hard case,
for example "printer jammed" vs "printer out of toner") and 8 unrelated
pairs. Full results: [similar-tickets-evaluation.md](./similar-tickets-evaluation.md),
regenerated with `node scripts/ai/evaluate-similar-tickets.js`.

The default is **0.73**: it found all 12 duplicates with one wrong
suggestion (precision 0.92, recall 1.0, F1 0.96). A slightly higher value
(0.74) gives no wrong suggestions but misses one duplicate. Because a
person always decides whether to link, missing a real duplicate costs
more than showing one extra suggestion, so the lower value was chosen. It
can be changed with `SIMILAR_TICKET_THRESHOLD` in `.env`.

Limits: 30 pairs is a small set, so the threshold should be checked again
on real tickets. The score compares wording, not meaning in context: two
"the printer is broken" tickets in different buildings will still match.
That's why the panel shows the requester and the agent makes the call.

## Commands

- `npm run tickets:index` embeds every existing ticket (safe to re-run).
- `node scripts/ai/evaluate-similar-tickets.js` re-scores the labelled pairs.

## Tests

`tests/similarTickets.test.js` (offline, with a stand-in embedding):
finds the duplicate and not the unrelated ticket, ranks the closest
first, only suggests open tickets, never shows an agent another agent's
tickets, blocks customers (403), stores each embedding once and redoes it
only when the text changes, removes private details before embedding,
returns 503 when the model is down, and links a duplicate.
