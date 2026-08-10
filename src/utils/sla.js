// Ported verbatim from the original server.js prototype.
const SLA_HOURS = { Critical: 4, High: 8, Medium: 24, Low: 72 };

function computeDueAt(priority, createdAt) {
  const hours = SLA_HOURS[priority] || 24;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

module.exports = { SLA_HOURS, computeDueAt };
