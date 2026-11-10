import type { ReactNode } from 'react';

/** 去掉结尾未闭合的 **，避免流式输出时露出半截星号。 */
export function prepareChatMarkdown(source: string): string {
  const text = source.replace(/\r\n/g, '\n');
  const marks = text.split('**').length - 1;
  if (marks % 2 === 0) return text;
  const at = text.lastIndexOf('**');
  return text.slice(0, at) + text.slice(at + 2);
}

export function SafeMarkdown({ text }: { text: string }) {
  const blocks = blocksOf(prepareChatMarkdown(text));
  return <div className="md-safe">{blocks}</div>;
}

function blocksOf(text: string): ReactNode[] {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{inline(paragraph.join('\n'))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.kind;
    blocks.push(
      <Tag key={`${list.kind}-${blocks.length}`}>
        {list.items.map((item, index) => <li key={index}>{inline(item)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const line of lines) {
    const bullet = /^- /.exec(line);
    const ordered = /^(\d+)\. /.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const kind = bullet ? 'ul' : 'ol';
      const item = line.slice(bullet ? 2 : ordered![0].length);
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [item] };
      } else {
        list.items.push(item);
      }
      continue;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushList();
  flushParagraph();
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const pieces = part.split('\n');
    return pieces.map((piece, pieceIndex) => (
      pieceIndex === 0 ? piece : [<br key={`br-${index}-${pieceIndex}`} />, piece]
    ));
  }).flat();
}
