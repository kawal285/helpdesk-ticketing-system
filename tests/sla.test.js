const { DEFAULT_SLA_TARGETS, SLA_HOURS, computeDueDates } = require('../src/utils/sla');
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
