'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('admin', 'agent', 'customer'),
        allowNull: false,
        defaultValue: 'customer',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'users',
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Ticket, { foreignKey: 'requesterId', as: 'requestedTickets' });
    User.hasMany(models.Ticket, { foreignKey: 'assigneeId', as: 'assignedTickets' });
    // Comment association is added once that model exists (see Commit 6).
  };

  return User;
};
