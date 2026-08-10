// Single source of truth for these two value lists -- they were previously
// hand-copied across the model, the validators, and the AI service, with no
// mechanism keeping them in sync.
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

module.exports = { CATEGORIES, PRIORITIES };
