/*
 * Shows that private details in a ticket or assistant question never
 * reach an external service. The lowest-level providers -- the chat
 * model, the embedding API, the web search engine, and the local Ollama
 * call used for emotion detection -- are replaced with recorders, then
 * everything they were sent is checked for the original values.
 */

process.env.WEB_SEARCH_PROVIDER = 'duckduckgo';
process.env.EMBEDDING_PROVIDER = 'gemini';

jest.mock('../src/services/rag/generationService', () => ({
  generate: jest.fn().mockResolvedValue(
    'Category: Account\nPriority: High\nSuggested Response: Reset it.'
  ),
  generateWithAgent: jest.fn().mockResolvedValue({
    content: 'Try signing in again.',
    agent: 'main',
    provider: 'ollama',
    model: 'test',
    fellBack: false,
  }),
  getModelInfo: jest.fn().mockReturnValue({ name: 'ollama:test' }),
}));

jest.mock('../src/services/rag/providers/duckduckgoSearch', () => ({
  name: 'duckduckgo',
  search: jest.fn().mockResolvedValue([
    { title: 'Sign-in help', url: 'https://example.com/a', snippet: 'Steps.' },
  ]),
}));

jest.mock('../src/services/rag/providers/gemini', () => ({
  name: 'gemini:test',
  embedQuery: jest.fn().mockResolvedValue([0.1, 0.2]),
  embedDocuments: jest.fn(),
}));

// Retrieval reads the DB; here it only needs to record the question and
// pass it to the (recorded) embedding provider like the real one does.
jest.mock('../src/services/rag/retrievalService', () => {
  const { embedQuery } = require('../src/services/rag/embeddingService');
  return {
    retrieve: jest.fn(async (question) => {
      await embedQuery(question);
      return {
        question,
        topScore: 0.2,
        threshold: 0.59,
        matches: [],
        relevant: [],
        hasRelevantContext: false,
        searched: 0,
      };
    }),
  };
});

const { generate, generateWithAgent } = require('../src/services/rag/generationService');
const duckduckgo = require('../src/services/rag/providers/duckduckgoSearch');
const gemini = require('../src/services/rag/providers/gemini');
const { analyzeTicket } = require('../src/services/aiAnalysisService');
const { ask } = require('../src/services/rag/ragService');
const { detectEmotion } = require('../src/services/emotionDetectionService');

const PRIVATE_VALUES = [
  'jo.smith@example.co.nz',
  '021 123 4567',
  'Winter#2026',
  '4111 1111 1111 1111',
  'sk-abcdefghijklmnopqrstuvwx1234',
];

const TICKET =
  'VPN will not connect. Contact me on jo.smith@example.co.nz or 021 123 4567. ' +
  'My password is Winter#2026 and the key sk-abcdefghijklmnopqrstuvwx1234 ' +
  'is in the config. Card 4111 1111 1111 1111 was billed.';

function expectNoPrivateValues(sent) {
  const text = JSON.stringify(sent);
  for (const value of PRIVATE_VALUES) {
    expect(text).not.toContain(value);
  }
}

let fetchSpy;

beforeEach(() => {
  jest.clearAllMocks();
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ message: { content: '{"emotion":"neutral","reason":"x"}' } }),
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('nothing private is sent to external AI or search', () => {
  it('ticket classification sends a redacted description to the model', async () => {
    await analyzeTicket(TICKET);

    const sent = generate.mock.calls[0][0];
    expectNoPrivateValues(sent);
    const user = sent.find((m) => m.role === 'user').content;
    expect(user).toContain('[EMAIL]');
    expect(user).toContain('[PHONE]');
    expect(user).toContain('[PASSWORD]');
    expect(user).toContain('[CARD]');
    // The useful part of the ticket still reaches the model.
    expect(user).toContain('VPN will not connect');
  });

  it('the assistant sends a redacted question to the model, embeddings and web search', async () => {
    await ask(TICKET, { agent: 'main' });

    expect(gemini.embedQuery).toHaveBeenCalled();
    expect(duckduckgo.search).toHaveBeenCalled();
    expect(generateWithAgent).toHaveBeenCalled();

    expectNoPrivateValues(gemini.embedQuery.mock.calls);
    expectNoPrivateValues(duckduckgo.search.mock.calls);
    expectNoPrivateValues(generateWithAgent.mock.calls);
  });

  it('earlier questions used as follow-up context are redacted too', async () => {
    await ask('what about that?', {
      agent: 'main',
      history: ['My email jo.smith@example.co.nz is locked, password: Winter#2026'],
    });

    expectNoPrivateValues(gemini.embedQuery.mock.calls);
    expectNoPrivateValues(duckduckgo.search.mock.calls);
    expectNoPrivateValues(generateWithAgent.mock.calls);
  });

  it('emotion detection sends a redacted message to the model', async () => {
    await detectEmotion(TICKET);

    expect(fetchSpy).toHaveBeenCalled();
    expectNoPrivateValues(fetchSpy.mock.calls[0][1].body);
  });

  it('web search redacts even when called directly', async () => {
    const webSearchService = require('../src/services/rag/webSearchService');

    await webSearchService.search('outlook error for jo.smith@example.co.nz');

    expect(duckduckgo.search.mock.calls[0][0]).toBe('outlook error for [EMAIL]');
  });

  it('small talk sent to the fast agent is redacted', async () => {
    await ask('hi, I am on 021 123 4567', { agent: 'fast' });

    expectNoPrivateValues(generateWithAgent.mock.calls);
  });
});
