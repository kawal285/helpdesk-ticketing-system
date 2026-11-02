# Access permissions and error handling: test results and defects

Issue #86. Run against the full backend test suite on 2026-11-02 via
`npm test`. Real output, not a summary written from memory — every
number below is from the run itself.

```
Test Suites: 28 passed, 28 total
Tests:       1 skipped, 259 passed, 260 total
Time:        22.3s
```

## Acceptance criteria, against what actually exists

### 1. Customers can access only their own tickets

Enforced by `canAccessTicket()` (`src/utils/ticketAccess.js`), the single
shared gate every ticket and comment endpoint routes through —
`ticket.controller.js`'s `loadAccessibleTicket()` and
`comment.controller.js`'s equivalent both call it, so a customer who
guesses another customer's ticket ID gets a 404 (not a 403, so the ID's
existence isn't confirmed either) from `GET /tickets/:id`,
`PATCH /tickets/:id`, `POST /tickets/:id/ai-analyze`, and both comment
endpoints alike.

Covered by `tests/ticketAccess.test.js` (9 tests, the pure function in
isolation — admin/customer/agent/unrecognized-role cases) and the
`ticket ownership scoping` block in `tests/tickets.test.js` (hides one
customer's ticket from another, hides an agent's ticket from a
differently-assigned agent, confirms admin sees everything).

### 2. Agent and administrator permissions are checked by the backend

Every admin-only route (`/users/*`, `/settings/*`) uses
`authorize('admin')`; agent-or-admin routes (ticket status/assign/
ai-analyze) use `authorize('agent', 'admin')`. This is middleware, not a
frontend-only check — the frontend hiding a button is a UX nicety, not
the enforcement boundary.

Covered by `tests/rbac.test.js` (8 tests) and `tests/userManagement.test.js`
(26 tests, including the deactivate-invalidates-existing-token case),
plus role-restriction assertions scattered through `tests/tickets.test.js`
(customer blocked from status/assign/ai-analyze, non-admin blocked from
overriding a terminal status).

### 3. AI service failures and invalid requests produce clear error messages

Two different AI failure surfaces, two different (both intentional)
behaviors:

- **Automatic, at ticket creation** (`aiService.getAiSuggestions`): never
  throws, 8s timeout, falls back to `category: null, priority: null` —
  the ticket is still created with sensible defaults
  (`DEFAULT_PRIORITY`/`'Other'`) rather than failing the request. This is
  deliberate: an AI outage must never block someone from raising a
  ticket. Covered by `tests/aiService.test.js` (3 tests: success,
  rejection, quota-error — all resolve to the same safe null shape) and
  `tests/tickets.test.js`'s "falls back to category=Other/priority=Trivial"
  case.
- **Explicit, via `POST /tickets/:id/ai-analyze`**: a staff-initiated
  action *should* surface a failure, since the user is actively asking
  for AI help right now. Returns `503` with
  `"AI analysis is currently unavailable. Please try again later."`
  rather than a generic 500 or a silent 200. Previously untested — added
  in this pass (see below).

Invalid requests across the API go through `express-validator` +
`middleware/validate.js`, returning `400` with the specific field-level
message (e.g. `"category must be one of Hardware, Software, Network,
Account, Other"`), not a generic "bad request."

### 4. Automated tests cover ticket permissions, important API operations and AI failure cases

Ticket permissions and important operations were already well covered
(see #1/#2 above, plus `tests/ticketStatus.test.js`'s 10 tests on valid/
invalid status transitions). The gap was AI failure cases on the
*explicit* analysis endpoint: `POST /tickets/:id/ai-analyze` had **zero**
tests before this pass — not the role check, not the 503 path, not the
success path. Added 5 tests covering: unauthenticated 401, customer 403
(even on their own ticket), 404 for a ticket an agent can't access (same
gate as every other ticket endpoint), the 503 path with the ticket's
existing category/priority confirmed unchanged afterward, and the
success path updating all four AI fields.

### 5. Test results and remaining defects are documented

This document.

## Known remaining defects

- **`GEMINI_API_KEY` is invalid in this environment** (confirmed still
  broken on 2026-11-02, same as when first found on 2026-10-27): every
  real call to Gemini returns `401 Unauthorized` /
  `ACCESS_TOKEN_TYPE_UNSUPPORTED`, not expired/over-quota. Because
  `aiService.js` correctly never blocks ticket creation on an AI
  failure, this has been silently degrading every ticket to
  `Trivial`/`Other` defaults with no visible error — functioning exactly
  as designed, but it means nobody has seen a real AI suggestion in this
  environment for as long as the key has been invalid. See
  [ai-classification-evaluation-report.md](./ai-classification-evaluation-report.md)
  for the full trace. Needs a valid key from whoever owns the Gemini
  integration; no code change required.
- **RAG retrieval doesn't filter by audience/role yet.** The `audience`
  column exists on `kb_chunks` (default `'All'`) and
  `aiAssistant.test.js` has a `test.skip` describing the intended
  contract (an agent's role should reach `retrieve()` and filter the
  candidate pool), but `assistUser()` never passes `req.user.role`
  through and `retrievalService.retrieve()` only filters by `category`,
  not `audience`. Not a currently-exploitable issue (there's no
  audience-restricted content in the knowledge base yet), but the
  contract is written and not wired — flagged in the test file itself
  rather than silently passing.
- **CORS has no origin restriction** (`app.use(cors())` in `src/app.js`
  with no options, which reflects any origin). Lower risk than it would
  be for a cookie-based app, since auth here is a Bearer token a
  cross-origin page can't read from this app's `localStorage` — but it's
  still broader than necessary for a deployed instance. Not changed in
  this pass; worth tightening to `FRONTEND_URL` (already a defined env
  var) before any real deployment.
- **DuckDuckGo web search (issue #81/#82) is a best-effort, unofficial
  integration.** Its own code comments already document this: response
  times observed from under a second to over ten, and it's the only
  provider in the codebase that can fail for reasons outside the team's
  control. Handled correctly (timeout + never-throws + graceful
  degrade to KB-only), not a bug, but worth knowing before relying on it
  for a demo.

## What's deliberately not covered

- Load/concurrency testing — out of scope for a capstone-sized deployment.
- Penetration testing of `express-validator`/Sequelize parameterized
  queries against injection — Sequelize's query builder is used
  throughout. One raw query exists
  (`routingService.js:pickLeastBusyAgent`, agent-assignment routing),
  but it's a static string with no user-controlled value interpolated
  into it, so there's nothing for an injection test to target there.
  Not independently fuzzed beyond that read.
