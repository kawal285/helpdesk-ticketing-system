const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const { getProvider, registerProvider, resetProviderCache } = require('../src/services/ticketProviders');

afterAll(async () => {
  await sequelize.close();
});

// This is the actual guarantee the "plug and play with a different CRM"
// story asks for: a completely new provider becomes the one backing real
// HTTP requests purely through registration + config, with zero changes
// to the controller, the routes, or anything else that serves
// GET /tickets. If this passes, the ticketing interface is provably not
// locked into this app's own MySQL tables.
//
// Deliberately never calls jest.resetModules() anywhere in this file --
// app (required above) already loaded ticket.controller.js, which
// already loaded ticketProviders once, and this file registers directly
// onto that same cached instance. A reset would silently create a second,
// disconnected registry that the controller never sees, which is exactly
// the trap tests/ticketProviders.test.js avoids by living in its own file.
describe('ticket provider swap reaches real HTTP requests', () => {
  const ORIGINAL_ENV = process.env.TICKET_PROVIDER;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.TICKET_PROVIDER;
    } else {
      process.env.TICKET_PROVIDER = ORIGINAL_ENV;
    }

    resetProviderCache();
  });

  it('lets an entirely new provider back real ticket requests via registration + config alone', async () => {
    const fakeCrmTicket = {
      id: 'crm-99',
      title: 'From the fake CRM',
      description: 'stub',
      category: 'Other',
      priority: 'Low',
      status: 'Open',
      requesterId: 1,
      assigneeId: null,
      organization: 'Future Skills',
      dueAt: new Date().toISOString(),
      requester: { id: 1, name: 'Fake Requester' },
      assignee: null,
    };

    registerProvider('fake-crm', () => ({
      createTicket: async () => fakeCrmTicket,
      getTicketById: async () => fakeCrmTicket,
      listTickets: async () => ({ rows: [fakeCrmTicket], count: 1 }),
      getOverdueTickets: async () => [],
      updateTicket: async () => fakeCrmTicket,
    }));

    process.env.TICKET_PROVIDER = 'fake-crm';
    resetProviderCache();

    expect((await getProvider().listTickets()).rows).toEqual([fakeCrmTicket]);

    const { token } = await createUserWithToken({ role: 'admin' });
    const res = await request(app).get('/tickets').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.tickets).toEqual([fakeCrmTicket]);
  });
});
