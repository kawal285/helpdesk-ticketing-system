const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const TRANSITIONS = {
  Open: ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Resolved', 'Closed', 'Open'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [], // terminal for non-admins; admins may override
};

function isValidTransition(from, to, isAdmin = false) {
  if (from === to) return true;
  if (isAdmin) return true;
  return (TRANSITIONS[from] || []).includes(to);
}

// Who may edit a ticket's own fields (title/description/category/priority),
// as opposed to just its status (see isValidTransition above). Returns an
// error message if editing isn't allowed, or null if it is.
function editPermissionError(user, ticket) {
  if (user.role === 'admin') return null;
  if (user.role === 'agent') return 'You do not have permission to perform this action.';
  if (ticket.status !== 'Open') return 'Only open tickets can be edited.';
  return null;
}

module.exports = { STATUSES, TRANSITIONS, isValidTransition, editPermissionError };
