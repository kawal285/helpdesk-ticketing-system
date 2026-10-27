
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tickets', 'emotion', {
      type: Sequelize.ENUM(
        'angry',
        'frustrated',
        'calm',
        'neutral'
      ),
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'emotionReason', {
      type: Sequelize.STRING(250),
      allowNull: true,
    });

    await queryInterface.addColumn('tickets', 'emotionAnalyzedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn(
      'tickets',
      'emotionAnalyzedAt'
    );

    await queryInterface.removeColumn(
      'tickets',
      'emotionReason'
    );

    await queryInterface.removeColumn(
      'tickets',
      'emotion'
    );
  },
};
