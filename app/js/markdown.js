// Markdown tối giản và an toàn: escape HTML trước, rồi mới định dạng.
import { esc } from './util.js';

const SAFE_URL = /^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i;

function inline(text) {
  const slots = [];
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = esc(text);
  // `code`
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${c}</code>`));
  // [chữ](link)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const raw = url.replace(/&amp;/g, '&');
    if (!SAFE_URL.test(raw)) return m;
    return keep(`<a href="${esc(raw)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  });
  // link trần
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, (_, pre, url) => {
    const raw = url.replace(/&amp;/g, '&');
    return pre + keep(`<a href="${esc(raw)}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  });
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
}

export function markdown(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [] }
  let quote = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    let m;
    if (!line.trim()) {
      flushAll();
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushAll();
      const lvl = m[1].length + 2; // # → h3
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushAll();
      out.push('<hr>');
    } else if ((m = line.match(/^\s*>\s?(.*)$/))) {
      flushPara();
      flushList();
      quote.push(m[1]);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara();
      flushQuote();
      if (list?.type !== 'ul') flushList();
      list ||= { type: 'ul', items: [] };
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      flushQuote();
      if (list?.type !== 'ol') flushList();
      list ||= { type: 'ol', items: [] };
      list.items.push(m[1]);
    } else {
      flushList();
      flushQuote();
      para.push(line);
    }
  }
  flushAll();
  return out.join('\n');
}
