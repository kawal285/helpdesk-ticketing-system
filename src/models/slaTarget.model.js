'use strict';

const { PRIORITIES } = require('../utils/ticketFields');

// One row per ticket priority: how long the desk has to first respond to a
// ticket, and how long to resolve it. Read when a ticket is created or its
// priority changes -- see src/services/slaTargetService.js.
module.exports = (sequelize, DataTypes) => {
  const SlaTarget = sequelize.define(
    'SlaTarget',
    {
      priority: {
        type: DataTypes.ENUM(...PRIORITIES),
        allowNull: false,
        unique: true,
      },
      responseMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      resolutionMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
    },
    {
      tableName: 'sla_targets',
    }
  );

  return SlaTarget;
};
