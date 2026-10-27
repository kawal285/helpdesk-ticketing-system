/*
 * DuckDuckGo HTML search provider.
 *
 * No API key needed: it fetches DuckDuckGo's plain-HTML results page (the
 * one served to browsers with JavaScript disabled) and parses the result
 * list out of the markup. That makes it the only provider in this folder
 * that can fail for reasons outside our control -- DuckDuckGo changes its
 * markup, rate-limits a user agent, or is simply unreachable -- so it
 * throws on any problem and lets webSearchService.js's timeout/catch
 * wrapper turn that into "no web results" rather than a broken answer.
 *
 * To swap in a paid API (Bing, Brave, SerpAPI) instead, write a module with
 * the same { name, search(query, { maxResults }) -> WebResult[] } shape and
 * register it in webSearchService.js -- nothing else changes.
 */

const ENDPOINT = 'https://html.duckduckgo.com/html/';

const USER_AGENT =
  'Mozilla/5.0 (compatible; HelpdeskAssistant/1.0; ' +
  '+https://github.com/kawal285/helpdesk-ticketing-system)';

// Captures a result's link + title, then its snippet, in one pass over the
// markup -- the two sit next to each other for every result on this page.
const RESULT_PATTERN =
  /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(html) {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

/*
 * DuckDuckGo's HTML result links point at its own redirect
 * (//duckduckgo.com/l/?uddg=<encoded-real-url>&rut=...), not the target
 * site directly. Unwrap it so a cited or saved link goes where the reader
 * expects instead of back through DuckDuckGo.
 */
function resolveUrl(href) {
  const match = href.match(/uddg=([^&]+)/);

  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      return href;
    }
  }

  return href.startsWith('//') ? `https:${href}` : href;
}

function parseResults(html, maxResults) {
  const results = [];
  let match;

  RESULT_PATTERN.lastIndex = 0;

  while (
    (match = RESULT_PATTERN.exec(html)) &&
    results.length < maxResults
  ) {
    const [, href, titleHtml, snippetHtml] = match;

    const title = cleanText(titleHtml);
    const url = resolveUrl(href);
    const snippet = cleanText(snippetHtml);

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

async function search(query, { maxResults = 3 } = {}) {
  const response = await fetch(
    `${ENDPOINT}?q=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': USER_AGENT } }
  );

  if (!response.ok) {
    throw new Error(`DuckDuckGo search returned ${response.status}`);
  }

  const html = await response.text();

  return parseResults(html, maxResults);
}

module.exports = { name: 'duckduckgo', search, parseResults };
