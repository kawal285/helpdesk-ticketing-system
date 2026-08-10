'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('comments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      authorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('comments', ['ticketId'], { name: 'comments_ticket_id_idx' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('comments');
  },
};
