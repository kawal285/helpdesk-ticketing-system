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
      // Resolution target. Computed from the sla_targets table on creation
      // and whenever the priority changes.
      dueAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      // First-response target, from the same table.
      responseDueAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // First comment or status change by an agent/admin. Null until then.
      firstRespondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
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

      // "Needs human check" handoff (utils/aiConfidence.js).
      needsHumanCheck: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      humanCheckReasons: {
        type: DataTypes.JSON,
        allowNull: true,
        // MariaDB returns JSON columns as strings.
        get() {
          const value = this.getDataValue('humanCheckReasons');
          return typeof value === 'string' ? JSON.parse(value) : value;
        },
      },
      aiPriorityConfidence: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      aiCategoryConfidence: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      humanCheckedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      humanCheckedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      humanCheckOutcome: {
        type: DataTypes.ENUM('confirmed', 'changed'),
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