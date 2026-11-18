// Single source of truth for these two value lists -- they were previously
// hand-copied across the model, the validators, and the AI service, with no
// mechanism keeping them in sync.
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const PRIORITIES = ['Trivial', 'Low', 'Medium', 'High', 'Critical'];
const DEFAULT_PRIORITY = 'Trivial';

// The help desk talks in P1-P4. Stored priorities keep their names; each
// one maps to a level, with Trivial sharing P4 with Low.
const PRIORITY_LEVELS = {
  Critical: 'P1',
  High: 'P2',
  Medium: 'P3',
  Low: 'P4',
  Trivial: 'P4',
};

const LEVELS = ['P1', 'P2', 'P3', 'P4'];

// The stored priority a level stands for (P4 means Low).
const LEVEL_PRIORITIES = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };

function priorityLevel(priority) {
  return PRIORITY_LEVELS[priority] || null;
}

// Accepts "High", "P2", "p2", "P2 - High", "High (P2)" and returns "High".
function normalisePriority(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();

  const name = PRIORITIES.find((p) => new RegExp(`\\b${p}\\b`, 'i').test(text));
  if (name) return name;

  const level = text.match(/\bP\s*([1-4])\b/i);
  return level ? LEVEL_PRIORITIES[`P${level[1]}`] : null;
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  DEFAULT_PRIORITY,
  PRIORITY_LEVELS,
  LEVELS,
  LEVEL_PRIORITIES,
  priorityLevel,
  normalisePriority,
};
