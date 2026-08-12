'use strict';

const { ORGANIZATIONS } = require('../utils/organizations');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      name: { type: DataTypes.STRING, allowNull: false },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: {
        type: DataTypes.ENUM('admin', 'agent', 'customer'),
        allowNull: false,
        defaultValue: 'customer',
      },
      organization: {
        type: DataTypes.ENUM(...ORGANIZATIONS),
        allowNull: false,
        defaultValue: ORGANIZATIONS[0],
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'users',
      defaultScope: {
        attributes: { exclude: ['passwordHash'] },
      },
      scopes: {
        withPassword: { attributes: {} },
      },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Ticket, { foreignKey: 'requesterId', as: 'requestedTickets' });
    User.hasMany(models.Ticket, { foreignKey: 'assigneeId', as: 'assignedTickets' });
    User.hasMany(models.Comment, { foreignKey: 'authorId', as: 'comments' });
  };

  return User;
};