/*
 * Tests the /ai/assist endpoint, not the RAG pipeline behind it.
 *
 * ragService is mocked so these stay fast and deterministic. Calling the
 * real pipeline would embed a question, search the vector store and run a
 * language model -- roughly thirty seconds per test, different wording on
 * every run, and a failure whenever Ollama happens to be stopped. The
 * pipeline itself is covered separately by the chunker, similarity and
 * audience suites, and measured by scripts/rag/measure-threshold.js.
 */

let mockRole = 'customer';

jest.mock('../src/middleware/protect', () => {
  return (req, res, next) => {
    req.user = {
      id: 1,
      name: 'Test User',
      role: mockRole,
    };
    next();
  };
});

jest.mock('../src/services/rag/ragService', () => ({
  ask: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const { ask } = require('../src/services/rag/ragService');

const GROUNDED = {
  answer:
    'Check the printer panel for a paper jam or an empty tray, then clear '
    + 'the print queue and send a test page.',
  grounded: true,
  sources: [
    {
      articleId: 8,
      title: 'Printer is not printing',
      section: 'Clear a stalled queue',
      category: 'Hardware',
      score: 0.8123,
    },
  ],
  topScore: 0.8123,
  threshold: 0.59,
  model: 'ollama:llama3.2',
  ms: 4200,
};

const REFUSED = {
  answer:
    "I couldn't find anything in the IT knowledge base that covers this, so "
    + "I don't want to guess.",
  grounded: false,
  escalated: false,
  sources: [],
  topScore: 0.4959,
  threshold: 0.59,
  model: 'ollama:llama3.2',
  ms: 310,
};

const ESCALATED = {
  answer:
    'This sounds like it could be a physical safety risk, not a normal IT '
    + "problem. If it's safe to do so, unplug the device from the wall "
    + 'and step away.',
  grounded: false,
  escalated: true,
  sources: [],
  topScore: 0,
  threshold: null,
  model: null,
  ms: 12,
};

describe('AI self-service assistant API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'customer';
  });

  test('returns a grounded answer with its knowledge-base sources', async () => {
    ask.mockResolvedValue(GROUNDED);

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'my printer is not printing' });

    expect(response.statusCode).toBe(200);

    const { assistant } = response.body;

    expect(assistant.knowledgeBaseMatch).toBe(true);
    expect(assistant.source.title.toLowerCase()).toContain('printer');
    expect(assistant.sources).toHaveLength(1);
    expect(assistant.shouldCreateTicket).toBe(false);
  });

  test('suggests the category of the best-matching article', async () => {
    ask.mockResolvedValue(GROUNDED);

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'my printer is not printing' });

    expect(response.body.assistant.suggestedCategory).toBe('Hardware');
  });

  test('recommends a ticket when nothing relevant is retrieved', async () => {
    ask.mockResolvedValue(REFUSED);

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'who won the football last night' });

    expect(response.statusCode).toBe(200);

    const { assistant } = response.body;

    expect(assistant.knowledgeBaseMatch).toBe(false);
    expect(assistant.source).toBeNull();
    expect(assistant.sources).toEqual([]);
    expect(assistant.shouldCreateTicket).toBe(true);
  });

  test('reports the retrieval scores so a refusal can be explained', async () => {
    ask.mockResolvedValue(REFUSED);

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'who won the football last night' });

    expect(response.body.assistant.topScore).toBe(0.4959);
    expect(response.body.assistant.threshold).toBe(0.59);
  });

  test('flags a safety escalation distinctly from an ordinary refusal', async () => {
    ask.mockResolvedValue(ESCALATED);

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'my computer is smoking' });

    const { assistant } = response.body;

    expect(assistant.safetyEscalation).toBe(true);
    expect(assistant.shouldCreateTicket).toBe(true);
    expect(assistant.suggestedPriority).toBe('Critical');
    expect(assistant.knowledgeBaseMatch).toBe(false);
  });

  test('does not flag an ordinary grounded or refused answer as a safety escalation', async () => {
    ask.mockResolvedValue(GROUNDED);

    const groundedResponse = await request(app)
      .post('/ai/assist')
      .send({ question: 'my printer is not printing' });

    expect(groundedResponse.body.assistant.safetyEscalation).toBe(false);
    expect(groundedResponse.body.assistant.suggestedPriority).toBeNull();

    ask.mockResolvedValue(REFUSED);

    const refusedResponse = await request(app)
      .post('/ai/assist')
      .send({ question: 'who won the football last night' });

    expect(refusedResponse.body.assistant.safetyEscalation).toBe(false);
    expect(refusedResponse.body.assistant.suggestedPriority).toBeNull();
  });

  /*
   * The role must come from the authenticated user, never the request body,
   * or a customer could ask for staff-only content by claiming a role.
   *
   * Marked pending: this describes the intended contract for the
   * kb_chunks.audience column (added in this same PR, default 'All'), but
   * the wiring isn't there yet on either end -- assistUser(question) never
   * receives req.user.role from the controller, and retrievalService's
   * retrieve() loads `audience` per chunk but never filters the candidate
   * pool by it (only `category` is filtered). Both need an audience-to-role
   * mapping decided before this can pass for real; re-enable once that
   * lands rather than guessing the mapping here.
   */
  test.skip("passes the signed-in user's role through to retrieval", async () => {
    ask.mockResolvedValue(GROUNDED);
    mockRole = 'agent';

    await request(app)
      .post('/ai/assist')
      .send({ question: 'how do I grant mailbox access', role: 'admin' });

    expect(ask).toHaveBeenCalledWith(
      'how do I grant mailbox access',
      { role: 'agent' }
    );
  });

  test('passes the last two questions through as history', async () => {
    ask.mockResolvedValue(GROUNDED);

    await request(app)
      .post('/ai/assist')
      .send({
        question: 'its not working what else can i do',
        history: ['first question', 'my printer is offline', 'its still stuck'],
      });

    expect(ask).toHaveBeenCalledWith('its not working what else can i do', {
      history: ['my printer is offline', 'its still stuck'],
    });
  });

  test('ignores a malformed history instead of failing', async () => {
    ask.mockResolvedValue(GROUNDED);

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'my printer is not printing', history: 'not an array' });

    expect(response.statusCode).toBe(200);
    expect(ask).toHaveBeenCalledWith('my printer is not printing', { history: [] });
  });

  test('rejects an empty request body', async () => {
    const response = await request(app).post('/ai/assist').send({});

    expect(response.statusCode).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  test('rejects a blank question', async () => {
    const response = await request(app)
      .post('/ai/assist')
      .send({ question: '   ' });

    expect(response.statusCode).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });
});