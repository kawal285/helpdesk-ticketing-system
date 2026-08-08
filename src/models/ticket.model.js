'use strict';

const { CATEGORIES, PRIORITIES } = require('../utils/ticketFields');
const { STATUSES } = require('../utils/ticketStatus');

module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define(
    'Ticket',
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM(...CATEGORIES),
        allowNull: false,
        defaultValue: 'Other',
      },
      priority: {
        type: DataTypes.ENUM(...PRIORITIES),
        allowNull: false,
        defaultValue: 'Medium',
      },
      status: {
        type: DataTypes.ENUM(...STATUSES),
        allowNull: false,
        defaultValue: 'Open',
      },
      requesterId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assigneeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dueAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      aiCategory: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      aiPriority: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      aiSuggestedResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      aiAnalyzedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'tickets',
    }
  );

  Ticket.associate = (models) => {
    Ticket.belongsTo(models.User, { foreignKey: 'requesterId', as: 'requester' });
    Ticket.belongsTo(models.User, { foreignKey: 'assigneeId', as: 'assignee' });
    Ticket.hasMany(models.Comment, { foreignKey: 'ticketId', as: 'comments' });
  };

  return Ticket;
};
