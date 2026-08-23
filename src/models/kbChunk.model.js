'use strict';

module.exports = (sequelize, DataTypes) => {
  const KbChunk = sequelize.define(
    'KbChunk',
    {
      articleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      articleTitle: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM(
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
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'All',
      },
      heading: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      chunkIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: { notEmpty: true },
      },
      embedding: {
        type: DataTypes.JSON,
        allowNull: false,
        validate: {
          isVectorOfNumbers(value) {
            if (!Array.isArray(value) || value.length === 0) {
              throw new Error('embedding must be a non-empty array.');
            }

            if (value.some((n) => typeof n !== 'number' || !isFinite(n))) {
              throw new Error('embedding must contain only finite numbers.');
            }
          },
        },
      },
      embeddingModel: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      dimensions: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      contentHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
    },
    {
      tableName: 'kb_chunks',
      validate: {
        // Catches a vector whose length disagrees with its own declared
        // dimension count -- a sign the provider config changed mid-run.
        dimensionsMatchEmbedding() {
          if (
            Array.isArray(this.embedding) &&
            this.embedding.length !== this.dimensions
          ) {
            throw new Error(
              `dimensions (${this.dimensions}) does not match embedding length (${this.embedding.length}).`
            );
          }
        },
      },
    }
  );

  return KbChunk;
};