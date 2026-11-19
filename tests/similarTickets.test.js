/*
 * Similar open tickets / duplicate detection.
 *
 * The embedding model is replaced by a simple word-count vector, so the
 * tests run offline and give the same scores every time: tickets that
 * share words score high, tickets that don't score low. How well the
 * real model separates duplicates is measured separately by
 * scripts/ai/evaluate-similar-tickets.js (docs/similar-tickets.md).
 */

jest.mock('../src/services/aiService', () => ({
  getAiSuggestions: jest.fn().mockResolvedValue({
    category: null,
    priority: null,
    suggestedResponse: null,
  }),
}));

jest.mock('../src/services/emotionDetectionService', () => ({
  detectEmotion: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/services/rag/embeddingService', () => {
  const STOP = new Set(['the', 'a', 'an', 'is', 'and', 'on', 'in', 'my', 'it', 'to', 'of', 'for', 'at', 'not']);
  const DIMS = 256;
  const hash = (word) => [...word].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % DIMS, 7);

  function vectorFor(text) {
    const v = new Array(DIMS).fill(0);
    text
      .toLowerCase()
      .split(/[^a-z0-9[\]]+/)
      .filter((w) => w && !STOP.has(w))
      .forEach((w) => {
        v[hash(w)] += 1;
      });
    const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / len);
  }

  return {
    embedDocuments: jest.fn(async (texts) => texts.map(vectorFor)),
    embedQuery: jest.fn(async (text) => vectorFor(text)),
    getModelInfo: jest.fn(() => ({ provider: 'test', name: 'test:words', dimensions: DIMS })),
  };
});

const request = require('supertest');
const app = require('../src/app');
const { sequelize, Ticket, TicketEmbedding } = require('../src/models');
const { embedDocuments } = require('../src/services/rag/embeddingService');
const { ticketText } = require('../src/services/similarTicketService');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

// Word-count vectors give lower scores than the real model, so the test
// uses its own threshold.
process.env.SIMILAR_TICKET_THRESHOLD = '0.5';

afterAll(async () => {
  delete process.env.SIMILAR_TICKET_THRESHOLD;
  await sequelize.close();
});

beforeEach(() => {
  embedDocuments.mockClear();
});

// Tickets for one fresh agent, so other test files' tickets never mix in.
async function setUp(tickets) {
  const { token: customer } = await createUserWithToken({ role: 'customer' });
  const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
  const { token: adminToken } = await createUserWithToken({ role: 'admin' });

  const ids = {};
  for (const [name, t] of Object.entries(tickets)) {
    const created = await createTicketAs(customer, { title: t.title, description: t.description });
    const id = created.body.ticket.id;
    await Ticket.update({ assigneeId: agent.id, ...(t.extra || {}) }, { where: { id } });
    ids[name] = id;
  }

  return { ids, agent, agentToken, adminToken, customer };
}

function similar(token, id) {
  return request(app).get(`/tickets/${id}/similar`).set('Authorization', `Bearer ${token}`);
}

const OUTAGE = {
  title: 'Zorblax wifi down level three',
  description: 'Nobody on level three can connect to zorblax wifi since nine.',
};
const OUTAGE_AGAIN = {
  title: 'Level three zorblax wifi not working',
  description: 'Zorblax wifi down for everyone on level three, cannot connect.',
};
const UNRELATED = {
  title: 'Quuxle keyboard key missing',
  description: 'The E key cap fell off my quuxle keyboard.',
};

describe('GET /tickets/:id/similar', () => {
  it('finds the duplicate open ticket and leaves out unrelated ones', async () => {
    const { ids, agentToken } = await setUp({ outage: OUTAGE, again: OUTAGE_AGAIN, other: UNRELATED });

    const res = await similar(agentToken, ids.again);

    expect(res.status).toBe(200);
    const found = res.body.similar.map((t) => t.id);
    expect(found).toContain(ids.outage);
    expect(found).not.toContain(ids.other);
    expect(found).not.toContain(ids.again); // never itself
    expect(res.body.similar[0]).toMatchObject({
      id: ids.outage,
      title: OUTAGE.title,
      priorityLevel: expect.stringMatching(/^P[1-4]$/),
      score: expect.any(Number),
    });
    expect(res.body.similar[0].score).toBeGreaterThanOrEqual(res.body.threshold);
  });

  it('ranks the closest match first', async () => {
    const { ids, adminToken } = await setUp({
      source: OUTAGE,
      exact: { title: OUTAGE.title, description: OUTAGE.description },
      partial: { title: 'Zorblax wifi slow', description: 'Zorblax wifi is slow today on level three.' },
    });

    const res = await similar(adminToken, ids.source);
    const order = res.body.similar.map((t) => t.id);

    expect(order.indexOf(ids.exact)).toBeLessThan(order.indexOf(ids.partial));
  });

  it('only suggests open tickets', async () => {
    const { ids, agentToken } = await setUp({
      source: OUTAGE,
      resolved: { ...OUTAGE_AGAIN, extra: { status: 'Resolved' } },
      closed: { ...OUTAGE_AGAIN, extra: { status: 'Closed' } },
      open: OUTAGE_AGAIN,
    });

    const found = (await similar(agentToken, ids.source)).body.similar.map((t) => t.id);

    expect(found).toContain(ids.open);
    expect(found).not.toContain(ids.resolved);
    expect(found).not.toContain(ids.closed);
  });

  it("an agent is never shown another agent's tickets", async () => {
    const { ids, agentToken } = await setUp({ source: OUTAGE });
    const other = await setUp({ theirs: OUTAGE_AGAIN });

    const found = (await similar(agentToken, ids.source)).body.similar.map((t) => t.id);

    expect(found).not.toContain(other.ids.theirs);
  });

  it('customers cannot use it', async () => {
    const { ids, customer } = await setUp({ source: OUTAGE });

    const res = await similar(customer, ids.source);

    expect(res.status).toBe(403);
  });

  it('stores each embedding once and only redoes it when the text changes', async () => {
    const { ids, adminToken } = await setUp({ source: OUTAGE, again: OUTAGE_AGAIN });

    await similar(adminToken, ids.source);
    const firstRun = embedDocuments.mock.calls.flat(2).length;
    expect(await TicketEmbedding.findByPk(ids.source)).not.toBeNull();

    embedDocuments.mockClear();
    await similar(adminToken, ids.source);
    expect(embedDocuments).not.toHaveBeenCalled();
    expect(firstRun).toBeGreaterThan(0);

    await request(app)
      .patch(`/tickets/${ids.again}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Completely different words now about a quuxle mouse.' });

    embedDocuments.mockClear();
    await similar(adminToken, ids.source);
    expect(embedDocuments.mock.calls.flat(2)).toEqual([
      expect.stringContaining('quuxle mouse'),
    ]);
  });

  it('removes private details before embedding', async () => {
    const { ids, adminToken } = await setUp({
      source: {
        title: 'Zorblax email locked',
        description: 'My account jo.smith@example.co.nz is locked, call 021 123 4567.',
      },
      other: OUTAGE,
    });

    await similar(adminToken, ids.source);

    const sent = JSON.stringify(embedDocuments.mock.calls);
    expect(sent).not.toContain('jo.smith@example.co.nz');
    expect(sent).not.toContain('021 123 4567');
    expect(sent).toContain('[EMAIL]');
  });

  it('returns 503 when the embedding model is unavailable', async () => {
    const { ids, adminToken } = await setUp({ source: OUTAGE, again: OUTAGE_AGAIN });
    embedDocuments.mockRejectedValueOnce(new Error('Ollama not running'));

    const res = await similar(adminToken, ids.source);

    expect(res.status).toBe(503);
  });

  it('staff can link a suggested duplicate to the original ticket', async () => {
    const { ids, agentToken } = await setUp({ original: OUTAGE, duplicate: OUTAGE_AGAIN });

    const suggestion = (await similar(agentToken, ids.duplicate)).body.similar[0];
    expect(suggestion.id).toBe(ids.original);

    const res = await request(app)
      .patch(`/tickets/${ids.duplicate}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ parentCaseId: suggestion.id });

    expect(res.status).toBe(200);
    expect(res.body.ticket.parentCaseId).toBe(ids.original);
  });
});

describe('ticketText', () => {
  it('joins title and description and hides private details', () => {
    expect(ticketText({ title: 'Locked out', description: 'password: Hunter22' })).toBe(
      'Locked out. password: [PASSWORD]'
    );
  });
});
