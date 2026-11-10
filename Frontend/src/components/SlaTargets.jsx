// Shows a ticket's response and resolution targets with their status.
// These are estimates from the priority's target times -- wording must never
// promise when an issue will actually be fixed.

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function badgeFor(target) {
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

function TargetLine({ name, target }) {
  const badge = badgeFor(target);

  return (
    <div className="sla-target-line">
      <span className="sla-target-name">{name}</span>
      <span>{formatDate(target?.dueAt)}</span>
      {badge && (
        <span className={`sla-badge sla-badge--${badge.tone}`}>{badge.label}</span>
      )}
    </div>
  );
}

export default function SlaTargets({ sla }) {
  return (
    <div className="sla-targets">
      <TargetLine name="First response" target={sla?.response} />
      <TargetLine name="Resolution" target={sla?.resolution} />
      <p className="sla-targets-note">
        Estimated from the ticket's priority. Actual times may vary.
      </p>
    </div>
  );
}
