const catchAsync = require('../utils/catchAsync');
const { emailIsConfigured, verifyEmailConnection } = require('../services/emailService');
const { SLA_HOURS } = require('../utils/sla');
const { ORGANIZATIONS } = require('../utils/organizations');
const { CATEGORIES, PRIORITIES, DEFAULT_PRIORITY } = require('../utils/ticketFields');
const { STATUSES, STATUS_LABELS } = require('../utils/ticketStatus');

// Admin-only read of the system's actual current configuration -- most of
// this is env-driven and otherwise invisible without reading server logs
// or .env directly. Nothing here is editable yet (these are fixed business
// rules baked into the code, not a persisted settings table); this is a
// visibility page, not a config-editing one.
const getSettings = catchAsync(async (req, res) => {
  res.status(200).json({
    email: {
      configured: emailIsConfigured(),
    },
    knowledgeBase: {
      provider: process.env.KNOWLEDGE_BASE_PROVIDER || 'local-json',
    },
    sla: SLA_HOURS,
    tickets: {
      statuses: STATUSES,
      statusLabels: STATUS_LABELS,
      categories: CATEGORIES,
      priorities: PRIORITIES,
      defaultPriority: DEFAULT_PRIORITY,
    },
    organizations: ORGANIZATIONS,
  });
});

// Lets an admin confirm SMTP actually works right now, rather than
// discovering it's broken the next time a real notification silently
// fails. verifyEmailConnection() throws when SMTP is configured but the
// connection itself fails (bad credentials, host unreachable, etc.) --
// caught here so the admin gets a clear "verified: false" with the real
// reason instead of a generic 500.
const verifyEmail = catchAsync(async (req, res) => {
  try {
    const result = await verifyEmailConnection();
    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({
      configured: true,
      verified: false,
      message: err.message,
    });
  }
});

module.exports = { getSettings, verifyEmail };
