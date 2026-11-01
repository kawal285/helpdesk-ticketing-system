jest.mock('../src/services/aiService', () => ({
  getAiSuggestions: jest.fn().mockResolvedValue({ category: null, priority: null, suggestedResponse: null }),
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
const { sequelize } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs, assignTicket } = require('./helpers/ticketHelpers');

afterAll(async () => {
  await sequelize.close();
});

describe('POST /tickets/:ticketId/comments', () => {
  it('lets the requester comment on their own ticket', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token);

    const res = await request(app)
      .post(`/tickets/${created.body.ticket.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Any update on this?' });

    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('Any update on this?');
  });

  it('lets the assigned agent comment on the ticket', async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent, token: agentToken } = await createUserWithToken({ role: 'agent' });
    const created = await createTicketAs(ownerToken);
    const ticketId = created.body.ticket.id;
    await assignTicket(adminToken, ticketId, agent.id);

    const res = await request(app)
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ text: 'Looking into it.' });

    expect(res.status).toBe(201);
  });

  it("rejects a customer who isn't the requester with 403", async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: otherToken } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(ownerToken);

    const res = await request(app)
      .post(`/tickets/${created.body.ticket.id}/comments`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ text: 'Trying to butt in' });

    expect(res.status).toBe(403);
  });

  it('rejects an empty comment body with 400', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token);

    const res = await request(app)
      .post(`/tickets/${created.body.ticket.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '   ' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent ticket', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await request(app)
      .post('/tickets/999999/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Hello?' });

    expect(res.status).toBe(404);
  });
});

describe('GET /tickets/:ticketId/comments', () => {
  it('lists comments in chronological order', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(token);
    const ticketId = created.body.ticket.id;

    await request(app)
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'First' });
    await request(app)
      .post(`/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Second' });

    const res = await request(app).get(`/tickets/${ticketId}/comments`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.comments.map((c) => c.text)).toEqual(['First', 'Second']);
  });

  it("rejects a third-party customer with 403, not leaking the ticket's existence via 404", async () => {
    const { token: ownerToken } = await createUserWithToken({ role: 'customer' });
    const { token: otherToken } = await createUserWithToken({ role: 'customer' });
    const created = await createTicketAs(ownerToken);

    const res = await request(app)
      .get(`/tickets/${created.body.ticket.id}/comments`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});
