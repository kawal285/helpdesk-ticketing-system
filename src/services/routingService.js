const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

// Picks the active agent with the fewest open/in-progress tickets. Must be
// called inside the same SERIALIZABLE transaction as the ticket insert (see
// ticket.controller.js) to reduce -- not fully eliminate -- the
// double-assignment race under concurrent ticket creation.
async function pickLeastBusyAgent(transaction) {
  const [agent] = await sequelize.query(
    `SELECT u.id, COUNT(t.id) AS openCount
     FROM users u
     LEFT JOIN tickets t ON t.assigneeId = u.id AND t.status IN ('Open', 'In Progress')
     WHERE u.role = 'agent' AND u.isActive = 1
     GROUP BY u.id
     ORDER BY openCount ASC, u.id ASC
     LIMIT 1`,
    { type: QueryTypes.SELECT, transaction }
  );

  return agent ? agent.id : null;
}

module.exports = { pickLeastBusyAgent };
