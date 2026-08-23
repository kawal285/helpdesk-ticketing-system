/*
 * Ingestion / indexing pipeline.
 *
 *   knowledgeBase.json -> chunker -> embedding provider -> kb_chunks
 *
 * Run this whenever the knowledge base changes:
 *   npm run kb:index            re-embed only what changed
 *   npm run kb:index -- --force re-embed everything from scratch
 *
 * Indexing is a separate job from querying. It runs ahead of time, not
 * per request: embedding 113 chunks takes about a minute, which nobody
 * would wait for while asking a question.
 */

require('dotenv').config();

const crypto = require('crypto');

const db = require('../../src/models');
const articles = require('../../src/data/knowledgeBase.json');
const { chunkArticles } = require('../../src/services/rag/chunker');
const {
  embedDocuments,
  getModelInfo,
} = require('../../src/services/rag/embeddingService');

const { KbChunk } = db;

const force = process.argv.includes('--force');

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function progressBar(done, total) {
  const width = 30;
  const filled = Math.round((done / total) * width);
  const bar = '#'.repeat(filled) + '-'.repeat(width - filled);

  process.stdout.write(`\r  [${bar}] ${done}/${total}`);

  if (done === total) {
    process.stdout.write('\n');
  }
}

async function main() {
  const model = getModelInfo();

  console.log('');
  console.log('Provider  :', model.name);
  console.log('Dimensions:', model.dimensions);
  console.log('');

  // 1. Build the chunks we want the database to end up holding.
  const chunks = chunkArticles(articles);

  console.log(`Articles  : ${articles.length}`);
  console.log(`Chunks    : ${chunks.length}`);

  const desired = new Map();

  for (const chunk of chunks) {
    desired.set(hash(chunk.text), chunk);
  }

  // 2. Find out what is already stored, and whether it is comparable.
  const stored = await KbChunk.findAll({
    attributes: ['id', 'contentHash', 'embeddingModel'],
    raw: true,
    logging: false,
  });

  const foreign = stored.filter((row) => row.embeddingModel !== model.name);

  if (foreign.length && !force) {
    console.log('');
    console.log(
      `${foreign.length} existing chunks were embedded with a different model.`
    );
    console.log(
      'Vectors from two models cannot be compared, so a partial update'
    );
    console.log('would corrupt retrieval. Re-run with --force to rebuild.');
    console.log('');

    await db.sequelize.close();
    process.exitCode = 1;
    return;
  }

  if (force && stored.length) {
    console.log(`\nRemoving ${stored.length} existing chunks (--force).`);
    await KbChunk.destroy({ where: {}, truncate: true, logging: false });
    stored.length = 0;
  }

  const existing = new Set(stored.map((row) => row.contentHash));

  // 3. Work out the difference in both directions.
  const toInsert = [...desired.entries()].filter(
    ([contentHash]) => !existing.has(contentHash)
  );

  const stale = stored.filter((row) => !desired.has(row.contentHash));

  console.log(`Unchanged : ${desired.size - toInsert.length}`);
  console.log(`New       : ${toInsert.length}`);
  console.log(`Stale     : ${stale.length}`);

  if (stale.length) {
    await KbChunk.destroy({
      where: { id: stale.map((row) => row.id) },
      logging: false,
    });
    console.log(`\nDeleted ${stale.length} stale chunks.`);
  }

  if (!toInsert.length) {
    console.log('\nNothing to embed. Index is up to date.\n');
    await db.sequelize.close();
    return;
  }

  // 4. Embed. This is the slow part and the only step that leaves the machine
  //    (or, with Ollama, the only step that loads the model).
  console.log(`\nEmbedding ${toInsert.length} chunks...`);

  const texts = toInsert.map(([, chunk]) => chunk.text);
  const vectors = await embedDocuments(texts, progressBar);

  console.log('Writing to database...');

  if (vectors.length !== texts.length) {
    throw new Error(
      `Provider returned ${vectors.length} vectors for ${texts.length} texts.`
    );
  }

  // 5. Write. The model name and length travel with every row so retrieval
  //    can detect a provider change instead of silently mis-scoring.
  const rows = toInsert.map(([contentHash, chunk], i) => ({
    articleId: chunk.articleId,
    articleTitle: chunk.articleTitle,
    category: chunk.category,
    audience: chunk.audience,
    heading: chunk.heading,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    embedding: vectors[i],
    embeddingModel: model.name,
    dimensions: vectors[i].length,
    contentHash,
  }));

  /*
   * Written in small batches rather than one statement. 113 embeddings in a
   * single INSERT is over a megabyte of SQL, which exceeds MySQL's default
   * max_allowed_packet -- the server responds by dropping the connection
   * (ECONNRESET) instead of returning a readable error.
   *
   * Logging is off because Sequelize would otherwise echo every vector to
   * the terminal.
   */
  const BATCH_SIZE = 10;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await KbChunk.bulkCreate(rows.slice(i, i + BATCH_SIZE), {
      validate: true,
      logging: false,
    });

    progressBar(Math.min(i + BATCH_SIZE, rows.length), rows.length);
  }

  const total = await KbChunk.count({ logging: false });

  console.log('');
  console.log(`Inserted  : ${rows.length}`);
  console.log(`Total rows: ${total}`);
  console.log('');
  console.log('Index built. Retrieval can now be tested.');
  console.log('');

  await db.sequelize.close();
}

main().catch(async (error) => {
  console.error('');
  console.error('Indexing failed:', error.message);

  try {
    await db.sequelize.close();
  } catch (ignored) {
    // already closed
  }

  process.exitCode = 1;
});