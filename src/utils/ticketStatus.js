const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const TRANSITIONS = {
  Open: ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Open', 'Resolved', 'Closed'],
  Resolved: ['In Progress', 'Closed'],
  Closed: [],
};

const STATUS_LABELS = {
  Open: 'Open',
  'In Progress': 'In Progress',
  Resolved: 'Resolved – Awaiting Review',
  Closed: 'Reviewed and Closed',
};

function isValidTransition(from, to, isAdmin = false) {
  if (from === to) return true;

  // Administrators can correct or reopen any ticket.
  if (isAdmin) return true;

  return (TRANSITIONS[from] || []).includes(to);
}

function editPermissionError(user, ticket) {
  if (user.role === 'admin' || user.role === 'agent') {
    return null;
  }

  if (ticket.status !== 'Open') {
    return 'Only open tickets can be edited.';
  }

  return null;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

module.exports = {
  STATUSES,
  TRANSITIONS,
  STATUS_LABELS,
  isValidTransition,
  editPermissionError,
  getStatusLabel,
};