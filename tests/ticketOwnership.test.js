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
const { sequelize, Ticket, Comment } = require('../src/models');
const { canAccessTicket, ticketScopeForUser } = require('../src/utils/ticketAccess');
const { listTickets, getOverdueTickets } = require('../src/controllers/ticket.controller');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

const MISSING_ID = 99999999;

afterAll(async () => {
  await sequelize.close();
});

// Every route that takes a ticket id. `body` is a valid request body, so a
// rejection can only come from the ownership check, not from validation.
const ID_ROUTES = [
  { name: 'GET /tickets/:id', method: 'get', path: (id) => `/tickets/${id}` },
  { name: 'PATCH /tickets/:id', method: 'patch', path: (id) => `/tickets/${id}`, body: { title: 'Hijacked title' } },
  { name: 'PATCH /tickets/:id/status', method: 'patch', path: (id) => `/tickets/${id}/status`, body: { status: 'Closed' } },
  { name: 'PATCH /tickets/:id/assign', method: 'patch', path: (id) => `/tickets/${id}/assign`, body: { assigneeId: null } },
  { name: 'POST /tickets/:id/ai-analyze', method: 'post', path: (id) => `/tickets/${id}/ai-analyze` },
  { name: 'PATCH /tickets/:id/review', method: 'patch', path: (id) => `/tickets/${id}/review`, body: { action: 'reopen' } },
  { name: 'GET /tickets/:id/comments', method: 'get', path: (id) => `/tickets/${id}/comments` },
  { name: 'POST /tickets/:id/comments', method: 'post', path: (id) => `/tickets/${id}/comments`, body: { text: 'Not my ticket' } },
];

function send(route, id, token) {
  const req = request(app)[route.method](route.path(id)).set('Authorization', `Bearer ${token}`);
  return route.body ? req.send(route.body) : req;
}

describe("customer A cannot reach customer B's ticket on any route", () => {
  let tokenA;
  let ticketB;
  let before;

  beforeAll(async () => {
    ({ token: tokenA } = await createUserWithToken({ role: 'customer' }));
    const { token: tokenB } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(tokenB, { title: "B's printer" });
    ticketB = created.body.ticket;

    // Resolved, so the review route would act on it if the check let A through.
    await Ticket.update({ status: 'Resolved', resolvedAt: new Date() }, { where: { id: ticketB.id } });
    before = (await Ticket.findByPk(ticketB.id)).toJSON();
  });

  it.each(ID_ROUTES)('$name: same response as for a ticket that does not exist', async (route) => {
    const forB = await send(route, ticketB.id, tokenA);
    const forMissing = await send(route, MISSING_ID, tokenA);

    // Nothing in the response tells A that B's ticket exists.
    expect(forB.status).toBe(forMissing.status);
    expect(forB.body.message).toBe(forMissing.body.message);
    expect([403, 404]).toContain(forB.status);
  });

  it.each(ID_ROUTES.filter((r) => !/status|assign|ai-analyze/.test(r.name)))(
    '$name: returns 404, not 403',
    async (route) => {
      const res = await send(route, ticketB.id, tokenA);
      expect(res.status).toBe(404);
    }
  );

  it("leaves B's ticket unchanged and adds no comment", async () => {
    const after = (await Ticket.findByPk(ticketB.id)).toJSON();
    expect(after.title).toBe(before.title);
    expect(after.status).toBe(before.status);
    expect(after.assigneeId).toBe(before.assigneeId);
    expect(after.aiAnalyzedAt).toEqual(before.aiAnalyzedAt);
    expect(await Comment.count({ where: { ticketId: ticketB.id } })).toBe(0);
  });

  it("does not include B's ticket in GET /tickets or GET /tickets/overdue", async () => {
    await Ticket.update(
      { status: 'Open', dueAt: new Date(Date.now() - 60 * 60 * 1000) },
      { where: { id: ticketB.id } }
    );

    const list = await request(app).get('/tickets?limit=100').set('Authorization', `Bearer ${tokenA}`);
    const overdue = await request(app).get('/tickets/overdue').set('Authorization', `Bearer ${tokenA}`);

    expect(list.status).toBe(200);
    expect(list.body.tickets.map((t) => t.id)).not.toContain(ticketB.id);
    expect(overdue.body.tickets.map((t) => t.id)).not.toContain(ticketB.id);
  });

  it('still lets A reach their own ticket', async () => {
    const own = await createTicketAs(tokenA);
    const res = await request(app).get(`/tickets/${own.body.ticket.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
  });
});

describe('agents and admins', () => {
  it("an agent gets 404 for a ticket assigned to another agent, but sees their own and the pickup pool", async () => {
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const { user: otherAgent } = await createUserWithToken({ role: 'agent' });

    const ids = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push((await createTicketAs(customerToken)).body.ticket.id);
    }
    const [othersId, mineId, poolId] = ids;
    await Ticket.update({ assigneeId: otherAgent.id }, { where: { id: othersId } });
    await Ticket.update({ assigneeId: agent.id }, { where: { id: mineId } });
    await Ticket.update({ assigneeId: null }, { where: { id: poolId } });

    const get = (id) => request(app).get(`/tickets/${id}`).set('Authorization', `Bearer ${agentToken}`);
    expect((await get(othersId)).status).toBe(404);
    expect((await get(mineId)).status).toBe(200);
    expect((await get(poolId)).status).toBe(200);

    const comment = await request(app)
      .post(`/tickets/${othersId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ text: 'Not mine' });
    expect(comment.status).toBe(404);

    const list = await request(app).get('/tickets?limit=100').set('Authorization', `Bearer ${agentToken}`);
    const listed = list.body.tickets.map((t) => t.id);
    expect(listed).not.toContain(othersId);
    expect(listed).toEqual(expect.arrayContaining([mineId, poolId]));
  });

  it('an admin can reach any ticket', async () => {
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { body } = await createTicketAs(customerToken);

    const res = await request(app).get(`/tickets/${body.ticket.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('an unknown role sees nothing', () => {
  const guest = { id: 1, role: 'guest' };

  it('cannot access any single ticket', () => {
    expect(canAccessTicket(guest, { requesterId: 1, assigneeId: null })).toBe(false);
  });

  it('has no list scope', () => {
    expect(ticketScopeForUser(guest)).toBeNull();
    expect(ticketScopeForUser(undefined)).toBeNull();
  });

  // The role column only allows known roles, so this calls the handlers
  // directly with a hand-built user instead of going through HTTP.
  function fakeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  }

  it('gets an empty list from GET /tickets and GET /tickets/overdue', async () => {
    const listRes = fakeRes();
    await listTickets({ user: guest, query: {} }, listRes, jest.fn());
    expect(listRes.json).toHaveBeenCalledWith(expect.objectContaining({ tickets: [], total: 0 }));

    const overdueRes = fakeRes();
    await getOverdueTickets({ user: guest, query: {} }, overdueRes, jest.fn());
    expect(overdueRes.json).toHaveBeenCalledWith({ tickets: [] });
  });
});

describe('ids from an external provider may be strings', () => {
  it('matches ids by value, not by type', () => {
    expect(canAccessTicket({ id: 5, role: 'customer' }, { requesterId: '5' })).toBe(true);
    expect(canAccessTicket({ id: 7, role: 'agent' }, { assigneeId: '7' })).toBe(true);
    expect(canAccessTicket({ id: 7, role: 'agent' }, { assigneeId: '8' })).toBe(false);
  });
});
