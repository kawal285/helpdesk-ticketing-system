'use strict';

// One row per AI assistant answer: what was asked, how it was answered,
// and whether the knowledge base could answer it. Used by the
// knowledge-gap report and shared with H6 (recording AI answers and
// staff corrections).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ai_interactions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      channel: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'assistant',
      },
      question: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      outcome: {
        type: Sequelize.ENUM(
          'kb',
          'kb_low_confidence',
          'web_only',
          'refused',
          'small_talk',
          'blocked',
          'escalated'
        ),
        allowNull: false,
      },
      kbGap: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      topScore: { type: Sequelize.FLOAT, allowNull: true },
      threshold: { type: Sequelize.FLOAT, allowNull: true },
      topArticleId: { type: Sequelize.INTEGER, allowNull: true },
      suggestedCategory: { type: Sequelize.STRING(30), allowNull: true },
      webSources: { type: Sequelize.JSON, allowNull: true },
      model: { type: Sequelize.STRING, allowNull: true },
      agent: { type: Sequelize.STRING(30), allowNull: true },
      embedding: { type: Sequelize.JSON, allowNull: true },
      embeddingModel: { type: Sequelize.STRING, allowNull: true },
      coveredAt: { type: Sequelize.DATE, allowNull: true },
      coveredById: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      coveredArticleId: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('ai_interactions', ['kbGap', 'createdAt']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ai_interactions');
  },
};
