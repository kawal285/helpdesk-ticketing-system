const fs = require('fs');
const path = require('path');

const KNOWLEDGE_BASE_FILE = path.join(
  __dirname,
  '..',
  'data',
  'knowledgeBase.json'
);

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'your',
  'you',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'not',
  'but',
  'what',
  'when',
  'where',
  'which',
  'how',
  'can',
  'could',
  'should',
  'would',
  'into',
  'our',
  'their',
  'there',
  'issue',
  'problem',
  'help',
]);

function loadArticles() {
  const fileContent = fs.readFileSync(
    KNOWLEDGE_BASE_FILE,
    'utf8'
  );
  const articles = JSON.parse(fileContent);

  if (!Array.isArray(articles)) {
    throw new Error('Knowledge-base data must be an array.');
  }

  return articles;
}

function normaliseWords(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 && !STOP_WORDS.has(word)
    );
}

function searchArticles(query) {
  if (typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const queryWords = normaliseWords(query);

  return loadArticles()
    .map((article) => {
      const searchableText = [
        article.title,
        article.content,
        ...(article.tags || []),
      ].join(' ');

      const articleWords = normaliseWords(searchableText);

      const score = queryWords.reduce(
        (total, queryWord) => {
          const matches = articleWords.filter(
            (articleWord) =>
              articleWord === queryWord ||
              articleWord.includes(queryWord) ||
              queryWord.includes(articleWord)
          ).length;

          return total + matches;
        },
        0
      );

      return {
        ...article,
        score,
      };
    })
    .filter((article) => article.score > 2)
    .sort(
      (first, second) => second.score - first.score
    );
}

function getArticleById(id) {
  return loadArticles().find(
    (article) => Number(article.id) === Number(id)
  );
}

module.exports = {
  loadArticles,
  searchArticles,
  getArticleById,
};