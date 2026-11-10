// The single ticket-ownership rule, used by every ticket and comment
// route so it can never drift between them:
//   customer -> only tickets they requested
//   agent    -> tickets assigned to them, plus the unassigned pickup pool
//   admin    -> every ticket
//   any other role -> nothing
//
// IDs are compared as numbers because a ticket provider backed by an
// external CRM may hand them back as strings.
function sameId(a, b) {
  return a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);
}

function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return sameId(ticket.requesterId, user.id);
  if (user.role === 'agent') {
    return ticket.assigneeId === null || ticket.assigneeId === undefined || sameId(ticket.assigneeId, user.id);
  }
  return false;
}

// The same rule as a list filter in the ticket providers' CRM-agnostic
// filter shape (see src/services/ticketProviders). Returns null when the
// user may see no tickets at all -- callers must then return an empty
// result instead of querying.
function ticketScopeForUser(user) {
  if (!user) return null;
  if (user.role === 'admin') return {};
  if (user.role === 'customer') return { requesterId: user.id };
  if (user.role === 'agent') return { assigneeIn: [user.id, null] };
  return null;
}

module.exports = { canAccessTicket, ticketScopeForUser };
