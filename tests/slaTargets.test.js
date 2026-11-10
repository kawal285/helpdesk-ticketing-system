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
