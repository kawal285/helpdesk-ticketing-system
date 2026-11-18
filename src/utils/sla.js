// PROVISIONAL DEFAULTS -- not yet confirmed by the IT desk.
//
// These are common industry defaults, used to seed the sla_targets table
// and as a fallback when a priority has no row. Once the desk confirms its
// real P1-P4 times, an admin can change them in Settings (no code change
// needed). See docs/sla-targets.md.
//
// Priority mapping (utils/ticketFields.js): Critical = P1, High = P2,
// Medium = P3, Low = P4. Trivial is shown as P4 too but keeps its own,
// longer targets.
const { priorityLevel } = require('./ticketFields');

const DEFAULT_SLA_TARGETS = {
  Critical: { responseMinutes: 15, resolutionMinutes: 4 * 60 },
  High: { responseMinutes: 60, resolutionMinutes: 8 * 60 },
  Medium: { responseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  Low: { responseMinutes: 8 * 60, resolutionMinutes: 72 * 60 },
  Trivial: { responseMinutes: 24 * 60, resolutionMinutes: 120 * 60 },
};

// Resolution hours per priority, derived from the defaults so the two
// can't drift.
const SLA_HOURS = Object.fromEntries(
  Object.entries(DEFAULT_SLA_TARGETS).map(([priority, t]) => [
    priority,
    t.resolutionMinutes / 60,
  ])
);

const MINUTE_MS = 60 * 1000;

// Pure: given a target ({ responseMinutes, resolutionMinutes }) and the
// moment the clock starts, returns both deadlines.
function computeDueDates(target, anchor) {
  const start = new Date(anchor).getTime();
  return {
    responseDueAt: new Date(start + target.responseMinutes * MINUTE_MS),
    resolutionDueAt: new Date(start + target.resolutionMinutes * MINUTE_MS),
  };
}

// A target is "at risk" once this fraction of its time window has passed.
const AT_RISK_FRACTION = 0.75;

const SLA_STATUSES = ['on_track', 'at_risk', 'breached'];

// Status of a single target (response or resolution):
//  - completed (completedAt set): on_track if done by dueAt, else breached
//  - still open: breached past dueAt, at_risk once 75% of the window from
//    startAt to dueAt has passed, otherwise on_track.
// Returns null when the ticket has no due date for this target.
function getTargetStatus({ startAt, dueAt, completedAt, now = new Date() }) {
  if (!dueAt) return null;

  const due = new Date(dueAt).getTime();

  if (completedAt) {
    return new Date(completedAt).getTime() <= due ? 'on_track' : 'breached';
  }

  const current = new Date(now).getTime();
  if (current > due) return 'breached';

  const start = new Date(startAt).getTime();
  const window = due - start;
  if (window <= 0 || (current - start) / window >= AT_RISK_FRACTION) {
    return 'at_risk';
  }

  return 'on_track';
}

// Both targets for a ticket. `dueAt` is the resolution target.
function getSlaStatus(ticket, now = new Date()) {
  const target = (dueAt, completedAt) => ({
    dueAt: dueAt || null,
    completedAt: completedAt || null,
    status: getTargetStatus({ startAt: ticket.createdAt, dueAt, completedAt, now }),
  });

  return {
    response: target(ticket.responseDueAt, ticket.firstRespondedAt),
    resolution: target(ticket.dueAt, ticket.resolvedAt),
  };
}

// Counts for a set of tickets: met / missed for finished targets and
// on track / at risk / overdue for open ones, per target.
function blankSummaryRow() {
  return { met: 0, missed: 0, onTrack: 0, atRisk: 0, overdue: 0 };
}

function addToSlaSummary(summary, ticket, now = new Date()) {
  const sla = getSlaStatus(ticket, now);
  summary.total += 1;

  ['response', 'resolution'].forEach((key) => {
    const target = sla[key];
    if (!target.status) return;
    const row = summary[key];

    if (target.completedAt) {
      if (target.status === 'breached') row.missed += 1;
      else row.met += 1;
    } else if (target.status === 'breached') {
      row.overdue += 1;
    } else if (target.status === 'at_risk') {
      row.atRisk += 1;
    } else {
      row.onTrack += 1;
    }
  });

  return summary;
}

function summariseSla(tickets, now = new Date()) {
  const summary = { total: 0, response: blankSummaryRow(), resolution: blankSummaryRow() };
  tickets.forEach((ticket) => addToSlaSummary(summary, ticket, now));
  return summary;
}

// Returns a copy of a (plain) ticket with its `sla` status and P1-P4
// levels attached.
function withSla(ticket, now = new Date()) {
  if (!ticket) return ticket;
  return {
    ...ticket,
    priorityLevel: priorityLevel(ticket.priority),
    aiPriorityLevel: priorityLevel(ticket.aiPriority),
    sla: getSlaStatus(ticket, now),
  };
}

module.exports = {
  DEFAULT_SLA_TARGETS,
  SLA_HOURS,
  AT_RISK_FRACTION,
  SLA_STATUSES,
  computeDueDates,
  getTargetStatus,
  getSlaStatus,
  withSla,
  summariseSla,
  addToSlaSummary,
};
