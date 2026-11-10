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
const { sequelize, SlaTarget, Ticket } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

const MINUTE = 60 * 1000;

function minutesAfterCreation(ticket, field) {
  return Math.round(
    (new Date(ticket[field]).getTime() - new Date(ticket.createdAt).getTime()) / MINUTE
  );
}

// The test DB starts with an empty sla_targets table (defaults apply).
// Clear any rows a test inserted so other test files see the defaults.
afterEach(async () => {
  await SlaTarget.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe('due dates come from the sla_targets table', () => {
  it('uses the table row for the ticket priority on creation', async () => {
    await SlaTarget.create({ priority: 'High', responseMinutes: 30, resolutionMinutes: 120 });
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { priority: 'High' });

    expect(res.status).toBe(201);
    expect(minutesAfterCreation(res.body.ticket, 'responseDueAt')).toBe(30);
    expect(minutesAfterCreation(res.body.ticket, 'dueAt')).toBe(120);
  });

  it('falls back to the documented defaults when the priority has no row', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { priority: 'Critical' });

    expect(minutesAfterCreation(res.body.ticket, 'responseDueAt')).toBe(15);
    expect(minutesAfterCreation(res.body.ticket, 'dueAt')).toBe(240);
  });
});

describe('changing the priority recalculates the due dates', () => {
  it('recomputes both deadlines from createdAt using the new priority', async () => {
    await SlaTarget.create({ priority: 'Low', responseMinutes: 600, resolutionMinutes: 6000 });
    await SlaTarget.create({ priority: 'Critical', responseMinutes: 10, resolutionMinutes: 100 });
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { token: staffToken } = await createUserWithToken({ role: 'admin' });

    const created = await createTicketAs(customerToken, { priority: 'Low' });
    expect(minutesAfterCreation(created.body.ticket, 'dueAt')).toBe(6000);

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ priority: 'Critical' });

    expect(res.status).toBe(200);
    expect(minutesAfterCreation(res.body.ticket, 'responseDueAt')).toBe(10);
    expect(minutesAfterCreation(res.body.ticket, 'dueAt')).toBe(100);
  });

  it('does not move the deadlines when the same priority is re-sent', async () => {
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { token: staffToken } = await createUserWithToken({ role: 'admin' });
    const created = await createTicketAs(customerToken, { priority: 'Medium' });
    // Compare against what MySQL stored (second precision), not the create response.
    const stored = (await Ticket.findByPk(created.body.ticket.id)).toJSON();

    // Targets change after the ticket was created...
    await SlaTarget.create({ priority: 'Medium', responseMinutes: 1, resolutionMinutes: 2 });

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ priority: 'Medium', title: 'Renamed' });

    // ...but re-saving the same priority keeps the original deadlines.
    expect(new Date(res.body.ticket.dueAt)).toEqual(stored.dueAt);
    expect(new Date(res.body.ticket.responseDueAt)).toEqual(stored.responseDueAt);
  });
});

describe('first response', () => {
  it('is recorded by the first staff comment, not by a customer comment', async () => {
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { token: staffToken } = await createUserWithToken({ role: 'admin' });
    const { body } = await createTicketAs(customerToken);
    const id = body.ticket.id;

    await request(app)
      .post(`/tickets/${id}/comments`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ text: 'Any update?' });
    expect((await Ticket.findByPk(id)).firstRespondedAt).toBeNull();

    await request(app)
      .post(`/tickets/${id}/comments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ text: 'Looking into it now.' });
    const firstResponse = (await Ticket.findByPk(id)).firstRespondedAt;
    expect(firstResponse).toBeInstanceOf(Date);

    // A later comment does not move it.
    await request(app)
      .post(`/tickets/${id}/comments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ text: 'Second reply.' });
    expect((await Ticket.findByPk(id)).firstRespondedAt).toEqual(firstResponse);
  });

  it('is recorded by a status change from staff', async () => {
    const { token: customerToken } = await createUserWithToken({ role: 'customer' });
    const { token: staffToken } = await createUserWithToken({ role: 'admin' });
    const { body } = await createTicketAs(customerToken);

    const res = await request(app)
      .patch(`/tickets/${body.ticket.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'In Progress' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.firstRespondedAt).not.toBeNull();
  });
});

describe('ticket responses include the SLA status', () => {
  it('returns sla.response and sla.resolution on GET /tickets/:id', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const { body } = await createTicketAs(token, { priority: 'Low' });

    const res = await request(app)
      .get(`/tickets/${body.ticket.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket.sla).toEqual({
      response: { dueAt: expect.any(String), completedAt: null, status: 'on_track' },
      resolution: { dueAt: expect.any(String), completedAt: null, status: 'on_track' },
    });
  });

  it('reports breached for a ticket whose deadlines have passed', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const { body } = await createTicketAs(token, { priority: 'Critical' });
    const past = new Date(Date.now() - 60 * MINUTE);
    await Ticket.update(
      { responseDueAt: past, dueAt: past },
      { where: { id: body.ticket.id } }
    );

    const res = await request(app)
      .get(`/tickets/${body.ticket.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.ticket.sla.response.status).toBe('breached');
    expect(res.body.ticket.sla.resolution.status).toBe('breached');
  });
});

describe('GET /sla-targets', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/sla-targets');
    expect(res.status).toBe(401);
  });

  it('lists every priority for any signed-in user, flagging defaults', async () => {
    await SlaTarget.create({ priority: 'High', responseMinutes: 45, resolutionMinutes: 300 });
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await request(app).get('/sla-targets').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.targets.map((t) => t.priority)).toEqual(['Trivial', 'Low', 'Medium', 'High', 'Critical']);
    expect(res.body.targets.find((t) => t.priority === 'High')).toEqual({
      priority: 'High', responseMinutes: 45, resolutionMinutes: 300, isDefault: false,
    });
    expect(res.body.targets.find((t) => t.priority === 'Critical').isDefault).toBe(true);
  });
});

describe('PUT /sla-targets/:priority -- only an admin can change targets', () => {
  const newTarget = { responseMinutes: 20, resolutionMinutes: 180 };

  it.each(['customer', 'agent'])('rejects a %s with 403 and changes nothing', async (role) => {
    const { token } = await createUserWithToken({ role });

    const res = await request(app)
      .put('/sla-targets/Critical')
      .set('Authorization', `Bearer ${token}`)
      .send(newTarget);

    expect(res.status).toBe(403);
    expect(await SlaTarget.count()).toBe(0);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).put('/sla-targets/Critical').send(newTarget);
    expect(res.status).toBe(401);
  });

  it('lets an admin change a target, and new tickets use it', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    const res = await request(app)
      .put('/sla-targets/Critical')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newTarget);

    expect(res.status).toBe(200);
    expect(res.body.target).toEqual({ priority: 'Critical', ...newTarget, isDefault: false });

    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token, { priority: 'Critical' });
    expect(minutesAfterCreation(created.body.ticket, 'responseDueAt')).toBe(20);
    expect(minutesAfterCreation(created.body.ticket, 'dueAt')).toBe(180);
  });

  it('rejects an unknown priority, non-positive minutes, and resolution not longer than response', async () => {
    const { token } = await createUserWithToken({ role: 'admin' });
    const put = (priority, body) =>
      request(app).put(`/sla-targets/${priority}`).set('Authorization', `Bearer ${token}`).send(body);

    expect((await put('P9', newTarget)).status).toBe(400);
    expect((await put('High', { responseMinutes: 0, resolutionMinutes: 60 })).status).toBe(400);
    expect((await put('High', { responseMinutes: 60, resolutionMinutes: 60 })).status).toBe(400);
    expect((await put('High', { responseMinutes: 'soon', resolutionMinutes: 60 })).status).toBe(400);
    expect(await SlaTarget.count()).toBe(0);
  });
});
