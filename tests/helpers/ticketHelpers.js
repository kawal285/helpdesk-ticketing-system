const request = require('supertest');
const app = require('../../src/app');

async function createTicketAs(token, body = {}) {
  return request(app)
    .post('/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Printer not working', description: 'The office printer jams on every print job.', ...body });
}

async function assignTicket(actorToken, ticketId, assigneeId) {
  return request(app)
    .patch(`/tickets/${ticketId}/assign`)
    .set('Authorization', `Bearer ${actorToken}`)
    .send({ assigneeId });
}

module.exports = { createTicketAs, assignTicket };
