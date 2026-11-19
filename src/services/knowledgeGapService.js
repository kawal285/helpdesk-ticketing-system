/*
 * Knowledge-gap report (Knowledge-Centered Service): every assistant
 * answer is logged, and questions the knowledge base couldn't answer
 * (refused, answered only from the web, or only a weak match) are grouped
 * into topics so staff can see which articles to write next. A topic is
 * "covered" once staff save an article for it -- for example a web result
 * via the existing "save web result to KB" feature.
 *
 * Questions are grouped with the same embeddings as the knowledge-base
 * search: each question joins the topic whose average it is closest to,
 * if that is at least the grouping threshold, otherwise it starts a new
 * topic. See docs/knowledge-gaps.md for how the threshold was chosen.
 */

const { Op } = require('sequelize');
const { AiInteraction } = require('../models');
const { embedDocuments, getModelInfo } = require('./rag/embeddingService');
const { cosineSimilarity, normalise } = require('./rag/similarity');
const { redact } = require('../utils/privacy');

const DEFAULT_GROUP_THRESHOLD = 0.68;
const DEFAULT_DAYS = 30;
const MAX_GAP_ROWS = 1000;
const GAP_OUTCOMES = ['refused', 'web_only', 'kb_low_confidence'];

function groupThreshold() {
  const value = Number(process.env.KB_GAP_GROUP_THRESHOLD);
  return value > 0 && value < 1 ? value : DEFAULT_GROUP_THRESHOLD;
}

/*
 * How an assistant response was answered, from what assistUser returns.
 */
function outcomeOf(response) {
  if (response.blocked) return 'blocked';
  if (response.safetyEscalation) return 'escalated';
  if (response.smallTalk) return 'small_talk';
  if (!response.knowledgeBaseMatch) return 'refused';

  const sources = response.sources || [];
  const fromKb = sources.some((s) => s.type !== 'web');
  if (!fromKb) return 'web_only';
  if (response.needsHumanCheck) return 'kb_low_confidence';
  return 'kb';
}

/*
 * Saves one assistant answer. Never throws: logging must never break
 * the assistant for the user.
 */
async function logAssistantAnswer(user, response) {
  try {
    const outcome = outcomeOf(response);
    const webSources = (response.sources || [])
      .filter((s) => s.type === 'web')
      .map(({ title, url, snippet }) => ({ title, url, snippet }));

    return await AiInteraction.create({
      userId: user ? user.id : null,
      channel: 'assistant',
      question: redact(String(response.question || '')).slice(0, 2000),
      outcome,
      kbGap: GAP_OUTCOMES.includes(outcome),
      topScore: typeof response.topScore === 'number' ? response.topScore : null,
      threshold: typeof response.threshold === 'number' ? response.threshold : null,
      topArticleId: response.source ? response.source.id : null,
      suggestedCategory: response.suggestedCategory || null,
      webSources: webSources.length ? webSources : null,
      model: response.model || null,
      agent: response.agent || null,
    });
  } catch (error) {
    console.warn(`[knowledge-gaps] could not log an assistant answer: ${error.message}`);
    return null;
  }
}

// Embeds any gap questions that don't have an embedding from the current
// model yet, and stores it.
async function ensureEmbeddings(rows) {
  const model = getModelInfo().name;
  const missing = rows.filter((row) => !row.embedding || row.embeddingModel !== model);

  if (missing.length > 0) {
    const vectors = await embedDocuments(missing.map((row) => row.question));
    await Promise.all(
      missing.map((row, i) => {
        row.embedding = vectors[i];
        row.embeddingModel = model;
        return row.save({ fields: ['embedding', 'embeddingModel'] });
      })
    );
  }

  return rows;
}

function average(vectors) {
  const sum = new Array(vectors[0].length).fill(0);
  for (const v of vectors) for (let i = 0; i < v.length; i += 1) sum[i] += v[i];
  return normalise(sum.map((x) => x / vectors.length));
}

/*
 * Groups items ({ vector, ... }) into topics: each joins the closest
 * existing topic (by its average vector) at or above `threshold`,
 * otherwise starts a new one. Pure, so it can be tested on its own.
 */
function groupByTopic(items, threshold) {
  const topics = [];

  for (const item of items) {
    let best = null;
    let bestScore = -1;
    for (const topic of topics) {
      const score = cosineSimilarity(item.vector, topic.centroid);
      if (score > bestScore) {
        best = topic;
        bestScore = score;
      }
    }

    if (best && bestScore >= threshold) {
      best.items.push(item);
      best.centroid = average(best.items.map((i) => i.vector));
    } else {
      topics.push({ items: [item], centroid: item.vector });
    }
  }

  return topics;
}

/*
 * The report: the top unanswered topics, most asked first.
 */
async function knowledgeGapReport({ days = DEFAULT_DAYS, limit = 10, includeCovered = false } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [asked, gapCount] = await Promise.all([
    AiInteraction.count({ where: { createdAt: { [Op.gte]: since }, outcome: { [Op.notIn]: ['small_talk', 'blocked'] } } }),
    AiInteraction.count({ where: { kbGap: true, createdAt: { [Op.gte]: since } } }),
  ]);

  const byOutcome = {};
  (
    await AiInteraction.count({
      where: { createdAt: { [Op.gte]: since } },
      group: ['outcome'],
    })
  ).forEach(({ outcome, count }) => {
    byOutcome[outcome] = count;
  });

  const rows = await AiInteraction.findAll({
    where: {
      kbGap: true,
      createdAt: { [Op.gte]: since },
      ...(includeCovered ? {} : { coveredAt: null }),
    },
    order: [['createdAt', 'DESC']],
    limit: MAX_GAP_ROWS,
  });

  await ensureEmbeddings(rows);

  // Oldest first, so a topic's first question is the one that started it.
  const items = rows
    .slice()
    .reverse()
    .map((row) => ({ row, vector: row.embedding }));
  const topics = groupByTopic(items, groupThreshold());

  const report = topics
    .map((topic) => {
      const topicRows = topic.items.map((i) => i.row);
      // The question closest to the topic's average names the topic.
      const label = topic.items
        .map((i) => ({ q: i.row.question, s: cosineSimilarity(i.vector, topic.centroid) }))
        .sort((a, b) => b.s - a.s)[0].q;

      const webByUrl = new Map();
      topicRows.forEach((row) =>
        (row.webSources || []).forEach((source) => {
          const entry = webByUrl.get(source.url) || { ...source, timesShown: 0 };
          entry.timesShown += 1;
          webByUrl.set(source.url, entry);
        })
      );

      const outcomes = {};
      topicRows.forEach((row) => {
        outcomes[row.outcome] = (outcomes[row.outcome] || 0) + 1;
      });

      const categories = {};
      topicRows.forEach((row) => {
        if (row.suggestedCategory) categories[row.suggestedCategory] = (categories[row.suggestedCategory] || 0) + 1;
      });
      const category = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];

      return {
        topic: label,
        timesAsked: topicRows.length,
        askedBy: new Set(topicRows.map((r) => r.userId).filter(Boolean)).size,
        lastAskedAt: topicRows.reduce((a, r) => (r.createdAt > a ? r.createdAt : a), topicRows[0].createdAt),
        outcomes,
        suggestedCategory: category ? category[0] : null,
        exampleQuestions: [...new Set(topicRows.map((r) => r.question))].slice(0, 3),
        webSources: [...webByUrl.values()].sort((a, b) => b.timesShown - a.timesShown).slice(0, 3),
        interactionIds: topicRows.map((r) => r.id),
        covered: topicRows.every((r) => r.coveredAt),
      };
    })
    .sort((a, b) => b.timesAsked - a.timesAsked || new Date(b.lastAskedAt) - new Date(a.lastAskedAt))
    .slice(0, limit);

  return {
    days,
    since,
    questionsAsked: asked,
    gapQuestions: gapCount,
    gapRate: asked ? Number((gapCount / asked).toFixed(3)) : 0,
    byOutcome,
    groupThreshold: groupThreshold(),
    topics: report,
  };
}

/*
 * Marks a topic's questions as covered, e.g. after staff saved a KB
 * article for it.
 */
async function markCovered(interactionIds, user, articleId = null) {
  const [updated] = await AiInteraction.update(
    {
      coveredAt: new Date(),
      coveredById: user.id,
      coveredArticleId: articleId != null ? String(articleId) : null,
    },
    { where: { id: interactionIds, kbGap: true, coveredAt: null } }
  );
  return updated;
}

module.exports = {
  outcomeOf,
  logAssistantAnswer,
  groupByTopic,
  knowledgeGapReport,
  markCovered,
  GAP_OUTCOMES,
  DEFAULT_GROUP_THRESHOLD,
};
