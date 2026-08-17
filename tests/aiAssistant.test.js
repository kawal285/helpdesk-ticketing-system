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

const request = require('supertest');
const app = require('../src/app');
const {
  getAiSuggestions,
} = require('../src/services/aiService');

describe('AI self-service assistant API', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getAiSuggestions.mockResolvedValue({
      category: 'Hardware',
      priority: 'Medium',
      suggestedResponse: 'Follow the approved troubleshooting steps.',
    });
  });

  test('returns an approved KB answer for a printer question', async () => {
    const response = await request(app)
      .post('/ai/assist')
      .send({
        question: 'The office printer is not printing',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.assistant.knowledgeBaseMatch).toBe(true);
    expect(response.body.assistant.source.title.toLowerCase()).toContain(
      'printer'
    );
    expect(response.body.assistant.shouldCreateTicket).toBe(false);
    expect(response.body.assistant.suggestedCategory).toBe('Hardware');
  });

  test('recommends a ticket when no approved KB article matches', async () => {
    const response = await request(app)
      .post('/ai/assist')
      .send({
        question:
          'The microwave in the staff kitchen is making a strange noise',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.assistant.knowledgeBaseMatch).toBe(false);
    expect(response.body.assistant.source).toBeNull();
    expect(response.body.assistant.shouldCreateTicket).toBe(true);
  });

  test('rejects an empty request body', async () => {
    const response = await request(app)
      .post('/ai/assist')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      'A non-empty IT question is required.'
    );
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