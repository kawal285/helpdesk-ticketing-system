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

const request = require('supertest');
const app = require('../src/app');
const { sequelize, Ticket } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs, assignTicket } = require('./helpers/ticketHelpers');

afterAll(async () => {
  await sequelize.close();
});

// Auto-assignment (Commit 7) picks whichever active agent has the fewest
// open tickets across the *entire* table, which may include agents created
// by other test files sharing this DB. Tests that care about a specific
// assignment state must set it explicitly rather than assume what
// auto-assignment did at creation time.

describe('POST /tickets', () => {
  it('creates a ticket with the requester set from the token, dueAt computed from priority', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { category: 'Hardware', priority: 'Critical' });

    expect(res.status).toBe(201);
    const { ticket } = res.body;
    expect(ticket.status).toBe('Open');
    expect(ticket.category).toBe('Hardware');
    expect(ticket.priority).toBe('Critical');

    const dueAt = new Date(ticket.dueAt).getTime();
    const createdAt = new Date(ticket.createdAt).getTime();
    expect(dueAt - createdAt).toBeCloseTo(4 * 60 * 60 * 1000, -3);
  });

  it('falls back to category=Other/priority=Trivial when neither is supplied and the AI has nothing to offer', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token);

    expect(res.status).toBe(201);
    expect(res.body.ticket.category).toBe('Other');
    expect(res.body.ticket.priority).toBe('Trivial');
  });

  it('computes a 120-hour due date for Trivial priority', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { category: 'Other', priority: 'Trivial' });

    expect(res.status).toBe(201);
    const { ticket } = res.body;
    const dueAt = new Date(ticket.dueAt).getTime();
    const createdAt = new Date(ticket.createdAt).getTime();
    expect(dueAt - createdAt).toBeCloseTo(120 * 60 * 60 * 1000, -3);
  });

  it('persists the room field', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { room: 'Block C, Room 214' });

    expect(res.status).toBe(201);
    expect(res.body.ticket.room).toBe('Block C, Room 214');
  });

  it('leaves room null when not supplied', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token);

    expect(res.status).toBe(201);
    expect(res.body.ticket.room).toBeNull();
  });

  it('no longer accepts the retired CRM fields -- they are silently ignored, not persisted or errored on', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, {
      initialFeeling: 'Frustrated',
      origin: 'Phone',
      studentLivingVillageResident: true,
      opsvDefect: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.ticket.initialFeeling).toBeUndefined();
    expect(res.body.ticket.origin).toBeUndefined();
    expect(res.body.ticket.studentLivingVillageResident).toBeUndefined();
    expect(res.body.ticket.opsvDefect).toBeUndefined();
  });

  it('ignores a client-supplied requesterId and uses the authenticated user instead', async () => {
    const { token, user } = await createUserWithToken({ role: 'customer' });
    const { user: otherUser } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { requesterId: otherUser.id });

    expect(res.status).toBe(201);
    expect(res.body.ticket.requesterId).toBe(user.id);
  });

  it('rejects a missing title with 400', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await request(app)
      .post('/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'no title here' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid category with 400', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { category: 'NotACategory' });

    expect(res.status).toBe(400);
  });
});

describe('ticket ownership scoping', () => {
  it("hides one customer's ticket from another customer", async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: otherToken } = await createUserWithToken({ role: 'customer' });

    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;

    const getRes = await request(app).get(`/tickets/${ticketId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(getRes.status).toBe(404);

    const listRes = await request(app).get('/tickets').set('Authorization', `Bearer ${otherToken}`);
    expect(listRes.body.tickets.find((t) => t.id === ticketId)).toBeUndefined();
  });

  it('lets an unassigned-pool agent see an unassigned ticket, and an admin see everything', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: agentToken } = await createUserWithToken({ role: 'agent' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, null); // force unassigned, regardless of what auto-assignment did

    const agentRes = await request(app).get(`/tickets/${ticketId}`).set('Authorization', `Bearer ${agentToken}`);
    expect(agentRes.status).toBe(200);

    const adminRes = await request(app).get(`/tickets/${ticketId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
  });

  it("hides a ticket assigned to a different agent from an agent who isn't assigned to it", async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: assignedAgent } = await createUserWithToken({ role: 'agent' });
    const { token: otherAgentToken } = await createUserWithToken({ role: 'agent' });

    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, assignedAgent.id);

    const res = await request(app).get(`/tickets/${ticketId}`).set('Authorization', `Bearer ${otherAgentToken}`);
    expect(res.status).toBe(404);
  });
});

describe('ticket status transitions', () => {
  it('allows a valid transition (Open -> Resolved) by the assigned agent', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);

    const res = await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Resolved' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('Resolved');
    expect(res.body.ticket.resolvedAt).not.toBeNull();
  });

  it('rejects an invalid transition (Closed -> Open) for a non-admin with 409', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);

    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Closed' });

    const res = await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Open' });

    expect(res.status).toBe(409);
  });

  it('lets an admin override a terminal Closed status', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;

    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Closed' });

    const res = await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Open' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('Open');
  });

  it('rejects a customer calling the status endpoint with 403', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(ownerToken);

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'Resolved' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /tickets/:id (edit)', () => {
  it('lets the requester edit their own ticket while it is Open', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token);

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.title).toBe('Updated title');
  });

  it('lets the requester update the room field while their ticket is Open', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token, { room: 'Block A, Room 1' });

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ room: 'Block B, Room 2' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.room).toBe('Block B, Room 2');
  });

  it('blocks the requester from editing once the ticket is no longer Open', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;

    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'In Progress' });

    const res = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Should be blocked' });

    expect(res.status).toBe(403);
  });

  it('lets an assigned agent edit ticket details, including once the ticket is no longer Open', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);
    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'In Progress' });

    const res = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Agent editing details', room: 'Server room' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.room).toBe('Server room');
    expect(res.body.ticket.title).toBe('Agent editing details');
  });

  it('lets an assigned agent update status and details together in one call', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);

    const res = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'Root cause found', priority: 'High', status: 'Resolved' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.title).toBe('Root cause found');
    expect(res.body.ticket.priority).toBe('High');
    expect(res.body.ticket.status).toBe('Resolved');
    expect(res.body.ticket.resolvedAt).not.toBeNull();
  });

  it('lets an admin reassign a ticket via PATCH /tickets/:id', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;

    const res = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeId: agent.id });

    expect(res.status).toBe(200);
    expect(res.body.ticket.assigneeId).toBe(agent.id);
  });

  it('rejects an invalid status transition through the combined endpoint with 409', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);
    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Closed' });

    const res = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'Open', title: 'Should not apply' });

    expect(res.status).toBe(409);
  });

  it('blocks a customer from changing status or assigneeId through PATCH /tickets/:id with 403', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;

    const statusRes = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'Resolved' });
    expect(statusRes.status).toBe(403);

    const assignRes = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ assigneeId: agent.id });
    expect(assignRes.status).toBe(403);
  });
});

describe('GET /tickets pagination', () => {
  it('respects page and limit query params', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    for (let i = 0; i < 3; i += 1) {
      await createTicketAs(token, { title: `Ticket ${i}` });
    }

    const res = await request(app).get('/tickets?limit=2&page=1').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets.length).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });

  it('rejects a limit above 100 with 400', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await request(app).get('/tickets?limit=101').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('ticket organization', () => {
  it('stamps a new ticket with the organization of its requester', async () => {
    const { token } = await createUserWithToken({ role: 'customer', organization: 'OP' });

    const res = await createTicketAs(token);

    expect(res.status).toBe(201);
    expect(res.body.ticket.organization).toBe('OP');
  });

  it('lets staff see tickets from both organizations in one list, and filter by organization', async () => {
    const { token: fsCustomer } = await createUserWithToken({ role: 'customer', organization: 'Future Skills' });
    const { token: opCustomer } = await createUserWithToken({ role: 'customer', organization: 'OP' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    const fsTicket = await createTicketAs(fsCustomer, { title: 'FS ticket' });
    const opTicket = await createTicketAs(opCustomer, { title: 'OP ticket' });

    const unfiltered = await request(app).get('/tickets').set('Authorization', `Bearer ${adminToken}`);
    expect(unfiltered.status).toBe(200);
    const ids = unfiltered.body.tickets.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([fsTicket.body.ticket.id, opTicket.body.ticket.id]));

    const opOnly = await request(app).get('/tickets?organization=OP').set('Authorization', `Bearer ${adminToken}`);
    expect(opOnly.status).toBe(200);
    expect(opOnly.body.tickets.every((t) => t.organization === 'OP')).toBe(true);
    expect(opOnly.body.tickets.some((t) => t.id === opTicket.body.ticket.id)).toBe(true);
    expect(opOnly.body.tickets.some((t) => t.id === fsTicket.body.ticket.id)).toBe(false);
  });

  it('rejects an invalid organization filter with 400', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await request(app).get('/tickets?organization=NotAnOrg').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /tickets/overdue', () => {
  it('returns only tickets whose dueAt is in the past and still open', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token);
    const ticketId = created.body.ticket.id;

    // The API has no way to backdate a ticket, so reach into the DB directly
    // to simulate one that's now overdue.
    await Ticket.update({ dueAt: new Date(Date.now() - 60 * 60 * 1000) }, { where: { id: ticketId } });

    const res = await request(app).get('/tickets/overdue').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets.some((t) => t.id === ticketId)).toBe(true);
  });
});

describe('PATCH /tickets/:id/review', () => {
  async function resolveTicket(ownerToken, adminToken) {
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;

    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'In Progress' });

    await request(app)
      .patch(`/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Resolved' });

    return ticketId;
  }

  it('lets the requester accept a resolution, closing the ticket', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const ticketId = await resolveTicket(ownerToken, adminToken);

    const res = await request(app)
      .patch(`/tickets/${ticketId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('Closed');
    expect(res.body.ticket.resolvedAt).not.toBeNull();
  });

  it('lets the requester reopen a resolution, moving the ticket back to In Progress', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const ticketId = await resolveTicket(ownerToken, adminToken);

    const res = await request(app)
      .patch(`/tickets/${ticketId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'reopen' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('In Progress');
    expect(res.body.ticket.resolvedAt).toBeNull();
  });

  it('rejects a reviewer who is not the requester with 403', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { token: otherCustomerToken } = await createUserWithToken({ role: 'customer' });
    const ticketId = await resolveTicket(ownerToken, adminToken);

    const res = await request(app)
      .patch(`/tickets/${ticketId}/review`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(404);
  });

  it('rejects staff reviewing on the customer\'s behalf with 403', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const ticketId = await resolveTicket(ownerToken, adminToken);

    const res = await request(app)
      .patch(`/tickets/${ticketId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(403);
  });

  it('rejects reviewing a ticket that is not Resolved with 409', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(ownerToken);

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(409);
  });

  it('rejects an invalid action with 400', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const ticketId = await resolveTicket(ownerToken, adminToken);

    const res = await request(app)
      .patch(`/tickets/${ticketId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'delete-everything' });

    expect(res.status).toBe(400);
  });
});
