const { canAccessTicket } = require('../src/utils/ticketAccess');

// This is the single shared gate every ticket/comment endpoint routes
// through -- fixed a real bypass in it earlier this project (the assign
// endpoint skipped it entirely). Pure function, no DB needed, so it gets
// its own fast, direct suite instead of relying only on HTTP round-trips
// to exercise every role/ticket combination.
describe('canAccessTicket', () => {
  describe('admin', () => {
    const admin = { id: 1, role: 'admin' };

    it('can access any ticket regardless of requester or assignee', () => {
      expect(canAccessTicket(admin, { requesterId: 999, assigneeId: 999 })).toBe(true);
      expect(canAccessTicket(admin, { requesterId: null, assigneeId: null })).toBe(true);
    });
  });

  describe('customer', () => {
    const customer = { id: 5, role: 'customer' };

    it('can access a ticket they requested', () => {
      expect(canAccessTicket(customer, { requesterId: 5, assigneeId: null })).toBe(true);
    });

    it('cannot access a ticket requested by someone else', () => {
      expect(canAccessTicket(customer, { requesterId: 6, assigneeId: null })).toBe(false);
    });

    it('assignment has no bearing on a customer\'s access', () => {
      // Even if somehow assigned to them, they only ever see their own
      // requested tickets -- requesterId is the only thing that matters.
      expect(canAccessTicket(customer, { requesterId: 6, assigneeId: 5 })).toBe(false);
    });
  });

  describe('agent', () => {
    const agent = { id: 7, role: 'agent' };

    it('can access a ticket assigned to them', () => {
      expect(canAccessTicket(agent, { requesterId: 1, assigneeId: 7 })).toBe(true);
    });

    it('can access an unassigned ticket (the pickup pool)', () => {
      expect(canAccessTicket(agent, { requesterId: 1, assigneeId: null })).toBe(true);
    });

    it('cannot access a ticket assigned to a different agent', () => {
      expect(canAccessTicket(agent, { requesterId: 1, assigneeId: 8 })).toBe(false);
    });

    it('being the requester does not grant access on its own', () => {
      // An agent who happens to be the requester (e.g. filed their own
      // ticket) is still scoped by assigneeId, not requesterId.
      expect(canAccessTicket(agent, { requesterId: 7, assigneeId: 8 })).toBe(false);
    });
  });

  describe('unrecognized role', () => {
    it('defaults to no access rather than throwing', () => {
      expect(canAccessTicket({ id: 1, role: 'guest' }, { requesterId: 1, assigneeId: null })).toBe(false);
      expect(canAccessTicket({ id: 1, role: undefined }, { requesterId: 1, assigneeId: null })).toBe(false);
    });
  });
});
