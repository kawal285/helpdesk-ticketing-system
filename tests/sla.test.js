const {
  DEFAULT_SLA_TARGETS,
  SLA_HOURS,
  computeDueDates,
  getTargetStatus,
  getSlaStatus,
} = require('../src/utils/sla');
const { PRIORITIES } = require('../src/utils/ticketFields');

describe('computeDueDates', () => {
  const anchor = new Date('2026-01-01T00:00:00.000Z');

  it('adds the response and resolution minutes to the anchor', () => {
    const { responseDueAt, resolutionDueAt } = computeDueDates(
      { responseMinutes: 15, resolutionMinutes: 240 },
      anchor
    );
    expect(responseDueAt).toEqual(new Date('2026-01-01T00:15:00.000Z'));
    expect(resolutionDueAt).toEqual(new Date('2026-01-01T04:00:00.000Z'));
  });

  it('is anchored to the given time, not the current time', () => {
    const { resolutionDueAt } = computeDueDates(
      { responseMinutes: 60, resolutionMinutes: 60 },
      new Date('2020-06-15T12:30:00.000Z')
    );
    expect(resolutionDueAt).toEqual(new Date('2020-06-15T13:30:00.000Z'));
  });
});

describe('DEFAULT_SLA_TARGETS', () => {
  it('has a target for every priority', () => {
    PRIORITIES.forEach((priority) => {
      expect(DEFAULT_SLA_TARGETS[priority]).toEqual({
        responseMinutes: expect.any(Number),
        resolutionMinutes: expect.any(Number),
      });
    });
  });

  it('always gives a response target shorter than the resolution target', () => {
    Object.values(DEFAULT_SLA_TARGETS).forEach((t) => {
      expect(t.responseMinutes).toBeLessThan(t.resolutionMinutes);
    });
  });

  it('keeps the resolution times the system used before the table existed', () => {
    expect(SLA_HOURS).toEqual({ Critical: 4, High: 8, Medium: 24, Low: 72, Trivial: 120 });
  });
});

describe('getTargetStatus', () => {
  // A 100-minute window: 00:00 -> 01:40. 75% used = 01:15.
  const startAt = new Date('2026-01-01T00:00:00.000Z');
  const dueAt = new Date('2026-01-01T01:40:00.000Z');
  const at = (hhmm) => new Date(`2026-01-01T${hhmm}:00.000Z`);

  it('is on_track before 75% of the time is used', () => {
    expect(getTargetStatus({ startAt, dueAt, now: at('00:00') })).toBe('on_track');
    expect(getTargetStatus({ startAt, dueAt, now: at('01:14') })).toBe('on_track');
  });

  it('is at_risk from 75% of the time used until the deadline', () => {
    expect(getTargetStatus({ startAt, dueAt, now: at('01:15') })).toBe('at_risk');
    expect(getTargetStatus({ startAt, dueAt, now: at('01:40') })).toBe('at_risk');
  });

  it('is breached once the deadline has passed', () => {
    expect(getTargetStatus({ startAt, dueAt, now: at('01:41') })).toBe('breached');
  });

  it('stays on_track when completed by the deadline, however late it is now', () => {
    expect(
      getTargetStatus({ startAt, dueAt, completedAt: at('01:30'), now: at('09:00') })
    ).toBe('on_track');
  });

  it('is breached when completed after the deadline', () => {
    expect(
      getTargetStatus({ startAt, dueAt, completedAt: at('02:00'), now: at('09:00') })
    ).toBe('breached');
  });

  it('is null when there is no due date', () => {
    expect(getTargetStatus({ startAt, dueAt: null, now: at('01:00') })).toBeNull();
  });
});

describe('getSlaStatus', () => {
  it('reports response and resolution separately', () => {
    const ticket = {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      responseDueAt: new Date('2026-01-01T00:15:00.000Z'),
      firstRespondedAt: null,
      dueAt: new Date('2026-01-01T04:00:00.000Z'),
      resolvedAt: null,
    };
    // 1 hour in: response window (15 min) is blown, resolution is 25% used.
    const sla = getSlaStatus(ticket, new Date('2026-01-01T01:00:00.000Z'));

    expect(sla.response).toEqual({ dueAt: ticket.responseDueAt, completedAt: null, status: 'breached' });
    expect(sla.resolution).toEqual({ dueAt: ticket.dueAt, completedAt: null, status: 'on_track' });
  });
});
