// P1-P4 levels, matching src/utils/ticketFields.js on the server.
// Trivial shares P4 with Low.
export const PRIORITY_LEVELS = {
  Critical: 'P1',
  High: 'P2',
  Medium: 'P3',
  Low: 'P4',
  Trivial: 'P4',
};

// Value used in a <select> to mean "let the AI decide".
export const AI_CHOICE = '__ai__';

// "P2 · High", or just the name when it has no level.
export function priorityLabel(priority, level) {
  if (!priority) return 'Not set';
  const p = level || PRIORITY_LEVELS[priority];
  return p ? `${p} · ${priority}` : priority;
}
