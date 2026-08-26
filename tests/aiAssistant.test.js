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
  sources: [],
  topScore: 0.4959,
  threshold: 0.59,
  model: 'ollama:llama3.2',
  ms: 310,
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

  /*
   * The role must come from the authenticated user, never the request body,
   * or a customer could ask for staff-only content by claiming a role.
   */
  test("passes the signed-in user's role through to retrieval", async () => {
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