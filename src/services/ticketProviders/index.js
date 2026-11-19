// The ticket-store provider contract. Anything the platform stores and
// retrieves tickets from -- this app's own MySQL tables today, a real
// CRM later -- must expose exactly these five methods, working with
// plain objects only (never a live Sequelize instance, so a REST-backed
// provider is never asked to do something it structurally can't):
//
//   createTicket(data)                    -> Ticket
//   getTicketById(id)                     -> Ticket | null
//   listTickets(filter, {limit, offset, sort})  -> { rows: Ticket[], count }
//     sort: 'newest' (default) or 'priority' (open first, P1 to P4,
//     then nearest deadline)
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
const { createProviderRegistry } = require('../../utils/createProviderRegistry');

const { registerProvider, getProvider, resetProviderCache } = createProviderRegistry({
  envVar: 'TICKET_PROVIDER',
  defaultProvider: 'local-sequelize',
});

registerProvider('local-sequelize', () => createLocalSequelizeProvider());

module.exports = { getProvider, resetProviderCache, registerProvider };
