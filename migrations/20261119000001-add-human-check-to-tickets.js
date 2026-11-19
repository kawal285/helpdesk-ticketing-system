'use strict';

// "Needs human check": set when the AI was not sure of a ticket's
// priority or category (or couldn't classify it), cleared when staff
// check it. The reasons and outcome are kept so we can report how often
// tickets are handed to a person and whether that was the right call.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'needsHumanCheck', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('tickets', 'humanCheckReasons', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('tickets', 'aiPriorityConfidence', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('tickets', 'aiCategoryConfidence', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn('tickets', 'humanCheckedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('tickets', 'humanCheckedById', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    // 'confirmed' = staff kept the AI's answer, 'changed' = staff changed it.
    await queryInterface.addColumn('tickets', 'humanCheckOutcome', {
      type: Sequelize.ENUM('confirmed', 'changed'),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    for (const column of [
      'humanCheckOutcome',
      'humanCheckedById',
      'humanCheckedAt',
      'aiCategoryConfidence',
      'aiPriorityConfidence',
      'humanCheckReasons',
      'needsHumanCheck',
    ]) {
      await queryInterface.removeColumn('tickets', column);
    }
  },
};
