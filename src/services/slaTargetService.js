const { SlaTarget } = require('../models');
const { PRIORITIES } = require('../utils/ticketFields');
const { DEFAULT_SLA_TARGETS, computeDueDates } = require('../utils/sla');

function toTarget(priority, row) {
  const source = row || DEFAULT_SLA_TARGETS[priority] || DEFAULT_SLA_TARGETS.Medium;
  return {
    priority,
    responseMinutes: source.responseMinutes,
    resolutionMinutes: source.resolutionMinutes,
    // true when the sla_targets table has no row for this priority and the
    // provisional default from src/utils/sla.js is being used instead.
    isDefault: !row,
  };
}

// Every priority, in PRIORITIES order, with the table value if present.
async function getTargets() {
  const rows = await SlaTarget.findAll();
  const byPriority = new Map(rows.map((row) => [row.priority, row]));
  return PRIORITIES.map((priority) => toTarget(priority, byPriority.get(priority)));
}

async function getTargetFor(priority) {
  const row = await SlaTarget.findOne({ where: { priority } });
  return toTarget(priority, row);
}

// { responseDueAt, resolutionDueAt } for a ticket of this priority,
// measured from `anchor` (the ticket's createdAt).
async function computeTicketDueDates(priority, anchor) {
  const target = await getTargetFor(priority);
  return computeDueDates(target, anchor);
}

module.exports = { getTargets, getTargetFor, computeTicketDueDates };
