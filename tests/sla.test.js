const { SLA_HOURS, computeDueAt } = require('../src/utils/sla');

describe('computeDueAt', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');

  it('adds the correct number of hours for each documented priority', () => {
    expect(computeDueAt('Critical', createdAt)).toEqual(new Date('2026-01-01T04:00:00.000Z'));
    expect(computeDueAt('High', createdAt)).toEqual(new Date('2026-01-01T08:00:00.000Z'));
    expect(computeDueAt('Medium', createdAt)).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(computeDueAt('Low', createdAt)).toEqual(new Date('2026-01-04T00:00:00.000Z'));
    expect(computeDueAt('Trivial', createdAt)).toEqual(new Date('2026-01-06T00:00:00.000Z'));
  });

  it('falls back to a 24-hour SLA for an unrecognized priority', () => {
    expect(computeDueAt('NotAPriority', createdAt)).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('is anchored to the given createdAt, not the current time', () => {
    const anchor = new Date('2020-06-15T12:30:00.000Z');
    expect(computeDueAt('Critical', anchor)).toEqual(new Date('2020-06-15T16:30:00.000Z'));
  });

  it('SLA_HOURS matches what computeDueAt actually uses, so the two can\'t silently drift', () => {
    Object.entries(SLA_HOURS).forEach(([priority, hours]) => {
      const expected = new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
      expect(computeDueAt(priority, createdAt)).toEqual(expected);
    });
  });
});
