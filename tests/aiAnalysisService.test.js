const { parseAnalysis } = require('../src/services/aiAnalysisService');

// parseAnalysis turns Gemini's free-text response into structured
// category/priority/suggestedResponse -- pure regex + validation, no
// network call, but it had zero direct coverage: aiService.test.js mocks
// this whole module out, so this logic was only ever exercised as an
// implicit black box.
describe('parseAnalysis', () => {
  it('extracts category, priority, and suggested response from a well-formed reply', () => {
    const text = 'Category: Network\nPriority: High\nSuggested Response: Check the VPN gateway logs.';

    expect(parseAnalysis(text)).toEqual({
      category: 'Network',
      priority: 'High',
      suggestedResponse: 'Check the VPN gateway logs.',
    });
  });

  it('matches field labels case-insensitively', () => {
    const text = 'CATEGORY: Hardware\nPRIORITY: Low\nSUGGESTED RESPONSE: Replace the cable.';

    expect(parseAnalysis(text)).toEqual({
      category: 'Hardware',
      priority: 'Low',
      suggestedResponse: 'Replace the cable.',
    });
  });

  it('falls back category to Other when the AI names something outside CATEGORIES', () => {
    const text = 'Category: Blorptech\nPriority: High\nSuggested Response: Investigate.';

    expect(parseAnalysis(text).category).toBe('Other');
  });

  it('falls back priority to Medium when the AI names something outside PRIORITIES', () => {
    const text = 'Category: Network\nPriority: Super Urgent\nSuggested Response: Investigate.';

    expect(parseAnalysis(text).priority).toBe('Medium');
  });

  it('falls back category to Other when the Category line is missing entirely', () => {
    const text = 'Priority: Low\nSuggested Response: Investigate.';

    expect(parseAnalysis(text).category).toBe('Other');
  });

  it('falls back priority to Medium when the Priority line is missing entirely', () => {
    const text = 'Category: Hardware\nSuggested Response: Investigate.';

    expect(parseAnalysis(text).priority).toBe('Medium');
  });

  it('captures a multi-line suggested response', () => {
    const text = 'Category: Software\nPriority: Medium\nSuggested Response: Line one.\nLine two.';

    expect(parseAnalysis(text).suggestedResponse).toBe('Line one.\nLine two.');
  });

  it('falls back suggestedResponse to the full trimmed text when the label is missing', () => {
    const text = '  Category: Hardware\nPriority: Low  ';

    expect(parseAnalysis(text).suggestedResponse).toBe('Category: Hardware\nPriority: Low');
  });
});
