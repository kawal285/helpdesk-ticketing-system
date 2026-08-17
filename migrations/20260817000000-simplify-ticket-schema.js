'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the CRM form fields that are no longer needed
    await queryInterface.removeColumn('tickets', 'initialFeeling');
    await queryInterface.removeColumn('tickets', 'origin');
    await queryInterface.removeColumn('tickets', 'studentLivingVillageResident');
    await queryInterface.removeColumn('tickets', 'opsvDefect');

    // Rename location to room
    await queryInterface.renameColumn('tickets', 'location', 'room');

    // Change the priority enum to include Trivial and update the default
    await queryInterface.sequelize.query(
      `ALTER TABLE tickets MODIFY COLUMN priority ENUM('Trivial', 'Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Trivial'`
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Note: Data in the dropped columns (initialFeeling, origin, etc.) cannot be restored.
    // This migration is destructive and only appropriate for development/staging environments.

    // Revert the priority enum and default
    await queryInterface.sequelize.query(
      `ALTER TABLE tickets MODIFY COLUMN priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium'`
    );

    // Rename room back to location
    await queryInterface.renameColumn('tickets', 'room', 'location');

    // Recreate the removed columns with their original types
    await queryInterface.addColumn('tickets', 'opsvDefect', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('tickets', 'studentLivingVillageResident', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('tickets', 'origin', {
      type: Sequelize.ENUM('Portal', 'Email', 'Phone', 'Walk-in'),
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'initialFeeling', {
      type: Sequelize.ENUM('Calm', 'Concerned', 'Frustrated', 'Urgent'),
      allowNull: true,
    });
  },
};
