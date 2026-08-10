'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tickets', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM('Hardware', 'Software', 'Network', 'Account', 'Other'),
        allowNull: false,
        defaultValue: 'Other',
      },
      priority: {
        type: Sequelize.ENUM('Low', 'Medium', 'High', 'Critical'),
        allowNull: false,
        defaultValue: 'Medium',
      },
      status: {
        type: Sequelize.ENUM('Open', 'In Progress', 'Resolved', 'Closed'),
        allowNull: false,
        defaultValue: 'Open',
      },
      requesterId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      assigneeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      dueAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      aiCategory: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aiPriority: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aiSuggestedResponse: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      aiAnalyzedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('tickets', ['status'], { name: 'tickets_status_idx' });
    await queryInterface.addIndex('tickets', ['assigneeId'], { name: 'tickets_assignee_id_idx' });
    await queryInterface.addIndex('tickets', ['requesterId'], { name: 'tickets_requester_id_idx' });
    await queryInterface.addIndex('tickets', ['status', 'dueAt'], { name: 'tickets_status_due_at_idx' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('tickets');
  },
};
