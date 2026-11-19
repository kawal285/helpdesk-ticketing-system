/*
 * "As an agent, I want tickets already sorted by AI-predicted priority,
 * so I know what to work on first."
 *   - the agent queue is ordered by priority
 *   - priority is shown on each ticket
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

const request = require('supertest');
const app = require('../src/app');
const { sequelize, Ticket } = require('../src/models');
const { getAiSuggestions } = require('../src/services/aiService');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

const HOUR = 60 * 60 * 1000;

afterAll(async () => {
  await sequelize.close();
});

// A fresh agent with their own tickets, so other test files' tickets
// never get mixed into the queue being checked.
async function queueFor(tickets) {
  const { token: customer } = await createUserWithToken({ role: 'customer' });
  const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
  const { token: adminToken } = await createUserWithToken({ role: 'admin' });

  const ids = {};
  for (const [name, fields] of Object.entries(tickets)) {
    const created = await createTicketAs(customer, { title: name, priority: fields.priority });
    const id = created.body.ticket.id;
    await Ticket.update({ ...fields, assigneeId: agent.id }, { where: { id } });
    ids[id] = name;
  }

  const names = (res) => res.body.tickets.map((t) => ids[t.id]).filter(Boolean);

  return { agent, agentToken, adminToken, customer, names };
}

describe('agent queue is ordered by priority', () => {
  it('puts P1 first and P4 last, with finished tickets at the end', async () => {
    const { agent, agentToken, names } = await queueFor({
      low: { priority: 'Low' },
      critical: { priority: 'Critical' },
      trivial: { priority: 'Trivial' },
      medium: { priority: 'Medium' },
      high: { priority: 'High' },
      doneCritical: { priority: 'Critical', status: 'Resolved' },
    });

    const res = await request(app)
      .get(`/tickets?assigneeId=${agent.id}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.sort).toBe('priority');
    expect(names(res)).toEqual(['critical', 'high', 'medium', 'low', 'trivial', 'doneCritical']);
  });

  it('within the same priority, the nearest deadline comes first', async () => {
    const now = Date.now();
    const { agent, adminToken, names } = await queueFor({
      later: { priority: 'High', dueAt: new Date(now + 5 * HOUR) },
      overdue: { priority: 'High', dueAt: new Date(now - HOUR) },
      soon: { priority: 'High', dueAt: new Date(now + HOUR) },
    });

    const res = await request(app)
      .get(`/tickets?assigneeId=${agent.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(names(res)).toEqual(['overdue', 'soon', 'later']);
  });

  it('uses the priority the AI picked when the customer gave none', async () => {
    getAiSuggestions
      .mockResolvedValueOnce({ category: 'Network', priority: 'Low', suggestedResponse: null })
      .mockResolvedValueOnce({ category: 'Network', priority: 'Critical', suggestedResponse: null });

    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const first = (await createTicketAs(customer)).body.ticket.id;
    const second = (await createTicketAs(customer)).body.ticket.id;
    await Ticket.update({ assigneeId: agent.id }, { where: { id: [first, second] } });

    const res = await request(app)
      .get(`/tickets?assigneeId=${agent.id}`)
      .set('Authorization', `Bearer ${agentToken}`);

    // Created second, but the AI rated it P1, so it is first in the queue.
    expect(res.body.tickets.map((t) => t.id)).toEqual([second, first]);
    expect(res.body.tickets[0].aiPriority).toBe('Critical');
  });

  it('stays in the same order across pages', async () => {
    const { agent, adminToken, names } = await queueFor({
      a: { priority: 'Low' },
      b: { priority: 'Critical' },
      c: { priority: 'Medium' },
      d: { priority: 'High' },
    });

    const page = async (n) =>
      names(
        await request(app)
          .get(`/tickets?assigneeId=${agent.id}&limit=2&page=${n}`)
          .set('Authorization', `Bearer ${adminToken}`)
      );

    expect([...(await page(1)), ...(await page(2))]).toEqual(['b', 'd', 'c', 'a']);
  });

  it('staff can still ask for newest first', async () => {
    const { agent, adminToken, names } = await queueFor({
      older: { priority: 'Critical', createdAt: new Date(Date.now() - HOUR) },
      newer: { priority: 'Low' },
    });

    const res = await request(app)
      .get(`/tickets?assigneeId=${agent.id}&sort=newest`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.sort).toBe('newest');
    expect(names(res)).toEqual(['newer', 'older']);
  });

  it('customers see their newest tickets first by default', async () => {
    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const old = (await createTicketAs(customer, { priority: 'Critical' })).body.ticket.id;
    await Ticket.update({ createdAt: new Date(Date.now() - HOUR) }, { where: { id: old } });
    const recent = (await createTicketAs(customer, { priority: 'Low' })).body.ticket.id;

    const res = await request(app).get('/tickets').set('Authorization', `Bearer ${customer}`);

    expect(res.body.sort).toBe('newest');
    expect(res.body.tickets.map((t) => t.id)).toEqual([recent, old]);
  });

  it('rejects an unknown sort with 400', async () => {
    const { token } = await createUserWithToken({ role: 'agent' });
    const res = await request(app).get('/tickets?sort=random').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('priority is shown on each ticket', () => {
  it('every ticket in the queue has its priority and P-level', async () => {
    const { agent, agentToken } = await queueFor({
      x: { priority: 'Critical' },
      y: { priority: 'Trivial' },
    });

    const res = await request(app)
      .get(`/tickets?assigneeId=${agent.id}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.body.tickets.map((t) => [t.priority, t.priorityLevel])).toEqual([
      ['Critical', 'P1'],
      ['Trivial', 'P4'],
    ]);
  });
});
