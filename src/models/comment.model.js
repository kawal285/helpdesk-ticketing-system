'use strict';

module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define(
    'Comment',
    {
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: { notEmpty: true },
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      authorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'comments',
    }
  );

  Comment.associate = (models) => {
    Comment.belongsTo(models.Ticket, { foreignKey: 'ticketId', as: 'ticket' });
    Comment.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
  };

  return Comment;
};
