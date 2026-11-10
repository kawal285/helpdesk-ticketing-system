'use strict';

const { DEFAULT_SLA_TARGETS } = require('../src/utils/sla');

// Inserts only the priorities that don't have a row yet, so re-running the
// seeders never overwrites targets an admin has since changed.
module.exports = {
  up: async (queryInterface) => {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT priority FROM sla_targets'
    );
    const seeded = new Set(existing.map((row) => row.priority));
    const now = new Date();

    const rows = Object.entries(DEFAULT_SLA_TARGETS)
      .filter(([priority]) => !seeded.has(priority))
      .map(([priority, target]) => ({
        priority,
        responseMinutes: target.responseMinutes,
        resolutionMinutes: target.resolutionMinutes,
        createdAt: now,
        updatedAt: now,
      }));

    if (rows.length) {
      await queryInterface.bulkInsert('sla_targets', rows);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('sla_targets', null, {});
  },
};
