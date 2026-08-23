const { isValidTransition, editPermissionError, getStatusLabel, STATUSES } = require('../src/utils/ticketStatus');

describe('isValidTransition', () => {
  it('always allows staying in the same status, for every status, regardless of role', () => {
    STATUSES.forEach((status) => {
      expect(isValidTransition(status, status, false)).toBe(true);
      expect(isValidTransition(status, status, true)).toBe(true);
    });
  });

  it('allows the documented non-admin transitions', () => {
    expect(isValidTransition('Open', 'In Progress', false)).toBe(true);
    expect(isValidTransition('Open', 'Resolved', false)).toBe(true);
    expect(isValidTransition('Open', 'Closed', false)).toBe(true);
    expect(isValidTransition('In Progress', 'Open', false)).toBe(true);
    expect(isValidTransition('In Progress', 'Resolved', false)).toBe(true);
    expect(isValidTransition('In Progress', 'Closed', false)).toBe(true);
    expect(isValidTransition('Resolved', 'In Progress', false)).toBe(true);
    expect(isValidTransition('Resolved', 'Closed', false)).toBe(true);
  });

  it('rejects transitions not on the documented list for a non-admin', () => {
    expect(isValidTransition('Resolved', 'Open', false)).toBe(false);
    expect(isValidTransition('Closed', 'Open', false)).toBe(false);
    expect(isValidTransition('Closed', 'In Progress', false)).toBe(false);
    expect(isValidTransition('Closed', 'Resolved', false)).toBe(false);
  });

  it('lets an admin make any transition, including ones a non-admin cannot', () => {
    expect(isValidTransition('Closed', 'Open', true)).toBe(true);
    expect(isValidTransition('Resolved', 'Open', true)).toBe(true);
    expect(isValidTransition('Closed', 'In Progress', true)).toBe(true);
  });
});

describe('editPermissionError', () => {
  it('never blocks an admin, on any ticket status', () => {
    const admin = { role: 'admin' };
    STATUSES.forEach((status) => {
      expect(editPermissionError(admin, { status })).toBeNull();
    });
  });

  it('never blocks an agent, on any ticket status', () => {
    const agent = { role: 'agent' };
    STATUSES.forEach((status) => {
      expect(editPermissionError(agent, { status })).toBeNull();
    });
  });

  it('lets a customer edit their ticket only while it is Open', () => {
    const customer = { role: 'customer' };
    expect(editPermissionError(customer, { status: 'Open' })).toBeNull();
  });

  it('blocks a customer from editing once the ticket has moved past Open', () => {
    const customer = { role: 'customer' };
    expect(editPermissionError(customer, { status: 'In Progress' })).toBe('Only open tickets can be edited.');
    expect(editPermissionError(customer, { status: 'Resolved' })).toBe('Only open tickets can be edited.');
    expect(editPermissionError(customer, { status: 'Closed' })).toBe('Only open tickets can be edited.');
  });
});

describe('getStatusLabel', () => {
  it('returns the friendly label for each known status', () => {
    expect(getStatusLabel('Open')).toBe('Open');
    expect(getStatusLabel('In Progress')).toBe('In Progress');
    expect(getStatusLabel('Resolved')).toBe('Resolved – Awaiting Review');
    expect(getStatusLabel('Closed')).toBe('Reviewed and Closed');
  });

  it('falls back to the raw value for an unmapped status', () => {
    expect(getStatusLabel('Archived')).toBe('Archived');
  });
});
