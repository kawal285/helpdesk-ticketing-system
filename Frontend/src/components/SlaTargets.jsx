// Shows a ticket's response and resolution targets with their status.
// These are estimates from the priority's target times -- wording must never
// promise when an issue will actually be fixed.
import { badgeFor, formatSlaDate } from '../utils/sla';

function TargetLine({ name, target }) {
  const badge = badgeFor(target);

  return (
    <div className="sla-target-line">
      <span className="sla-target-name">{name}</span>
      <span>{formatSlaDate(target?.dueAt)}</span>
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
