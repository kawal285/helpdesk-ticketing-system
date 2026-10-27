'use strict';

const { CATEGORIES, PRIORITIES, DEFAULT_PRIORITY } = require('../utils/ticketFields');
const { STATUSES } = require('../utils/ticketStatus');
const { ORGANIZATIONS } = require('../utils/organizations');

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
        defaultValue: DEFAULT_PRIORITY,
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
      // Copied from the requester's organization at creation time so tickets
      // stay filterable/reportable by org even if the requester's own
      // organization changes later.
      organization: {
        type: DataTypes.ENUM(...ORGANIZATIONS),
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

      
      emotion: {
        type: DataTypes.ENUM(
          'angry',
          'frustrated',
          'calm',
          'neutral'
        ),
        allowNull: true,
      },
      emotionReason: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      emotionAnalyzedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      room: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      parentCaseId: {
        type: DataTypes.INTEGER,
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
    Ticket.belongsTo(models.Ticket, { foreignKey: 'parentCaseId', as: 'parentCase' });
    Ticket.hasMany(models.Ticket, { foreignKey: 'parentCaseId', as: 'childCases' });
  };

  return Ticket;
};