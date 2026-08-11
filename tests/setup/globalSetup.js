// Runs once before the whole suite, in its own process/module registry --
// resets the dedicated test database (config/config.js "test" block) so
// every run starts from a known, empty schema.
module.exports = async function globalSetup() {
  const { sequelize } = require('../../src/models');
  await sequelize.sync({ force: true });
  await sequelize.close();
};
