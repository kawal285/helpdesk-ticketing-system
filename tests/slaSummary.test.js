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
const { summariseSla } = require('../src/utils/sla');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

const HOUR = 60 * 60 * 1000;

afterAll(async () => {
  await sequelize.close();
});

describe('summariseSla', () => {
  it('counts finished and open targets separately', () => {
    const now = new Date('2026-11-17T12:00:00Z');
    const createdAt = new Date(now.getTime() - 10 * HOUR);

    const summary = summariseSla(
      [
        // Open, plenty of time left on both.
        {
          createdAt: now,
          responseDueAt: new Date(now.getTime() + HOUR),
          dueAt: new Date(now.getTime() + 10 * HOUR),
        },
        // Open, past both targets.
        {
          createdAt,
          responseDueAt: new Date(now.getTime() - 5 * HOUR),
          dueAt: new Date(now.getTime() - HOUR),
        },
        // Responded on time, resolved late.
        {
          createdAt,
          responseDueAt: new Date(createdAt.getTime() + HOUR),
          firstRespondedAt: new Date(createdAt.getTime() + 0.5 * HOUR),
          dueAt: new Date(createdAt.getTime() + 2 * HOUR),
          resolvedAt: new Date(createdAt.getTime() + 3 * HOUR),
        },
        // No targets set: counted in the total only.
        { createdAt },
      ],
      now
    );

    expect(summary.total).toBe(4);
    expect(summary.response).toEqual({ met: 1, missed: 0, onTrack: 1, atRisk: 0, overdue: 1 });
    expect(summary.resolution).toEqual({ met: 0, missed: 1, onTrack: 1, atRisk: 0, overdue: 1 });
  });
});

describe('GET /tickets/sla-summary', () => {
  it('counts only the tickets the customer owns', async () => {
    const { token: tokenA } = await createUserWithToken({ role: 'customer' });
    const { token: tokenB } = await createUserWithToken({ role: 'customer' });

    await createTicketAs(tokenA, { priority: 'Low' });
    const late = await createTicketAs(tokenA, { priority: 'Low' });
    await createTicketAs(tokenB, { priority: 'Low' });

    await Ticket.update(
      { dueAt: new Date(Date.now() - HOUR), responseDueAt: new Date(Date.now() - HOUR) },
      { where: { id: late.body.ticket.id } }
    );

    const res = await request(app)
      .get('/tickets/sla-summary')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(2);
    expect(res.body.summary.resolution.overdue).toBe(1);
    expect(res.body.summary.resolution.onTrack).toBe(1);
    expect(res.body.summary.response.overdue).toBe(1);
  });

  it('is not limited to one page of tickets', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    for (let i = 0; i < 25; i += 1) {
      await createTicketAs(token, { priority: 'Medium' });
    }

    const res = await request(app)
      .get('/tickets/sla-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.summary.total).toBe(25);
  });

  it('requires a signed-in user', async () => {
    const res = await request(app).get('/tickets/sla-summary');
    expect(res.status).toBe(401);
  });
});
