'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'organization', {
      type: Sequelize.ENUM('Future Skills', 'OP'),
      allowNull: false,
      defaultValue: 'Future Skills',
    });

    await queryInterface.addIndex('tickets', ['organization'], { name: 'tickets_organization_idx' });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('tickets', 'tickets_organization_idx');
    await queryInterface.removeColumn('tickets', 'organization');
  },
};
