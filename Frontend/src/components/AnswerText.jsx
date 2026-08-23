/*
 * Renders an assistant answer.
 *
 * The knowledge-base articles are written in light markdown, so **bold**
 * markers survive into generated answers. Rendering them raw shows literal
 * asterisks. Rather than pulling in a markdown library for two features,
 * this handles the only two the assistant actually produces: bold spans
 * and numbered or bulleted lists.
 */

function renderBold(text, keyPrefix) {
  // Split on **...** while keeping the delimited parts.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

export default function AnswerText({ text }) {
  if (!text) {
    return null;
  }

  const lines = text.split('\n');
  const blocks = [];

  let listItems = [];
  let ordered = false;

  function flushList() {
    if (!listItems.length) {
      return;
    }

    const Tag = ordered ? 'ol' : 'ul';

    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        style={{ margin: '10px 0 10px 20px', lineHeight: 1.7 }}
      >
        {listItems.map((item, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {renderBold(item, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </Tag>
    );

    listItems = [];
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();

    if (!line) {
      flushList();
      return;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    const bulleted = line.match(/^[-*]\s+(.*)$/);

    if (numbered) {
      if (!ordered) {
        flushList();
      }

      ordered = true;
      listItems.push(numbered[2]);
      return;
    }

    if (bulleted) {
      if (ordered) {
        flushList();
      }

      ordered = false;
      listItems.push(bulleted[1]);
      return;
    }

    flushList();

    blocks.push(
      <p
        key={`p-${index}`}
        style={{ margin: '0 0 12px', lineHeight: 1.7, color: '#27313a' }}
      >
        {renderBold(line, `p-${index}`)}
      </p>
    );
  });

  flushList();

  return <div>{blocks}</div>;
}