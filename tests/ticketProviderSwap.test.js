const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { createUserWithToken } = require('./helpers/testHelpers');
const { getProvider, registerProvider, resetProviderCache } = require('../src/services/ticketProviders');
const { Ticket } = require('../src/models');

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
    // The API adds a computed `sla` block on top of whatever the provider returns.
    expect(res.body.tickets).toEqual([{
      ...fakeCrmTicket,
      priorityLevel: 'P4',
      aiPriorityLevel: null,
      sla: expect.any(Object),
    }]);
  });

  // Comment.ticketId is a real MySQL foreign key into the local tickets
  // table (comment.model.js), so a comment can never be inserted against
  // an id that has no local row at all -- that's a schema constraint of
  // this app's own Comment storage, independent of which ticket provider
  // is active, and out of scope to change here. To isolate what this fix
  // actually claims (ticket *lookup* -- access control and the data used
  // for notifications -- goes through the provider, not Ticket.findByPk),
  // a local row is planted only to satisfy that FK, deliberately with a
  // requesterId that does NOT belong to the commenter. If the controller
  // were still reading that local row, canAccessTicket would reject the
  // customer with 403; success here is only possible because it reads
  // the swapped-in provider's ticket instead.
  it('lets a comment be posted using the swapped-in provider\'s ticket data, not the local row', async () => {
    const { user: customer, token } = await createUserWithToken({ role: 'customer' });
    const { user: someoneElse } = await createUserWithToken({ role: 'customer' });

    const localPlaceholder = await Ticket.create({
      title: 'Local placeholder row (FK only)',
      description: 'Not the data this test should ever read.',
      category: 'Other',
      priority: 'Low',
      status: 'Open',
      requesterId: someoneElse.id,
      organization: 'Future Skills',
      dueAt: new Date(),
    });

    const fakeCrmTicket = {
      id: localPlaceholder.id,
      title: 'From the fake CRM',
      description: 'stub',
      category: 'Other',
      priority: 'Low',
      status: 'Open',
      requesterId: customer.id,
      assigneeId: null,
      organization: 'Future Skills',
      dueAt: new Date().toISOString(),
      requester: { id: customer.id, name: customer.name },
      assignee: null,
    };

    registerProvider('fake-crm', () => ({
      createTicket: async () => fakeCrmTicket,
      getTicketById: async (id) => (Number(id) === fakeCrmTicket.id ? fakeCrmTicket : null),
      listTickets: async () => ({ rows: [fakeCrmTicket], count: 1 }),
      getOverdueTickets: async () => [],
      updateTicket: async () => fakeCrmTicket,
    }));

    process.env.TICKET_PROVIDER = 'fake-crm';
    resetProviderCache();

    const res = await request(app)
      .post(`/tickets/${fakeCrmTicket.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Any update on this?' });

    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe('Any update on this?');
  });

  it('unassigns a swapped-provider-backed ticket when its agent is deactivated', async () => {
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });

    // A tiny in-memory store so updateTicket's effect is actually
    // observable, proving unassignOpenTickets (previously a direct
    // Ticket.update call) now goes through the provider instead.
    const store = new Map([
      [
        'crm-deactivate-1',
        {
          id: 'crm-deactivate-1',
          status: 'Open',
          assigneeId: agent.id,
          requesterId: 1,
        },
      ],
    ]);

    registerProvider('fake-crm', () => ({
      createTicket: async () => { throw new Error('not used in this test'); },
      getTicketById: async (id) => store.get(id) || null,
      listTickets: async (filter = {}) => {
        const rows = [...store.values()].filter((ticket) => {
          if (filter.assigneeId !== undefined && ticket.assigneeId !== filter.assigneeId) return false;
          if (filter.statusNotIn && filter.statusNotIn.includes(ticket.status)) return false;
          return true;
        });

        return { rows, count: rows.length };
      },
      getOverdueTickets: async () => [],
      updateTicket: async (id, changes) => {
        const ticket = store.get(id);
        if (!ticket) return null;
        Object.assign(ticket, changes);
        return ticket;
      },
    }));

    process.env.TICKET_PROVIDER = 'fake-crm';
    resetProviderCache();

    const res = await request(app)
      .patch(`/users/${agent.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(store.get('crm-deactivate-1').assigneeId).toBeNull();
  });
});
