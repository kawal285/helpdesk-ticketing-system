'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('kb_chunks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      // Metadata copied from the source article at chunk time. Denormalised
      // on purpose: the articles live in a JSON file, not a table, so there
      // is nothing to join to, and retrieval needs these values to build a
      // citation without a second lookup.
      articleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      articleTitle: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM(
          'Hardware',
          'Software',
          'Network',
          'Account',
          'Other'
        ),
        allowNull: false,
        defaultValue: 'Other',
      },
      audience: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'All',
      },
      heading: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      chunkIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // The text actually sent to the embedding model, including the
      // "Article title -- Heading" prefix. Stored verbatim so the exact
      // string that produced the vector is what gets shown to the LLM.
      text: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      // 768 floats as a JSON array. MySQL has no native vector type in the
      // version XAMPP ships, and at ~113 rows an approximate-nearest-
      // neighbour index would add infrastructure for no measurable gain.
      embedding: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      // Which model produced the vector, and how long it is. Vectors from
      // two different models are not comparable, and comparing them fails
      // silently rather than throwing -- these two columns are what let
      // retrieval detect the mismatch and refuse to run.
      embeddingModel: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      dimensions: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      // Hash of the chunk text. Lets re-indexing skip chunks whose content
      // has not changed, instead of re-embedding all 113 every time.
      contentHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
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

    await queryInterface.addIndex('kb_chunks', ['articleId'], {
      name: 'kb_chunks_article_id_idx',
    });

    await queryInterface.addIndex('kb_chunks', ['embeddingModel'], {
      name: 'kb_chunks_embedding_model_idx',
    });

    await queryInterface.addIndex('kb_chunks', ['contentHash'], {
      name: 'kb_chunks_content_hash_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('kb_chunks');
  },
};