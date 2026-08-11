'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'initialFeeling', {
      type: Sequelize.ENUM('Calm', 'Concerned', 'Frustrated', 'Urgent'),
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'origin', {
      type: Sequelize.ENUM('Portal', 'Email', 'Phone', 'Walk-in'),
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'location', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'studentLivingVillageResident', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('tickets', 'opsvDefect', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('tickets', 'parentCaseId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'tickets', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('tickets', 'parentCaseId');
    await queryInterface.removeColumn('tickets', 'opsvDefect');
    await queryInterface.removeColumn('tickets', 'studentLivingVillageResident');
    await queryInterface.removeColumn('tickets', 'location');
    await queryInterface.removeColumn('tickets', 'origin');
    await queryInterface.removeColumn('tickets', 'initialFeeling');
  },
};