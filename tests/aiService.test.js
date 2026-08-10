jest.mock('../src/services/aiAnalysisService');

const { analyzeTicket } = require('../src/services/aiAnalysisService');
const { getAiSuggestions } = require('../src/services/aiService');

describe('getAiSuggestions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the parsed suggestion on success', async () => {
    analyzeTicket.mockResolvedValue({
      category: 'Network',
      priority: 'High',
      suggestedResponse: 'Check the VPN gateway logs.',
    });

    const result = await getAiSuggestions('VPN keeps dropping');

    expect(result).toEqual({
      category: 'Network',
      priority: 'High',
      suggestedResponse: 'Check the VPN gateway logs.',
    });
  });

  it('never throws, and falls back to nulls, when the underlying call rejects', async () => {
    analyzeTicket.mockRejectedValue(new Error('GEMINI_API_KEY is not set'));

    const result = await getAiSuggestions('Anything');

    expect(result).toEqual({ category: null, priority: null, suggestedResponse: null });
  });

  it('never throws on a quota error either', async () => {
    const quotaError = Object.assign(new Error('quota exceeded'), { status: 429 });
    analyzeTicket.mockRejectedValue(quotaError);

    await expect(getAiSuggestions('Anything')).resolves.toEqual({
      category: null,
      priority: null,
      suggestedResponse: null,
    });
  });
});
