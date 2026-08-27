describe('ticketProviders registry', () => {
  const ORIGINAL_ENV = process.env.TICKET_PROVIDER;

  // The registry caches its resolved provider in module state, so each
  // test needs a clean require + explicit cache reset to observe a
  // different TICKET_PROVIDER value. This file never touches app.js, so
  // resetting modules here can't disconnect anything else from the
  // registry it actually uses -- see ticketProviderSwap.test.js for the
  // HTTP-level test, which deliberately avoids resetModules for that
  // exact reason.
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.TICKET_PROVIDER;
    } else {
      process.env.TICKET_PROVIDER = ORIGINAL_ENV;
    }
  });

  it('defaults to the local-sequelize provider when TICKET_PROVIDER is unset', () => {
    delete process.env.TICKET_PROVIDER;
    const { getProvider } = require('../src/services/ticketProviders');

    const provider = getProvider();

    expect(typeof provider.createTicket).toBe('function');
    expect(typeof provider.getTicketById).toBe('function');
    expect(typeof provider.listTickets).toBe('function');
    expect(typeof provider.getOverdueTickets).toBe('function');
    expect(typeof provider.updateTicket).toBe('function');
  });

  it('throws a clear error for an unregistered provider name', () => {
    process.env.TICKET_PROVIDER = 'zendesk';
    const { getProvider } = require('../src/services/ticketProviders');

    expect(() => getProvider()).toThrow(/Unknown TICKET_PROVIDER "zendesk"/);
  });

  it('caches the resolved provider across calls', () => {
    delete process.env.TICKET_PROVIDER;
    const { getProvider } = require('../src/services/ticketProviders');

    expect(getProvider()).toBe(getProvider());
  });

  it('resetProviderCache forces re-resolution', () => {
    delete process.env.TICKET_PROVIDER;
    const { getProvider, resetProviderCache } = require('../src/services/ticketProviders');

    const first = getProvider();
    resetProviderCache();
    const second = getProvider();

    expect(first).not.toBe(second);
  });
});
