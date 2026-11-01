jest.mock('../src/services/aiService', () => ({
  getAiSuggestions: jest.fn().mockResolvedValue({
    category: null,
    priority: null,
    suggestedResponse: null,
  }),
}));

jest.mock('../src/services/emotionDetectionService', () => ({
  detectEmotion: jest.fn().mockResolvedValue({
    emotion: 'neutral',
    reason: 'Test emotion result.',
    isSuggestion: true,
  }),
}));
const { Op } = require('sequelize');
const { sequelize, User, Ticket } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs, assignTicket } = require('./helpers/ticketHelpers');

afterAll(async () => {
  await sequelize.close();
});

async function activeAgentOpenCounts(agentIds) {
  return Promise.all(
    agentIds.map((id) =>
      Ticket.count({ where: { assigneeId: id, status: { [Op.in]: ['Open', 'In Progress'] } } })
    )
  );
}

// Other test files in this shared-DB suite also create agents, tickets, and
// manual reassignments (which deliberately bypass balancing), so the global
// pool of active agents can't be assumed clean or evenly loaded here.
// Deactivating everyone else for the duration of the test makes the
// balancing algorithm choose only from the agents this test controls.
async function withOnlyTheseAgentsActive(agentIds, fn) {
  const previouslyActive = await User.findAll({ where: { role: 'agent', isActive: true } });
  await User.update({ isActive: false }, { where: { role: 'agent', isActive: true } });
  try {
    await User.update({ isActive: true }, { where: { id: { [Op.in]: agentIds } } });
    await fn();
  } finally {
    await User.update({ isActive: false }, { where: { role: 'agent', isActive: true } });
    await User.update(
      { isActive: true },
      { where: { id: { [Op.in]: previouslyActive.map((a) => a.id) } } }
    );
  }
}

describe('auto-assignment on ticket creation', () => {
  it('keeps open-ticket load balanced across active agents', async () => {
    const { user: agentA } = await createUserWithToken({ role: 'agent' });
    const { user: agentB } = await createUserWithToken({ role: 'agent' });
    const { token } = await createUserWithToken({ role: 'customer' });

    await withOnlyTheseAgentsActive([agentA.id, agentB.id], async () => {
      for (let i = 0; i < 5; i += 1) {
        const res = await createTicketAs(token);
        expect(res.status).toBe(201);
      }

      const counts = await activeAgentOpenCounts([agentA.id, agentB.id]);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(5); // all 5 landed on exactly these two agents
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });
  });

  it('creates an unassigned ticket, not an error, when no active agent exists', async () => {
    await withOnlyTheseAgentsActive([], async () => {
      const { token } = await createUserWithToken({ role: 'customer' });
      const res = await createTicketAs(token);

      expect(res.status).toBe(201);
      expect(res.body.ticket.assigneeId).toBeNull();
    });
  });
});

describe('PATCH /tickets/:id/assign (manual reassignment)', () => {
  it('lets an admin reassign a ticket to a specific active agent', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: newAgent } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);

    const res = await assignTicket(adminToken, created.body.ticket.id, newAgent.id);

    expect(res.status).toBe(200);
    expect(res.body.ticket.assigneeId).toBe(newAgent.id);
  });

  it('lets an admin unassign a ticket by sending assigneeId: null', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const created = await createTicketAs(ownerToken);

    const res = await assignTicket(adminToken, created.body.ticket.id, null);

    expect(res.status).toBe(200);
    expect(res.body.ticket.assigneeId).toBeNull();
  });

  it('rejects assigning to an inactive agent with 400', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: inactiveAgent } = await createUserWithToken({ role: 'agent', isActive: false });
    const created = await createTicketAs(ownerToken);

    const res = await assignTicket(adminToken, created.body.ticket.id, inactiveAgent.id);
    expect(res.status).toBe(400);
  });

  it('rejects assigning to a non-agent user with 400', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: customer } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(ownerToken);

    const res = await assignTicket(adminToken, created.body.ticket.id, customer.id);
    expect(res.status).toBe(400);
  });

  it('rejects a customer trying to reassign with 403', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(ownerToken);

    const res = await assignTicket(ownerToken, created.body.ticket.id, null);
    expect(res.status).toBe(403);
  });
});
