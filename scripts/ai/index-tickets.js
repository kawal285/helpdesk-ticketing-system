/*
 * Embeds every existing ticket so "Similar open tickets" works straight
 * away for tickets created before the feature existed. Safe to run
 * again: tickets whose text hasn't changed are skipped.
 *
 *   node scripts/ai/index-tickets.js
 */

require('dotenv').config({ quiet: true });

const { Ticket, sequelize } = require('../../src/models');
const { ensureEmbeddings } = require('../../src/services/similarTicketService');

const BATCH = 50;

async function run() {
  const total = await Ticket.count();
  console.log(`Embedding ${total} tickets...`);

  for (let offset = 0; offset < total; offset += BATCH) {
    const tickets = await Ticket.findAll({
      attributes: ['id', 'title', 'description'],
      order: [['id', 'ASC']],
      limit: BATCH,
      offset,
      raw: true,
    });
    await ensureEmbeddings(tickets);
    console.log(`  ${Math.min(offset + BATCH, total)}/${total}`);
  }

  console.log('Done.');
}

run()
  .catch((error) => {
    console.error('Indexing failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
