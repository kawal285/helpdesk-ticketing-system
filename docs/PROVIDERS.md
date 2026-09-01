# Swappable backends: knowledge base and ticketing/CRM

The platform is not locked into its own local knowledge-base file or its
own MySQL ticket tables. Both are accessed through a small provider
contract, resolved at runtime by an env var, so a real CRM or a hosted
knowledge base can be swapped in without touching any route, controller,
or business logic.

This applies to two independent subsystems:

| Subsystem | Env var | Default provider | Registry |
| --- | --- | --- | --- |
| Knowledge base | `KNOWLEDGE_BASE_PROVIDER` | `local-json` | [`src/services/knowledgeBaseProviders/index.js`](../src/services/knowledgeBaseProviders/index.js) |
| Ticketing / CRM | `TICKET_PROVIDER` | `local-sequelize` | [`src/services/ticketProviders/index.js`](../src/services/ticketProviders/index.js) |

They're deliberately identical in shape -- learn one and you know both.

## Switching providers

Set the env var to the name a provider registered itself under, and
restart the app:

```
KNOWLEDGE_BASE_PROVIDER=acme-crm
TICKET_PROVIDER=acme-crm
```

Leave a var unset (or delete it) to fall back to this app's own local
storage. An unrecognized name fails fast at startup with a clear error
listing what's actually registered -- it never silently falls back.

## Adding a new provider

1. Write a module that returns an object implementing the contract below
   (see `localJsonProvider.js` / `localSequelizeProvider.js` for a
   reference implementation of each).
2. Register it by name:

   ```js
   const { registerProvider } = require('./knowledgeBaseProviders'); // or ./ticketProviders
   registerProvider('acme-crm', () => createAcmeCrmProvider());
   ```

   This can live in this repo (a new file next to the local provider) or
   in a separate package the app depends on -- the registry doesn't care
   where `registerProvider` gets called from, only that it happens before
   the first request that needs it.
3. Point the matching env var at that name.

Nothing else changes. Routes call `knowledgeBaseService.js` /
`ticket.controller.js`, both of which only ever talk to
`getProvider()` -- they have no idea which backend is actually live.

## Contracts

### Knowledge base (`KNOWLEDGE_BASE_PROVIDER`)

Synchronous; three methods:

```
listAll()        -> Article[]
search(query)     -> Article[]   // ranked, [] for an empty/blank query
getById(id)       -> Article | undefined
```

`Article` shape: `{ id, title, content, tags?: string[] }`.

### Ticketing / CRM (`TICKET_PROVIDER`)

Async; five methods, working only with plain objects (never a live
Sequelize instance -- a REST-backed CRM provider is never asked to do
something it structurally can't):

```
createTicket(data)                    -> Ticket
getTicketById(id)                     -> Ticket | null
listTickets(filter, {limit, offset})  -> { rows: Ticket[], count }
getOverdueTickets(filter)             -> Ticket[]
updateTicket(id, changes)             -> Ticket | null
```

`filter` is CRM-agnostic: `{ requesterId?, assigneeId?, assigneeIn?:
(id|null)[], status?, priority?, category?, organization?, dueBefore?,
statusNotIn? }`. `Ticket` includes `requester { id, name, email?, role?,
organization? }` and `assignee { id, name, email?, role? }` when present.

Business rules -- who can see what, valid status transitions, SLA due
dates, when to notify -- live in `ticket.controller.js`, not in the
provider: those apply no matter which backend stores the tickets. Only
the actual storage operation varies per CRM.

## Proof this actually works

Both registries are covered by two kinds of test:

- Registry-level (`tests/knowledgeBaseProviders.test.js`,
  `tests/ticketProviders.test.js`): resolution, caching, the unregistered-name
  error, and `resetProviderCache()`.
- HTTP-level (`tests/knowledgeBaseProviderSwap.test.js`,
  `tests/ticketProviderSwap.test.js`): register a throwaway fake
  provider, point the env var at it, and assert real requests through
  `app` (`GET /knowledge-base`, `GET /tickets`, ...) are served entirely
  by that fake -- proving the swap reaches production code paths, not
  just the registry in isolation.
