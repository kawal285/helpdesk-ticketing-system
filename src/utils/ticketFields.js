// Single source of truth for these two value lists -- they were previously
// hand-copied across the model, the validators, and the AI service, with no
// mechanism keeping them in sync.
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// Placeholder option lists from the client's CRM "New Case" form -- these
// weren't given as a finalized list, so we have to swap these for the real ones once
// the client confirms them.
const INITIAL_FEELINGS = ['Calm', 'Concerned', 'Frustrated', 'Urgent'];
const ORIGINS = ['Portal', 'Email', 'Phone', 'Walk-in'];

module.exports = { CATEGORIES, PRIORITIES, INITIAL_FEELINGS, ORIGINS };