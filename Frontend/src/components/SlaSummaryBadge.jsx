import { formatSlaDate, slaSummary } from '../utils/sla';

// Compact one-badge view of a ticket's targets, for ticket lists. Hover
// shows both due dates.
export default function SlaSummaryBadge({ sla }) {
  const badge = slaSummary(sla);
  if (!badge) return <span style={{ color: '#7b8794' }}>—</span>;

  const title =
    `Target (estimate) — first response: ${formatSlaDate(sla.response?.dueAt)}; ` +
    `resolution: ${formatSlaDate(sla.resolution?.dueAt)}`;

  return (
    <span className={`sla-badge sla-badge--${badge.tone}`} title={title}>
      {badge.label}
    </span>
  );
}
