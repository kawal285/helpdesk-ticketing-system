'use strict';

// The embedding of a ticket's title and description, used to find
// similar (possibly duplicate) open tickets. contentHash records which
// text and model produced it, so it is only recomputed when one changes.
module.exports = (sequelize, DataTypes) => {
  const TicketEmbedding = sequelize.define(
    'TicketEmbedding',
    {
      ticketId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      embedding: {
        type: DataTypes.JSON,
        allowNull: false,
        // MariaDB (XAMPP) keeps JSON as LONGTEXT and hands it back as a
        // string, so always return the vector as an array.
        get() {
          const value = this.getDataValue('embedding');
          return typeof value === 'string' ? JSON.parse(value) : value;
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
    { tableName: 'ticket_embeddings' }
  );

  TicketEmbedding.associate = (models) => {
    TicketEmbedding.belongsTo(models.Ticket, {
      foreignKey: 'ticketId',
      as: 'ticket',
      onDelete: 'CASCADE',
    });
  };

  return TicketEmbedding;
};
