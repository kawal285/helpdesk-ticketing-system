// Turns the `sla` block the API puts on every ticket into badge labels.
// Wording here must never promise when an issue will actually be fixed --
// these are estimates from the priority's target times.

export function formatSlaDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Badge for one target (response or resolution).
export function badgeFor(target) {
  if (!target || !target.status) return null;

  if (target.completedAt) {
    return target.status === 'breached'
      ? { label: 'Missed', tone: 'breached' }
      : { label: 'Met', tone: 'on_track' };
  }

  return {
    on_track: { label: 'On track', tone: 'on_track' },
    at_risk: { label: 'At risk', tone: 'at_risk' },
    breached: { label: 'Overdue', tone: 'breached' },
  }[target.status];
}

const SEVERITY = { on_track: 0, at_risk: 1, breached: 2 };

// One badge summarising both targets, for compact places like ticket
// lists: the worse of the two while the ticket is open, Met/Missed once
// the resolution target is done.
export function slaSummary(sla) {
  const targets = [sla?.response, sla?.resolution].filter((t) => t && t.status);
  if (targets.length === 0) return null;

  const worst = targets.reduce((a, b) =>
    SEVERITY[b.status] > SEVERITY[a.status] ? b : a
  );

  if (sla.resolution?.completedAt) {
    return worst.status === 'breached'
      ? { label: 'Missed', tone: 'breached' }
      : { label: 'Met', tone: 'on_track' };
  }

  return badgeFor({ status: worst.status });
}
