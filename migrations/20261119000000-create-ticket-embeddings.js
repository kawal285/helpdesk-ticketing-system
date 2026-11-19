'use strict';

// One embedding per ticket, kept out of the tickets table so ticket
// lists never carry 768 numbers per row.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ticket_embeddings', {
      ticketId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'tickets', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      embedding: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      embeddingModel: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      dimensions: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      contentHash: {
        type: Sequelize.STRING(64),
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
    await queryInterface.dropTable('ticket_embeddings');
  },
};
