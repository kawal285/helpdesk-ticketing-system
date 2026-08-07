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

module.exports = { STATUSES, TRANSITIONS, isValidTransition };
