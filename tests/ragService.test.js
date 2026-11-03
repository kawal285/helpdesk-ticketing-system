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
const {
  ask,
  buildSearchContext,
  stripCitationMarkers,
} = require('../src/services/rag/ragService');

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

describe('ragService follow-up handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getModelInfo.mockReturnValue({ name: 'ollama:llama3.2' });
  });

  it('adds the previous question to a short follow-up before searching', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [], provider: 'duckduckgo' });
    generate.mockResolvedValue('answer');

    await ask('its not working what else can i do', {
      history: ['my printer is offline'],
    });

    expect(retrieve.mock.calls[0][0]).toContain('my printer is offline');
    expect(webSearchService.search.mock.calls[0][0]).toContain('my printer is offline');

    const userMessage = generate.mock.calls[0][0].find((m) => m.role === 'user').content;
    expect(userMessage).toContain('EARLIER QUESTION');
  });

  it('leaves a new, self-contained question alone even when there is history', () => {
    const result = buildSearchContext('how do i reset my password', ['my printer is offline']);

    expect(result.searchText).toBe('how do i reset my password');
    expect(result.previousQuestion).toBeNull();
  });

  it('ignores history on a long question', () => {
    const long = 'my laptop will not connect to the wifi in the library and it keeps asking for a password';
    const result = buildSearchContext(long, ['my printer is offline']);

    expect(result.searchText).toBe(long);
  });

  it('treats a missing or malformed history as no history', () => {
    expect(buildSearchContext('what else can i do', undefined).previousQuestion).toBeNull();
    expect(buildSearchContext('what else can i do', 'nope').previousQuestion).toBeNull();
  });

  it('removes source numbers the model echoed into its answer', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [WEB_RESULT], provider: 'duckduckgo' });
    generate.mockResolvedValue('Try this, as in [1]. Also see wikiHow ([5]) for more.');

    const result = await ask('my printer is stuck');

    expect(result.answer).not.toMatch(/\[\d+\]/);
    expect(result.answer).toContain('Try this');
  });

  it('leaves non-string model output untouched', () => {
    expect(stripCitationMarkers(undefined)).toBeUndefined();
  });
});

describe('ragService safety guardrails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getModelInfo.mockReturnValue({ name: 'ollama:llama3.2' });
  });

  it('returns a fixed safety response for a described hazard without touching retrieval, web search or the model', async () => {
    const result = await ask('my computer is smoking and I can smell it burning');

    expect(result.grounded).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.answer).toMatch(/unplug/i);
    expect(result.sources).toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
    expect(webSearchService.search).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('does not flag an ordinary question as a hazard', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [], provider: 'duckduckgo' });
    generate.mockResolvedValue('Clear the print queue.');

    const result = await ask('my printer is not printing');

    expect(result.escalated).toBe(false);
  });

  it('overrides the answer, and empties sources, when the model gives dangerous disassembly advice', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [], provider: 'duckduckgo' });
    generate.mockResolvedValue('First, open the power supply and discharge the capacitor.');

    const result = await ask('my pc wont turn on');

    expect(result.grounded).toBe(true);
    expect(result.escalated).toBe(true);
    expect(result.answer).not.toMatch(/open the power supply/i);
    expect(result.answer).toMatch(/qualified technician/i);
    expect(result.sources).toEqual([]);
  });

  it('redacts a credential-shaped string the model includes in an otherwise normal answer', async () => {
    retrieve.mockResolvedValue(grounded([KB_MATCH]));
    webSearchService.search.mockResolvedValue({ results: [], provider: 'duckduckgo' });
    generate.mockResolvedValue('Use the key AIzaSyD4GhK9mXyZ1234567890abcdefGHIJKL to sign in.');

    const result = await ask('how do I sign in');

    expect(result.escalated).toBe(false);
    expect(result.answer).not.toContain('AIzaSyD4GhK9mXyZ1234567890abcdefGHIJKL');
    expect(result.answer).toContain('[redacted]');
  });
});