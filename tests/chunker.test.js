const {
  chunkArticle,
  chunkArticles,
  splitIntoSections,
  MAX_WORDS,
} = require('../src/services/rag/chunker');

const articles = require('../src/data/knowledgeBase.json');

const sampleArticle = {
  id: 99,
  title: 'Test article',
  category: 'Network',
  audience: 'Students',
  content: [
    'Intro paragraph before any heading.',
    '',
    '## First section',
    '',
    'Body of the first section.',
    '',
    '## Second section',
    '',
    'Body of the second section.',
  ].join('\n'),
};

describe('splitIntoSections', () => {
  test('treats text before the first heading as an Overview section', () => {
    const sections = splitIntoSections(sampleArticle.content);

    expect(sections[0].heading).toBe('Overview');
    expect(sections[0].body).toBe('Intro paragraph before any heading.');
  });

  test('creates one section per heading', () => {
    const sections = splitIntoSections(sampleArticle.content);

    expect(sections.map((s) => s.heading)).toEqual([
      'Overview',
      'First section',
      'Second section',
    ]);
  });
});

describe('chunkArticle', () => {
  test('prefixes the article title and heading onto the embedded text', () => {
    const [, second] = chunkArticle(sampleArticle);

    expect(second.text).toContain('Test article — First section');
    expect(second.text).toContain('Body of the first section.');
  });

  test('carries metadata needed for citation onto every chunk', () => {
    for (const chunk of chunkArticle(sampleArticle)) {
      expect(chunk.articleId).toBe(99);
      expect(chunk.articleTitle).toBe('Test article');
      expect(chunk.category).toBe('Network');
      expect(chunk.heading).toBeTruthy();
    }
  });

  test('numbers chunks sequentially within the article', () => {
    const indexes = chunkArticle(sampleArticle).map((c) => c.chunkIndex);

    expect(indexes).toEqual([0, 1, 2]);
  });

  test('splits a section that exceeds the word budget', () => {
    const longParagraph = 'word '.repeat(150).trim();

    const chunks = chunkArticle({
      id: 1,
      title: 'Long',
      content: `## Big\n\n${longParagraph}\n\n${longParagraph}`,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  test('rejects an article with no content', () => {
    expect(() => chunkArticle({ id: 5 })).toThrow();
  });
});

describe('the real knowledge base', () => {
  const chunks = chunkArticles(articles);

  test('produces more chunks than articles', () => {
    expect(chunks.length).toBeGreaterThan(articles.length);
  });

  test('no chunk exceeds the word budget by more than one paragraph', () => {
    const oversized = chunks.filter((c) => c.wordCount > MAX_WORDS * 1.5);

    expect(oversized).toEqual([]);
  });

  test('every chunk has non-empty text and a known category', () => {
    const categories = ['Hardware', 'Software', 'Network', 'Account', 'Other'];

    for (const chunk of chunks) {
      expect(chunk.text.trim().length).toBeGreaterThan(0);
      expect(categories).toContain(chunk.category);
    }
  });

  test('every article contributes at least one chunk', () => {
    const covered = new Set(chunks.map((c) => c.articleId));

    expect(covered.size).toBe(articles.length);
  });
});