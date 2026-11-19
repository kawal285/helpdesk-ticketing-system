'use strict';

// One AI assistant answer (see the migration for what each field is for).
module.exports = (sequelize, DataTypes) => {
  // MariaDB (XAMPP) returns JSON columns as strings.
  const json = (field) => ({
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const value = this.getDataValue(field);
      return typeof value === 'string' ? JSON.parse(value) : value;
    },
  });

  const AiInteraction = sequelize.define(
    'AiInteraction',
    {
      userId: { type: DataTypes.INTEGER, allowNull: true },
      channel: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'assistant' },
      // Stored with private details already removed.
      question: { type: DataTypes.TEXT, allowNull: false },
      outcome: {
        type: DataTypes.ENUM(
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
      // True when the knowledge base couldn't properly answer it.
      kbGap: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      topScore: { type: DataTypes.FLOAT, allowNull: true },
      threshold: { type: DataTypes.FLOAT, allowNull: true },
      topArticleId: { type: DataTypes.INTEGER, allowNull: true },
      suggestedCategory: { type: DataTypes.STRING(30), allowNull: true },
      webSources: json('webSources'),
      model: { type: DataTypes.STRING, allowNull: true },
      agent: { type: DataTypes.STRING(30), allowNull: true },
      embedding: json('embedding'),
      embeddingModel: { type: DataTypes.STRING, allowNull: true },
      // Set when staff add a KB article for this gap (or mark it covered).
      coveredAt: { type: DataTypes.DATE, allowNull: true },
      coveredById: { type: DataTypes.INTEGER, allowNull: true },
      coveredArticleId: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'ai_interactions',
      indexes: [{ fields: ['kbGap', 'createdAt'] }],
    }
  );

  AiInteraction.associate = (models) => {
    AiInteraction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return AiInteraction;
};
