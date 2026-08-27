// The ticket-store provider contract. Anything the platform stores and
// retrieves tickets from -- this app's own MySQL tables today, a real
// CRM later -- must expose exactly these five methods, working with
// plain objects only (never a live Sequelize instance, so a REST-backed
// provider is never asked to do something it structurally can't):
//
//   createTicket(data)                    -> Ticket
//   getTicketById(id)                     -> Ticket | null
//   listTickets(filter, {limit, offset})  -> { rows: Ticket[], count }
//   getOverdueTickets(filter)             -> Ticket[]
//   updateTicket(id, changes)             -> Ticket | null
//
// filter is CRM-agnostic: { requesterId?, assigneeId?, assigneeIn?: (id|
// null)[], status?, priority?, category?, organization?, dueBefore?,
// statusNotIn? }. Ticket includes requester {id, name, email?, role?,
// organization?} and assignee {id, name, email?, role?} when present.
//
// Business rules -- who can see what, valid status transitions, SLA due
// dates, when to notify -- live in the controller, not here: those apply
// no matter which backend stores the tickets. Only the actual storage
// operation is what varies per CRM.
//
// The registry is open, not a hardcoded switch, mirroring
// knowledgeBaseProviders: a provider becomes available by calling
// registerProvider(name, factory), which the local provider does to
// itself below.

const { createLocalSequelizeProvider } = require('./localSequelizeProvider');

const registry = new Map();

function registerProvider(name, factory) {
  registry.set(name, factory);
}

let cachedProvider = null;

function getProvider() {
  if (cachedProvider) return cachedProvider;

  const key = process.env.TICKET_PROVIDER || 'local-sequelize';
  const factory = registry.get(key);

  if (!factory) {
    throw new Error(
      `Unknown TICKET_PROVIDER "${key}". Available providers: ${[...registry.keys()].join(', ')}.`
    );
  }

  cachedProvider = factory();
  return cachedProvider;
}

// Test-only: forces the next getProvider() call to re-resolve instead of
// reusing the cached instance.
function resetProviderCache() {
  cachedProvider = null;
}

registerProvider('local-sequelize', () => createLocalSequelizeProvider());

module.exports = { getProvider, resetProviderCache, registerProvider };
