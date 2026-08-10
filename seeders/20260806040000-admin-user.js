'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface) => {
    const name = process.env.ADMIN_NAME || 'Admin';
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before running the admin seeder.'
      );
    }

    const [[existing]] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email',
      { replacements: { email } }
    );
    if (existing) return; // already seeded, don't error out on re-run

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        name,
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    const email = process.env.ADMIN_EMAIL;
    if (!email) return;
    await queryInterface.bulkDelete('users', { email });
  },
};
