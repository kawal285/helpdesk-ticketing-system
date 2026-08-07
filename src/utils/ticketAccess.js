// Server-side visibility rule, shared by tickets and comments so it can
// never drift between the two: customer sees only their own tickets,
// agent sees tickets assigned to them (plus the unassigned pool), admin
// sees everything.
function canAccessTicket(user, ticket) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return ticket.requesterId === user.id;
  if (user.role === 'agent') return ticket.assigneeId === user.id || ticket.assigneeId === null;
  return false;
}

module.exports = { canAccessTicket };
