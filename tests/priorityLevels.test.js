jest.mock('../src/services/aiService', () => ({
  getAiSuggestions: jest.fn().mockResolvedValue({
    category: 'Network',
    priority: 'High',
    suggestedResponse: 'Checking the switch.',
  }),
}));

jest.mock('../src/services/emotionDetectionService', () => ({
  detectEmotion: jest.fn().mockResolvedValue(null),
}));

const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const {
  priorityLevel,
  normalisePriority,
  PRIORITIES,
} = require('../src/utils/ticketFields');
const { parseAnalysis } = require('../src/services/aiAnalysisService');
const { DEFAULT_SLA_TARGETS } = require('../src/utils/sla');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

afterAll(async () => {
  await sequelize.close();
});

describe('P1-P4 levels', () => {
  it.each([
    ['Critical', 'P1'],
    ['High', 'P2'],
    ['Medium', 'P3'],
    ['Low', 'P4'],
    ['Trivial', 'P4'],
  ])('%s is %s', (priority, level) => {
    expect(priorityLevel(priority)).toBe(level);
  });

  it('every priority has a level, and unknown values have none', () => {
    PRIORITIES.forEach((p) => expect(priorityLevel(p)).toMatch(/^P[1-4]$/));
    expect(priorityLevel(null)).toBeNull();
    expect(priorityLevel('Urgent')).toBeNull();
  });

  it('a higher level never has a longer target than a lower one', () => {
    const order = ['Critical', 'High', 'Medium', 'Low'];
    for (let i = 1; i < order.length; i += 1) {
      const higher = DEFAULT_SLA_TARGETS[order[i - 1]];
      const lower = DEFAULT_SLA_TARGETS[order[i]];
      expect(higher.responseMinutes).toBeLessThan(lower.responseMinutes);
      expect(higher.resolutionMinutes).toBeLessThan(lower.resolutionMinutes);
    }
  });
});

describe('reading the AI priority', () => {
  it.each([
    ['High', 'High'],
    ['P2', 'High'],
    ['p1', 'Critical'],
    ['P3 - Medium', 'Medium'],
    ['Low (P4)', 'Low'],
    ['P4', 'Low'],
    ['Trivial', 'Trivial'],
    ['urgent!!', null],
  ])('%j -> %j', (input, expected) => {
    expect(normalisePriority(input)).toBe(expected);
  });

  it('parseAnalysis accepts a P-level from the model', () => {
    const result = parseAnalysis(
      'Category: Network\nPriority: P1\nSuggested Response: Checking the core switch.'
    );
    expect(result.priority).toBe('Critical');
  });

  it('parseAnalysis still falls back to Medium for nonsense', () => {
    const result = parseAnalysis('Category: Network\nPriority: Urgent\nSuggested Response: x');
    expect(result.priority).toBe('Medium');
  });
});

describe('P-levels through the API', () => {
  it('a new ticket shows its level and the AI suggestion level', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token);

    expect(res.status).toBe(201);
    expect(res.body.ticket.priority).toBe('High');
    expect(res.body.ticket.priorityLevel).toBe('P2');
    expect(res.body.ticket.aiPriorityLevel).toBe('P2');
  });

  it('the AI level sets the targets: P2 uses the High target times', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const { body } = await createTicketAs(token);
    const minutes = (field) =>
      Math.round((new Date(body.ticket[field]) - new Date(body.ticket.createdAt)) / 60000);

    expect(minutes('responseDueAt')).toBe(DEFAULT_SLA_TARGETS.High.responseMinutes);
    expect(minutes('dueAt')).toBe(DEFAULT_SLA_TARGETS.High.resolutionMinutes);
  });

  it('a priority can be sent as P1-P4', async () => {
    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const { token: admin } = await createUserWithToken({ role: 'admin' });
    const created = await createTicketAs(customer, { priority: 'P3' });

    expect(created.body.ticket.priority).toBe('Medium');

    const res = await request(app)
      .patch(`/tickets/${created.body.ticket.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ priority: 'p1' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.priority).toBe('Critical');
    expect(res.body.ticket.priorityLevel).toBe('P1');
  });

  it('rejects a level that does not exist', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { priority: 'P5' });

    expect(res.status).toBe(400);
  });
});
