/*
 * Knowledge-gap report: every assistant answer is logged, and questions
 * the knowledge base couldn't answer are grouped into topics for admins.
 */

jest.mock('../src/services/rag/retrievalService');
jest.mock('../src/services/rag/webSearchService');
jest.mock('../src/services/rag/generationService', () => ({
  generate: jest.fn(),
  generateWithAgent: jest.fn().mockResolvedValue({
    content: 'Here is what to do.',
    agent: 'main',
    provider: 'ollama',
    model: 'test',
    fellBack: false,
  }),
  getModelInfo: jest.fn().mockReturnValue({ name: 'ollama:test' }),
}));

// Word-count vectors: questions sharing words land close together.
jest.mock('../src/services/rag/embeddingService', () => {
  const STOP = new Set(['how', 'do', 'i', 'the', 'a', 'to', 'my', 'for', 'on', 'can', 'is', 'where', 'get', 'what']);
  const DIMS = 256;
  const hash = (w) => [...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % DIMS, 7);
  const vectorFor = (text) => {
    const v = new Array(DIMS).fill(0);
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP.has(w))
      .forEach((w) => {
        v[hash(w)] += 1;
      });
    const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / len);
  };
  return {
    embedDocuments: jest.fn(async (texts) => texts.map(vectorFor)),
    embedQuery: jest.fn(async (t) => vectorFor(t)),
    getModelInfo: jest.fn(() => ({ provider: 'test', name: 'test:words', dimensions: DIMS })),
  };
});

const request = require('supertest');
const app = require('../src/app');
const { sequelize, AiInteraction } = require('../src/models');
const { retrieve } = require('../src/services/rag/retrievalService');
const webSearchService = require('../src/services/rag/webSearchService');
const { outcomeOf, groupByTopic } = require('../src/services/knowledgeGapService');
const { createUserWithToken } = require('./helpers/testHelpers');

process.env.KB_GAP_GROUP_THRESHOLD = '0.5';

afterAll(async () => {
  delete process.env.KB_GAP_GROUP_THRESHOLD;
  await sequelize.close();
});

const KB_MATCH = {
  id: 1,
  articleId: 4,
  articleTitle: 'Wi-Fi',
  category: 'Network',
  heading: 'Connect',
  text: 'Pick the campus network.',
};
const retrieval = (score, hasKb) => ({
  question: 'q',
  topScore: score,
  threshold: 0.59,
  matches: hasKb ? [{ ...KB_MATCH, score }] : [],
  relevant: hasKb ? [{ ...KB_MATCH, score }] : [],
  hasRelevantContext: hasKb,
  searched: 10,
});
const WEB = { title: 'Plotter drivers', url: 'https://example.com/plotter', snippet: 'Download the driver.' };

function ask(token, question) {
  return request(app).post('/ai/assist').set('Authorization', `Bearer ${token}`).send({ question });
}

async function lastLog(userId) {
  return AiInteraction.findOne({ where: { userId }, order: [['id', 'DESC']] });
}

describe('every assistant answer is logged', () => {
  beforeEach(() => {
    webSearchService.search.mockResolvedValue({ results: [], provider: 'none' });
  });

  it('a question the KB answers well is logged, but not as a gap', async () => {
    retrieve.mockResolvedValue(retrieval(0.85, true));
    const { user, token } = await createUserWithToken({ role: 'customer' });

    const res = await ask(token, 'How do I connect to the Wi-Fi?');

    expect(res.status).toBe(200);
    expect(await lastLog(user.id)).toMatchObject({ outcome: 'kb', kbGap: false, topArticleId: 4 });
  });

  it('a refused question is logged as a gap', async () => {
    retrieve.mockResolvedValue(retrieval(0.4, false));
    const { user, token } = await createUserWithToken({ role: 'customer' });

    await ask(token, 'How do I get a parking permit?');

    expect(await lastLog(user.id)).toMatchObject({ outcome: 'refused', kbGap: true, topScore: 0.4 });
  });

  it('a question answered only from the web is a gap, and keeps the web result', async () => {
    retrieve.mockResolvedValue(retrieval(0.4, false));
    webSearchService.search.mockResolvedValue({ results: [WEB], provider: 'duckduckgo' });
    const { user, token } = await createUserWithToken({ role: 'customer' });

    await ask(token, 'Where do I get the plotter driver?');

    const row = await lastLog(user.id);
    expect(row).toMatchObject({ outcome: 'web_only', kbGap: true });
    expect(row.webSources).toEqual([WEB]);
  });

  it('a weak KB match is a gap too', async () => {
    retrieve.mockResolvedValue(retrieval(0.6, true));
    const { user, token } = await createUserWithToken({ role: 'customer' });

    await ask(token, 'wifi thing');

    expect(await lastLog(user.id)).toMatchObject({ outcome: 'kb_low_confidence', kbGap: true });
  });

  it('stores the question with private details removed', async () => {
    retrieve.mockResolvedValue(retrieval(0.4, false));
    const { user, token } = await createUserWithToken({ role: 'customer' });

    await ask(token, 'My login jo.smith@example.co.nz with password: Hunter22 fails');

    const row = await lastLog(user.id);
    expect(row.question).not.toContain('jo.smith@example.co.nz');
    expect(row.question).not.toContain('Hunter22');
  });

  it('the assistant still answers if logging fails', async () => {
    retrieve.mockResolvedValue(retrieval(0.85, true));
    const spy = jest.spyOn(AiInteraction, 'create').mockRejectedValueOnce(new Error('db down'));
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await ask(token, 'How do I connect to the Wi-Fi?');

    expect(res.status).toBe(200);
    spy.mockRestore();
  });
});

describe('outcomeOf', () => {
  it.each([
    [{ blocked: 'prompt_injection' }, 'blocked'],
    [{ safetyEscalation: true }, 'escalated'],
    [{ smallTalk: true, knowledgeBaseMatch: false }, 'small_talk'],
    [{ knowledgeBaseMatch: false }, 'refused'],
    [{ knowledgeBaseMatch: true, sources: [{ type: 'web' }] }, 'web_only'],
    [{ knowledgeBaseMatch: true, sources: [{ type: 'knowledge_base' }], needsHumanCheck: true }, 'kb_low_confidence'],
    [{ knowledgeBaseMatch: true, sources: [{ type: 'knowledge_base' }, { type: 'web' }] }, 'kb'],
  ])('%j -> %s', (response, expected) => {
    expect(outcomeOf(response)).toBe(expected);
  });
});

describe('groupByTopic', () => {
  const v = (x, y) => {
    const len = Math.hypot(x, y);
    return [x / len, y / len];
  };

  it('puts close questions together and starts a new topic for a far one', () => {
    const topics = groupByTopic(
      [
        { id: 'a', vector: v(1, 0) },
        { id: 'b', vector: v(0.95, 0.1) },
        { id: 'c', vector: v(0, 1) },
      ],
      0.9
    );

    expect(topics.map((t) => t.items.map((i) => i.id))).toEqual([['a', 'b'], ['c']]);
  });
});

describe('GET /knowledge-gaps (admin report)', () => {
  // Start from an empty log so questions asked earlier in this file
  // (some of them about plotter drivers too) don't join these topics.
  beforeEach(async () => {
    await AiInteraction.destroy({ where: {} });
  });

  async function seedGaps(rows) {
    const created = [];
    for (const row of rows) {
      created.push(
        await AiInteraction.create({
          question: row.q,
          outcome: row.outcome || 'refused',
          kbGap: true,
          userId: row.userId || null,
          webSources: row.web || null,
          suggestedCategory: row.category || null,
        })
      );
    }
    return created;
  }

  function findTopic(report, word) {
    return report.topics.find((t) => t.exampleQuestions.some((q) => q.toLowerCase().includes(word)));
  }

  it('groups unanswered questions into topics, most asked first', async () => {
    const { user: u1 } = await createUserWithToken({ role: 'customer' });
    const { user: u2 } = await createUserWithToken({ role: 'customer' });
    const { token: admin } = await createUserWithToken({ role: 'admin' });
    await seedGaps([
      { q: 'zebraplot plotter driver download', userId: u1.id, web: [WEB], outcome: 'web_only' },
      { q: 'install zebraplot plotter driver', userId: u2.id, web: [WEB], outcome: 'web_only' },
      { q: 'zebraplot plotter driver mac', userId: u1.id },
      { q: 'qwopark parking permit apply', userId: u2.id },
    ]);

    const res = await request(app).get('/knowledge-gaps?limit=50').set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    const plotter = findTopic(res.body.report, 'zebraplot');
    const parking = findTopic(res.body.report, 'qwopark');
    expect(plotter.timesAsked).toBe(3);
    expect(plotter.askedBy).toBe(2);
    expect(plotter.outcomes).toEqual({ web_only: 2, refused: 1 });
    expect(plotter.webSources[0]).toMatchObject({ url: WEB.url, timesShown: 2 });
    expect(parking.timesAsked).toBe(1);
    expect(plotter).not.toBe(parking);
    const order = res.body.report.topics;
    expect(order.indexOf(plotter)).toBeLessThan(order.indexOf(parking));
  });

  it('a covered topic drops off the report, and can be shown again on request', async () => {
    const { user: admin, token } = await createUserWithToken({ role: 'admin' });
    const rows = await seedGaps([{ q: 'flumox scanner setup' }, { q: 'flumox scanner install' }]);

    const cover = await request(app)
      .post('/knowledge-gaps/cover')
      .set('Authorization', `Bearer ${token}`)
      .send({ interactionIds: rows.map((r) => r.id), articleId: 'web-123' });

    expect(cover.status).toBe(200);
    expect(cover.body.updated).toBe(2);
    const stored = await AiInteraction.findByPk(rows[0].id);
    expect(stored).toMatchObject({ coveredById: admin.id, coveredArticleId: 'web-123' });

    const open = await request(app).get('/knowledge-gaps?limit=50').set('Authorization', `Bearer ${token}`);
    expect(findTopic(open.body.report, 'flumox')).toBeUndefined();

    const all = await request(app)
      .get('/knowledge-gaps?limit=50&includeCovered=true')
      .set('Authorization', `Bearer ${token}`);
    expect(findTopic(all.body.report, 'flumox')).toMatchObject({ covered: true });
  });

  it('reports how many questions were gaps', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    await seedGaps([{ q: 'blorp refused one' }, { q: 'blorp web one', outcome: 'web_only' }]);
    await AiInteraction.create({ question: 'answered fine', outcome: 'kb', kbGap: false });
    // Greetings aren't real questions, so they don't count.
    await AiInteraction.create({ question: 'hello', outcome: 'small_talk', kbGap: false });

    const res = await request(app).get('/knowledge-gaps').set('Authorization', `Bearer ${token}`);

    const r = res.body.report;
    expect(r.questionsAsked).toBe(3);
    expect(r.gapQuestions).toBe(2);
    expect(r.gapRate).toBe(0.667);
    expect(r.byOutcome).toEqual({ refused: 1, web_only: 1, kb: 1, small_talk: 1 });
  });

  it.each(['customer', 'agent'])('a %s cannot see it', async (role) => {
    const { token } = await createUserWithToken({ role });
    const res = await request(app).get('/knowledge-gaps').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a bad cover request', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const res = await request(app)
      .post('/knowledge-gaps/cover')
      .set('Authorization', `Bearer ${token}`)
      .send({ interactionIds: [] });
    expect(res.status).toBe(400);
  });
});
