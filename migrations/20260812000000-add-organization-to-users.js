'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'organization', {
      type: Sequelize.ENUM('Future Skills', 'OP'),
      allowNull: false,
      defaultValue: 'Future Skills',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'organization');
  },
};
