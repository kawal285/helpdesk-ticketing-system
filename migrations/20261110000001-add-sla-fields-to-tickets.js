'use strict';

// Adds the response target to tickets. The existing `dueAt` column already
// holds the resolution target, so it stays as is.
//
// Backfill uses the default response minutes (the sla_targets seeder runs
// after migrations, so the table may still be empty here). It also marks
// existing tickets as responded-to at their earliest agent/admin comment.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'responseDueAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'firstRespondedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE tickets SET responseDueAt = DATE_ADD(createdAt, INTERVAL (
        CASE priority
          WHEN 'Critical' THEN 15
          WHEN 'High' THEN 60
          WHEN 'Medium' THEN 240
          WHEN 'Low' THEN 480
          ELSE 1440
        END
      ) MINUTE)
    `);

    await queryInterface.sequelize.query(`
      UPDATE tickets t SET firstRespondedAt = (
        SELECT MIN(c.createdAt)
        FROM comments c
        JOIN users u ON u.id = c.authorId
        WHERE c.ticketId = t.id
          AND u.role IN ('agent', 'admin')
          AND c.authorId <> t.requesterId
      )
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('tickets', 'firstRespondedAt');
    await queryInterface.removeColumn('tickets', 'responseDueAt');
  },
};
