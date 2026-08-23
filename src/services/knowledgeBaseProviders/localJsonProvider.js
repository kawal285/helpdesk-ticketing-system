// The current knowledge-base backend: articles live in a local JSON file,
// searched with simple keyword scoring. This is one implementation of the
// provider contract described in ./index.js -- swapping in a real CRM or
// hosted knowledge base later means writing a new file with this same
// shape, not touching the route/controller/AI-assistant layer at all.

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', '..', 'data', 'knowledgeBase.json');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are',
  'was', 'were', 'has', 'have', 'had', 'not', 'but', 'what', 'when', 'where',
  'which', 'how', 'can', 'could', 'should', 'would', 'into', 'our', 'their',
  'there', 'issue', 'problem', 'help',
]);

function normaliseWords(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

// filePath is injectable so tests can point at a fixture instead of the
// real knowledge base.
function createLocalJsonProvider(filePath = DEFAULT_FILE) {
  function listAll() {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const articles = JSON.parse(fileContent);

    if (!Array.isArray(articles)) {
      throw new Error('Knowledge-base data must be an array.');
    }

    return articles;
  }

  function search(query) {
    if (typeof query !== 'string' || !query.trim()) {
      return [];
    }

    const queryWords = normaliseWords(query);

    return listAll()
      .map((article) => {
        const searchableText = [article.title, article.content, ...(article.tags || [])].join(' ');
        const articleWords = normaliseWords(searchableText);

        const score = queryWords.reduce((total, queryWord) => {
          const matches = articleWords.filter(
            (articleWord) =>
              articleWord === queryWord || articleWord.includes(queryWord) || queryWord.includes(articleWord)
          ).length;

          return total + matches;
        }, 0);

        return { ...article, score };
      })
      .filter((article) => article.score > 2)
      .sort((first, second) => second.score - first.score);
  }

  function getById(id) {
    return listAll().find((article) => Number(article.id) === Number(id));
  }

  return { listAll, search, getById };
}

module.exports = { createLocalJsonProvider };
