// PROVISIONAL DEFAULTS -- not yet confirmed by the IT desk.
//
// These are common industry defaults, used to seed the sla_targets table
// and as a fallback when a priority has no row. Once the desk confirms its
// real P1-P4 times, an admin can change them in Settings (no code change
// needed). See docs/sla-targets.md.
//
// Priority mapping: Critical = P1, High = P2, Medium = P3, Low = P4.
// Trivial sits below P4.
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

module.exports = { DEFAULT_SLA_TARGETS, SLA_HOURS, computeDueDates };
