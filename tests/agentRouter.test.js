const { pickAgent, getAgent, getFallback } = require('../src/services/rag/agentRouter');

describe('agentRouter.pickAgent', () => {
  it.each([
    ['hi'],
    ['Hello!'],
    ['thanks'],
    ['ok thanks'],
    ['thank you so much'],
    ['good morning'],
  ])('sends small talk "%s" to the fast agent', (message) => {
    expect(pickAgent(message)).toBe('fast');
  });

  it.each([
    ['printer offline'],
    ['wifi down'],
    ['hello my printer is broken'],
    ['hi can you reset my password'],
    ['yes'],
    ['no'],
  ])('does NOT treat "%s" as small talk', (message) => {
    expect(pickAgent(message)).toBe('main');
  });

  it.each([
    ['why does my wifi keep dropping'],
    ['its not working what else can i do'],
    ['I already tried restarting the printer'],
    ['can you explain how to set up the vpn'],
    ['my laptop keeps disconnecting from wifi'],
    ['please troubleshoot my email'],
  ])('sends "%s" to the think agent', (message) => {
    expect(pickAgent(message)).toBe('think');
  });

  it('sends a very long message to the think agent', () => {
    expect(pickAgent('my laptop problem '.repeat(20))).toBe('think');
  });

  it('defaults an ordinary IT question to the main agent', () => {
    expect(pickAgent('how do I reset my password')).toBe('main');
  });

  it('honours forceThink only when it is exactly true', () => {
    expect(pickAgent('hi', { forceThink: true })).toBe('think');
    expect(pickAgent('hi', { forceThink: 'true' })).toBe('fast');
    expect(pickAgent('hi', { forceThink: 1 })).toBe('fast');
  });

  it('survives a non-string message', () => {
    expect(pickAgent(undefined)).toBe('main');
    expect(pickAgent(null)).toBe('main');
  });
});

describe('agentRouter.getAgent / getFallback', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('reads provider and model from .env and keeps the RAG rules', () => {
    process.env.AGENT_FAST_PROVIDER = 'groq';
    process.env.AGENT_FAST_MODEL = 'openai/gpt-oss-20b';

    expect(getAgent('fast')).toMatchObject({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      useRag: false,
      reasoningEffort: 'low',
    });
    expect(getAgent('main').useRag).toBe(true);
    expect(getAgent('think')).toMatchObject({ useRag: true, think: true });
  });

  it('falls back to ollama and GENERATION_MODEL when nothing is set', () => {
    delete process.env.AGENT_MAIN_PROVIDER;
    delete process.env.AGENT_MAIN_MODEL;
    process.env.GENERATION_MODEL = 'llama3.2:1b';

    expect(getAgent('main')).toMatchObject({ provider: 'ollama', model: 'llama3.2:1b' });
  });

  it('gives the think agent a large token budget for its reasoning', () => {
    expect(getAgent('think').maxTokens).toBe(1500);
    expect(getAgent('fast').maxTokens).toBeLessThan(getAgent('think').maxTokens);
    expect(getAgent('main').maxTokens).toBeNull();
  });

  it('rejects an unknown agent name', () => {
    expect(() => getAgent('boss')).toThrow(/Unknown agent/);
  });

  it('reads the fallback from .env', () => {
    process.env.AGENT_FALLBACK_PROVIDER = 'ollama';
    process.env.AGENT_FALLBACK_MODEL = 'llama3.2:1b';

    expect(getFallback()).toEqual({ provider: 'ollama', model: 'llama3.2:1b' });
  });
});