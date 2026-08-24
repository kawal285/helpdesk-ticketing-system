jest.mock('../src/middleware/protect', () => {
  return (req, res, next) => {
    req.user = {
      id: 1,
      name: 'Test User',
      role: 'customer',
    };
    next();
  };
});

jest.mock('../src/services/aiService', () => ({
  getAiSuggestions: jest.fn(),
}));

jest.mock('../src/services/rag/ragService', () => ({
  ask: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const {
  getAiSuggestions,
} = require('../src/services/aiService');
const { ask: ragAsk } = require('../src/services/rag/ragService');

describe('AI self-service assistant API', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getAiSuggestions.mockResolvedValue({
      category: 'Hardware',
      priority: 'Medium',
      suggestedResponse: 'Follow the approved troubleshooting steps.',
    });
  });

  test('returns a grounded RAG answer with its source when the knowledge base covers the question', async () => {
    ragAsk.mockResolvedValue({
      answer: 'Check the paper tray and clear any jams before contacting support.',
      grounded: true,
      sources: [{ articleId: 3, title: 'Printer troubleshooting guide', section: 'Jams', category: 'Hardware', score: 0.87 }],
      topScore: 0.87,
      threshold: 0.59,
      model: 'ollama:llama3.2',
      ms: 1200,
    });

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'The office printer is not printing' });

    expect(response.statusCode).toBe(200);
    expect(response.body.assistant.knowledgeBaseMatch).toBe(true);
    expect(response.body.assistant.source).toEqual({ id: 3, title: 'Printer troubleshooting guide' });
    expect(response.body.assistant.shouldCreateTicket).toBe(false);
    expect(response.body.assistant.suggestedCategory).toBe('Hardware');
    expect(ragAsk).toHaveBeenCalledWith('The office printer is not printing');
  });

  test('recommends a ticket when RAG finds nothing relevant', async () => {
    ragAsk.mockResolvedValue({
      answer: "I couldn't find anything in the IT knowledge base that covers this, so I don't want to guess.",
      grounded: false,
      sources: [],
      topScore: 0.41,
      threshold: 0.59,
      model: 'ollama:llama3.2',
      ms: 300,
    });

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'The microwave in the staff kitchen is making a strange noise' });

    expect(response.statusCode).toBe(200);
    expect(response.body.assistant.knowledgeBaseMatch).toBe(false);
    expect(response.body.assistant.source).toBeNull();
    expect(response.body.assistant.shouldCreateTicket).toBe(true);
  });

  test('falls back to keyword search when the RAG pipeline throws', async () => {
    ragAsk.mockRejectedValue(new Error('Could not reach Ollama at http://127.0.0.1:11434'));

    const response = await request(app)
      .post('/ai/assist')
      .send({ question: 'The office printer is not printing' });

    // The real knowledgeBase.json data covers printers, so the legacy
    // keyword-search fallback should still find a match rather than the
    // request failing outright.
    expect(response.statusCode).toBe(200);
    expect(response.body.assistant.knowledgeBaseMatch).toBe(true);
    expect(response.body.assistant.source.title.toLowerCase()).toContain('printer');
    expect(response.body.assistant.suggestedCategory).toBe('Hardware');
  });

  test('rejects an empty request body', async () => {
    const response = await request(app)
      .post('/ai/assist')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      'A non-empty IT question is required.'
    );
    expect(ragAsk).not.toHaveBeenCalled();
  });

  test('rejects a blank question', async () => {
    const response = await request(app)
      .post('/ai/assist')
      .send({
        question: '   ',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      'A non-empty IT question is required.'
    );
  });
});
