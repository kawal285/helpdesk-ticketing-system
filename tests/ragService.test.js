/*
 * Tests ragService.ask()'s orchestration -- when it refuses, when it calls
 * the model, and how it combines knowledge-base and web sources -- with
 * retrieval, generation and web search all mocked. The pipeline's own
 * pieces (chunker, similarity, the DuckDuckGo parser) are tested on their
 * own; the real thing end to end is covered by scripts/rag/evaluate-answers.js,
 * not Jest.
 */

jest.mock('../src/services/rag/retrievalService');
jest.mock('../src/services/rag/generationService');
jest.mock('../src/services/rag/webSearchService');

const { retrieve } = require('../src/services/rag/retrievalService');
const { generate, getModelInfo } = require('../src/services/rag/generationService');
const webSearchService = require('../src/services/rag/webSearchService');
const { ask } = require('../src/services/rag/ragService');

const KB_MATCH = {
  id: 1,
  articleId: 8,
  articleTitle: 'Printer is not printing',
  category: 'Hardware',
  heading: 'Clear a stalled queue',
  text: 'Clear the print queue and send a test page.',
  score: 0.81,
};

const WEB_RESULT = {
  title: 'Fix a stuck print queue on Windows 11',
  url: 'https://support.example.com/windows/print-queue',
  snippet: 'Open Services, restart the Print Spooler, then resend the job.',
};

function emptyRetrieval(topScore = 0.4) {
  return {
    question: 'q',
    topScore,
    threshold: 0.59,
    matches: [],
    relevant: [],
    hasRelevantContext: false,
    searched: 10,
  };
}

function grounded(matches) {
  return {
    question: 'q',
    topScore: matches[0].score,
    threshold: 0.59,
    matches,
    relevant: matches,
    hasRelevantContext: true,
    searched: 10,
  };
}

describe('ragService.ask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getModelInfo.mockReturnValue({ name: 'ollama:llama3.2' });
  });

  it('refuses without calling the model when neither the KB nor the web has anything relevant', async () => {
    retrieve.mockResolvedValue(emptyRetrieval());
    webSearchService.search.mockResolvedValue({ results: [], provider: 'duckduckgo' });

    const result = await ask('who won the football last night');

    expect(result.grounded).toBe(false);
    expect(result.sources).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it('answers from the knowledge base alone when the web has nothing', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [], provider: 'duckduckgo' });
    generate.mockResolvedValue('Clear the queue and try again.');

    const result = await ask('my printer is stuck');

    expect(result.grounded).toBe(true);
    expect(result.sources).toEqual([
      {
        type: 'knowledge_base',
        articleId: 8,
        title: 'Printer is not printing',
        section: 'Clear a stalled queue',
        category: 'Hardware',
        score: 0.81,
      },
    ]);
  });

  it('answers from the web alone when nothing in the KB clears the threshold', async () => {
    retrieve.mockResolvedValue(emptyRetrieval(0.3));
    webSearchService.search.mockResolvedValue({ results: [WEB_RESULT], provider: 'duckduckgo' });
    generate.mockResolvedValue('Restart the Print Spooler service.');

    const result = await ask('print queue stuck on windows 11');

    expect(result.grounded).toBe(true);
    expect(generate).toHaveBeenCalled();
    expect(result.sources).toEqual([
      {
        type: 'web',
        title: 'Fix a stuck print queue on Windows 11',
        url: 'https://support.example.com/windows/print-queue',
        snippet: 'Open Services, restart the Print Spooler, then resend the job.',
      },
    ]);
  });

  it('combines knowledge-base and web sources, KB first, when both have something', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [WEB_RESULT], provider: 'duckduckgo' });
    generate.mockResolvedValue('Clear the queue, and if that fails, restart the spooler.');

    const result = await ask('my printer is stuck');

    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].type).toBe('knowledge_base');
    expect(result.sources[1].type).toBe('web');
    expect(result.webSearchProvider).toBe('duckduckgo');
  });

  it('passes both sets of matches into the prompt the model receives', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [WEB_RESULT], provider: 'duckduckgo' });
    generate.mockResolvedValue('answer');

    await ask('my printer is stuck');

    const messages = generate.mock.calls[0][0];
    const userMessage = messages.find((m) => m.role === 'user').content;

    expect(userMessage).toContain('Printer is not printing');
    expect(userMessage).toContain('(Web) Fix a stuck print queue on Windows 11');
  });

  it('skips web search entirely when options.webSearch is false', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    generate.mockResolvedValue('answer');

    const result = await ask('my printer is stuck', { webSearch: false });

    expect(webSearchService.search).not.toHaveBeenCalled();
    expect(result.webSearchProvider).toBe('none');
    expect(result.sources).toEqual([
      {
        type: 'knowledge_base',
        articleId: 8,
        title: 'Printer is not printing',
        section: 'Clear a stalled queue',
        category: 'Hardware',
        score: 0.81,
      },
    ]);
  });
});
