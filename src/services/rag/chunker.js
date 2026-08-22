/*
 * Splits knowledge-base articles into retrieval units ("chunks").
 *
 * Articles are authored with "## " section headings, so we split on those
 * real semantic boundaries rather than on a fixed character count. A
 * section that is still too long after that is split again on paragraph
 * boundaries, with an overlap so an instruction spanning the split still
 * appears whole in at least one chunk.
 *
 * Every chunk carries its article title and section heading in the text
 * that gets embedded, because a chunk body alone ("Wait five minutes,
 * then check your junk folder") has no retrievable context.
 */

const MAX_WORDS = 180;
const OVERLAP_PARAGRAPHS = 1;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/*
 * Turns one article's content into [{ heading, body }].
 * Text before the first "## " heading becomes an "Overview" section.
 */
function splitIntoSections(content) {
  const lines = content.split('\n');
  const sections = [];

  let heading = 'Overview';
  let buffer = [];

  function flush() {
    const body = buffer.join('\n').trim();
    if (body) {
      sections.push({ heading, body });
    }
    buffer = [];
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      heading = line.slice(3).trim();
    } else {
      buffer.push(line);
    }
  }

  flush();

  return sections;
}

/*
 * A section longer than MAX_WORDS is split on blank lines, keeping
 * OVERLAP_PARAGRAPHS from the end of the previous piece at the start of
 * the next one. Paragraphs are never broken mid-way, so a numbered list
 * stays intact.
 */
function splitLongSection(body) {
  if (countWords(body) <= MAX_WORDS) {
    return [body];
  }

  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim());
  const pieces = [];

  let current = [];

  for (const paragraph of paragraphs) {
    const projected = [...current, paragraph].join('\n\n');

    if (current.length && countWords(projected) > MAX_WORDS) {
      pieces.push(current.join('\n\n'));
      current = current.slice(-OVERLAP_PARAGRAPHS);
    }

    current.push(paragraph);
  }

  if (current.length) {
    pieces.push(current.join('\n\n'));
  }

  return pieces;
}

/*
 * The string actually sent to the embedding model. The heading prefix is
 * what gives an otherwise context-free chunk something to match on.
 */
function buildEmbeddableText(articleTitle, heading, body) {
  const prefix =
    heading === 'Overview'
      ? articleTitle
      : `${articleTitle} — ${heading}`;

  return `${prefix}\n\n${body}`;
}

function chunkArticle(article) {
  if (!article || typeof article.content !== 'string') {
    throw new Error(
      `Article ${article && article.id} has no content string.`
    );
  }

  const chunks = [];

  for (const section of splitIntoSections(article.content)) {
    for (const body of splitLongSection(section.body)) {
      chunks.push({
        articleId: article.id,
        articleTitle: article.title,
        category: article.category || 'Other',
        audience: article.audience || 'All',
        heading: section.heading,
        chunkIndex: chunks.length,
        text: buildEmbeddableText(article.title, section.heading, body),
        wordCount: countWords(body),
      });
    }
  }

  return chunks;
}

function chunkArticles(articles) {
  return articles.flatMap(chunkArticle);
}

module.exports = {
  chunkArticle,
  chunkArticles,
  splitIntoSections,
  MAX_WORDS,
};