'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sla_targets', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('Trivial', 'Low', 'Medium', 'High', 'Critical'),
        allowNull: false,
        unique: true,
      },
      responseMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      resolutionMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('sla_targets');
  },
};
