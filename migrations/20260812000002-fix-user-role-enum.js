'use strict';

// The users.role column had drifted out of sync with the original migration
// (which correctly declares ENUM('admin','agent','customer')) -- some
// environments ended up with ENUM('user','staff') instead, matching a since
// -fixed bug in user.model.js, leaving existing rows with values ('user',
// or blank) that don't fit the real enum. Back those rows to 'customer'
// (self-registration's forced default) before tightening the column back to
// the enum every access check in the app actually relies on.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Widen to a plain string first: writing 'customer' into a column still
    // typed ENUM('user','staff') is itself an invalid value for that enum,
    // and MySQL silently truncates it to '' in non-strict mode rather than
    // erroring -- so the backfill has to happen once the column can actually
    // hold the target values.
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'customer',
    });

    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'customer' WHERE role NOT IN ('admin', 'agent', 'customer')`
    );

    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('admin', 'agent', 'customer'),
      allowNull: false,
      defaultValue: 'customer',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('user', 'staff'),
      allowNull: false,
      defaultValue: 'user',
    });
  },
};
