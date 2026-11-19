/*
 * "I'm not sure" handoff (confidence-based escalation): when the AI is
 * unsure it should not guess -- the ticket (or assistant answer) is
 * marked "Needs human check" for staff, and how often that happens is
 * recorded.
 */

jest.mock('../src/services/aiService', () => ({
  getAiSuggestions: jest.fn(),
}));
jest.mock('../src/services/emotionDetectionService', () => ({
  detectEmotion: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/services/rag/generationService', () => ({
  generate: jest.fn(),
  generateWithConfidence: jest.fn(),
  generateWithAgent: jest.fn().mockResolvedValue({
    content: 'Restart the router.',
    agent: 'main',
    provider: 'ollama',
    model: 'test',
    fellBack: false,
  }),
  getModelInfo: jest.fn().mockReturnValue({ name: 'ollama:test' }),
}));
jest.mock('../src/services/rag/retrievalService');
jest.mock('../src/services/rag/webSearchService');

const request = require('supertest');
const app = require('../src/app');
const { sequelize, Ticket } = require('../src/models');
const { getAiSuggestions } = require('../src/services/aiService');
const { generateWithConfidence } = require('../src/services/rag/generationService');
const { retrieve } = require('../src/services/rag/retrievalService');
const webSearchService = require('../src/services/rag/webSearchService');
const { analyzeTicket } = require('../src/services/aiAnalysisService');
const { ask } = require('../src/services/rag/ragService');
const { assistUser } = require('../src/services/aiAssistantService');
const { valueConfidence, humanCheckReasons } = require('../src/utils/aiConfidence');
const { createUserWithToken } = require('./helpers/testHelpers');
const { createTicketAs } = require('./helpers/ticketHelpers');

afterAll(async () => {
  await sequelize.close();
});

const SURE = {
  category: 'Network',
  priority: 'High',
  suggestedResponse: 'Checking.',
  categoryValid: true,
  priorityValid: true,
  categoryConfidence: 0.97,
  priorityConfidence: 0.95,
};

// Ollama token list for a reply, with the given probability on the
// first token of each value.
function tokensFor(content, probabilities) {
  return content.match(/\s?\S+|\s+/g).map((token) => {
    const word = token.trim();
    const p = probabilities[word];
    return { token, logprob: Math.log(p ?? 0.99) };
  });
}

describe('valueConfidence', () => {
  const reply = 'Category: Network\nPriority: High\nSuggested Response: Check it.';

  it('reads the probability of the first token of the value', () => {
    const tokens = tokensFor(reply, { High: 0.42, Network: 0.9 });
    expect(valueConfidence(reply, tokens, 'Priority')).toBe(0.42);
    expect(valueConfidence(reply, tokens, 'Category')).toBe(0.9);
  });

  it('gives null when there are no tokens, no label, or tokens that do not match the text', () => {
    expect(valueConfidence(reply, null, 'Priority')).toBeNull();
    expect(valueConfidence('no labels here', tokensFor('no labels here', {}), 'Priority')).toBeNull();
    expect(valueConfidence(reply, [{ token: 'other', logprob: -0.1 }], 'Priority')).toBeNull();
  });
});

describe('humanCheckReasons', () => {
  it('is empty when the AI is sure', () => {
    expect(humanCheckReasons(SURE)).toEqual([]);
  });

  it('flags low confidence for each field', () => {
    expect(humanCheckReasons({ ...SURE, priorityConfidence: 0.3 })).toEqual(['low_priority_confidence']);
    expect(humanCheckReasons({ ...SURE, categoryConfidence: 0.3 })).toEqual(['low_category_confidence']);
  });

  it('flags an answer the AI wrote that could not be read', () => {
    expect(humanCheckReasons({ ...SURE, priorityValid: false })).toEqual(['unclear_ai_priority']);
  });

  it('flags tickets the AI could not classify or that tried to instruct it', () => {
    expect(humanCheckReasons({ category: null, priority: null })).toEqual(['ai_unavailable']);
    expect(humanCheckReasons({ category: null, priority: null, injectionDetected: ['x'] })).toEqual([
      'prompt_injection',
    ]);
  });

  it("ignores the AI's confidence for a field the customer chose", () => {
    const unsure = { ...SURE, priorityConfidence: 0.2 };
    expect(humanCheckReasons(unsure, { aiDecided: { priority: false, category: true } })).toEqual([]);
  });

  it('never flags just because confidence is unknown (provider without token data)', () => {
    expect(humanCheckReasons({ ...SURE, priorityConfidence: null, categoryConfidence: null })).toEqual([]);
  });
});

describe('analyzeTicket reports how sure the model was', () => {
  it('returns the token confidence for priority and category', async () => {
    const content = 'Category: Network\nPriority: High\nSuggested Response: Check the switch.';
    generateWithConfidence.mockResolvedValueOnce({
      content,
      tokens: tokensFor(content, { High: 0.41, Network: 0.88 }),
    });

    const result = await analyzeTicket('The network is down on level 2.');

    expect(result).toMatchObject({
      category: 'Network',
      priority: 'High',
      priorityConfidence: 0.41,
      categoryConfidence: 0.88,
      priorityValid: true,
      categoryValid: true,
    });
  });

  it('marks a made-up value as not valid', async () => {
    const content = 'Category: Network\nPriority: Urgent\nSuggested Response: x';
    generateWithConfidence.mockResolvedValueOnce({ content, tokens: null });

    const result = await analyzeTicket('Something happened.');

    expect(result.priority).toBe('Medium'); // parser fallback
    expect(result.priorityValid).toBe(false);
    expect(result.priorityConfidence).toBeNull();
  });
});

describe('tickets are marked "Needs human check"', () => {
  it('when the AI was unsure of the priority', async () => {
    getAiSuggestions.mockResolvedValueOnce({ ...SURE, priorityConfidence: 0.31 });
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token);

    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({
      needsHumanCheck: true,
      humanCheckReasons: ['low_priority_confidence'],
      aiPriorityConfidence: 0.31,
    });
  });

  it('not when the AI was sure', async () => {
    getAiSuggestions.mockResolvedValueOnce(SURE);
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token);

    expect(res.body.ticket.needsHumanCheck).toBe(false);
    expect(res.body.ticket.humanCheckReasons).toBeNull();
  });

  it('not for an unsure priority when the customer chose the priority', async () => {
    getAiSuggestions.mockResolvedValueOnce({ ...SURE, priorityConfidence: 0.2 });
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token, { priority: 'Low' });

    expect(res.body.ticket.needsHumanCheck).toBe(false);
  });

  it('when the AI was unavailable', async () => {
    getAiSuggestions.mockResolvedValueOnce({ category: null, priority: null, suggestedResponse: null });
    const { token } = await createUserWithToken({ role: 'customer' });

    const res = await createTicketAs(token);

    expect(res.body.ticket.humanCheckReasons).toEqual(['ai_unavailable']);
  });
});

describe('staff check flagged tickets', () => {
  async function flaggedTicket(extra = {}) {
    getAiSuggestions.mockResolvedValueOnce({ ...SURE, priorityConfidence: 0.3, ...extra });
    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const { user: admin, token: adminToken } = await createUserWithToken({ role: 'admin' });
    const created = await createTicketAs(customer);
    return { id: created.body.ticket.id, customer, admin, adminToken };
  }

  it('changing the priority clears the flag and records that the AI was wrong', async () => {
    const { id, admin, adminToken } = await flaggedTicket();

    const res = await request(app)
      .patch(`/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 'Medium' });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({
      needsHumanCheck: false,
      humanCheckOutcome: 'changed',
      humanCheckedById: admin.id,
      humanCheckReasons: ['low_priority_confidence'], // kept for the record
    });
    expect(res.body.ticket.humanCheckedAt).toBeTruthy();
  });

  it('"Mark as checked" keeps the AI answer and records it as confirmed', async () => {
    const { id, adminToken } = await flaggedTicket();

    const res = await request(app)
      .patch(`/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ needsHumanCheck: false });

    expect(res.body.ticket).toMatchObject({ needsHumanCheck: false, humanCheckOutcome: 'confirmed' });
  });

  it('a customer cannot clear the flag', async () => {
    const { id, customer } = await flaggedTicket();

    const res = await request(app)
      .patch(`/tickets/${id}`)
      .set('Authorization', `Bearer ${customer}`)
      .send({ needsHumanCheck: false });

    expect(res.status).toBe(403);
    expect((await Ticket.findByPk(id)).needsHumanCheck).toBe(true);
  });

  it('staff can flag a ticket by hand', async () => {
    getAiSuggestions.mockResolvedValueOnce(SURE);
    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });
    const id = (await createTicketAs(customer)).body.ticket.id;

    const res = await request(app)
      .patch(`/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ needsHumanCheck: true });

    expect(res.body.ticket).toMatchObject({
      needsHumanCheck: true,
      humanCheckReasons: ['flagged_by_staff'],
    });
  });
});

describe('recording how often it happens', () => {
  it('lists only flagged tickets with ?needsHumanCheck=true', async () => {
    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    getAiSuggestions.mockResolvedValueOnce({ ...SURE, priorityConfidence: 0.2 });
    const unsure = (await createTicketAs(customer)).body.ticket.id;
    getAiSuggestions.mockResolvedValueOnce(SURE);
    const sure = (await createTicketAs(customer)).body.ticket.id;
    await Ticket.update({ assigneeId: agent.id }, { where: { id: [unsure, sure] } });

    const res = await request(app)
      .get(`/tickets?assigneeId=${agent.id}&needsHumanCheck=true`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.tickets.map((t) => t.id)).toEqual([unsure]);
  });

  it('the handoff summary counts handoffs, reasons and outcomes', async () => {
    const { token: customer } = await createUserWithToken({ role: 'customer' });
    const { user: agent } = await createUserWithToken({ role: 'agent' });
    const { token: adminToken } = await createUserWithToken({ role: 'admin' });

    getAiSuggestions
      .mockResolvedValueOnce({ ...SURE, priorityConfidence: 0.2 })
      .mockResolvedValueOnce({ ...SURE, categoryConfidence: 0.2 })
      .mockResolvedValueOnce({ ...SURE, priorityConfidence: 0.2 })
      .mockResolvedValueOnce(SURE);
    const ids = [];
    for (let i = 0; i < 4; i += 1) ids.push((await createTicketAs(customer)).body.ticket.id);
    await Ticket.update({ assigneeId: agent.id }, { where: { id: ids } });

    const patch = (id, body) =>
      request(app).patch(`/tickets/${id}`).set('Authorization', `Bearer ${adminToken}`).send(body);
    await patch(ids[0], { priority: 'Low' }); // AI was wrong
    await patch(ids[1], { needsHumanCheck: false }); // AI was right

    const res = await request(app)
      .get(`/tickets/handoff-summary?assigneeId=${agent.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      total: 4,
      handedOff: 3,
      waiting: 1,
      checked: 2,
      confirmed: 1,
      changed: 1,
      reasons: { low_priority_confidence: 2, low_category_confidence: 1 },
    });
  });

  it('customers cannot see the handoff summary', async () => {
    const { token } = await createUserWithToken({ role: 'customer' });
    const res = await request(app).get('/tickets/handoff-summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('assistant: a weak knowledge-base match needs a human check', () => {
  const match = (score) => ({
    id: 1,
    articleId: 3,
    articleTitle: 'Wi-Fi',
    category: 'Network',
    heading: 'Connect',
    text: 'Pick the campus network and sign in.',
    score,
  });
  const retrieval = (score) => ({
    question: 'q',
    topScore: score,
    threshold: 0.59,
    matches: [match(score)],
    relevant: [match(score)],
    hasRelevantContext: true,
    searched: 10,
  });

  beforeEach(() => {
    webSearchService.search.mockResolvedValue({ results: [], provider: 'none' });
  });

  it('marks an answer that only just cleared the threshold', async () => {
    retrieve.mockResolvedValue(retrieval(0.61));

    const result = await ask('wifi problem', { agent: 'main' });

    expect(result.grounded).toBe(true);
    expect(result.lowConfidence).toBe(true);
  });

  it('does not mark a strong match', async () => {
    retrieve.mockResolvedValue(retrieval(0.8));

    const result = await ask('wifi problem', { agent: 'main' });

    expect(result.lowConfidence).toBe(false);
  });

  it('does not mark a weak match backed up by a web result', async () => {
    retrieve.mockResolvedValue(retrieval(0.61));
    webSearchService.search.mockResolvedValue({
      results: [{ title: 'Wi-Fi help', url: 'https://example.com', snippet: 'Steps.' }],
      provider: 'duckduckgo',
    });

    const result = await ask('wifi problem', { agent: 'main' });

    expect(result.lowConfidence).toBe(false);
  });

  it('the assistant response says "needs human check" and offers a ticket', async () => {
    retrieve.mockResolvedValue(retrieval(0.6));

    const response = await assistUser('wifi problem', { agent: 'main' });

    expect(response.needsHumanCheck).toBe(true);
    expect(response.shouldCreateTicket).toBe(true);
  });
});
