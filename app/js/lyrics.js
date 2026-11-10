// Tách đoạn / dòng và ghép JP · RM · VI
import { esc } from './util.js';

export const LANGS = [
  { key: 'jp', label: 'JP', name: 'Tiếng Nhật' },
  { key: 'rm', label: 'RM', name: 'Romaji' },
  { key: 'en', label: 'EN', name: 'Tiếng Anh' },
  { key: 'vi', label: 'VI', name: 'Tiếng Việt' },
];

/** Văn bản → mảng đoạn, mỗi đoạn là mảng dòng. Dòng trống (kể cả chỉ có khoảng trắng toàn góc) = ngắt đoạn. */
export function splitStanzas(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const stanzas = [];
  let cur = [];
  for (const raw of lines) {
    const line = raw.replace(/^[\s　]+|[\s　]+$/g, '');
    if (!line) {
      if (cur.length) stanzas.push(cur);
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) stanzas.push(cur);
  return stanzas;
}

/** Ghép các ngôn ngữ theo đoạn. Trả về { langs, stanzas:[{jp,rm,vi,mismatch}], mismatches } */
export const ALL_KEYS = ['jp', 'rm', 'en', 'vi'];
const langAttr = (k) => (k === 'vi' ? 'vi' : k === 'en' ? 'en' : k === 'jp' ? 'ja' : 'ja-Latn');

export function align(lyrics, keys = ALL_KEYS) {
  const split = {};
  const langs = [];
  for (const k of keys) {
    split[k] = splitStanzas(lyrics?.[k]);
    if (split[k].length) langs.push(k);
  }
  const n = Math.max(0, ...langs.map((k) => split[k].length));
  const stanzas = [];
  let mismatches = 0;
  for (let i = 0; i < n; i++) {
    const s = { mismatch: false };
    const counts = [];
    for (const k of langs) {
      s[k] = split[k][i] || [];
      counts.push(s[k].length);
    }
    s.mismatch = langs.length > 1 && new Set(counts).size > 1;
    if (s.mismatch) mismatches++;
    stanzas.push(s);
  }
  return { langs, stanzas, mismatches, split };
}

export function hasLyrics(lyrics) {
  return LANGS.some((l) => String(lyrics?.[l.key] || '').trim());
}

const langName = (k) => LANGS.find((l) => l.key === k)?.label || k;

/** Xen kẽ theo đoạn: JP → RM → EN → VI. keys = các ngôn ngữ đang hiện. */
export function renderInterleave(lyrics, keys = ALL_KEYS) {
  const { langs, stanzas } = align(lyrics, keys);
  if (!langs.length) return '';
  return stanzas
    .map(
      (s) =>
        `<div class="stanza">${langs
          .filter((k) => s[k].length)
          .map((k) => `<div class="ly-block ly-${k}" lang="${langAttr(k)}">${s[k].map(esc).join('<br>')}</div>`)
          .join('')}</div>`,
    )
    .join('');
}

/** Song song: mỗi dòng 1 hàng, mỗi ngôn ngữ 1 cột (màn hình hẹp tự xếp chồng theo dòng). */
export function renderParallel(lyrics, keys = ALL_KEYS) {
  const { langs, stanzas } = align(lyrics, keys);
  if (!langs.length) return '';
  const head = `<div class="prow phead" style="--cols:${langs.length}">${langs.map((k) => `<div class="pcell">${langName(k)}</div>`).join('')}</div>`;
  const body = stanzas
    .map((s) => {
      const rows = Math.max(...langs.map((k) => s[k].length));
      let html = '';
      for (let i = 0; i < rows; i++) {
        html += `<div class="prow" style="--cols:${langs.length}">${langs
          .map((k) => `<div class="pcell ly-${k}" lang="${langAttr(k)}">${esc(s[k][i] || '')}</div>`)
          .join('')}</div>`;
      }
      return `<div class="pstanza">${html}</div>`;
    })
    .join('');
  return `<div class="parallel">${head}${body}</div>`;
}

/** Từng bản đầy đủ */
export function renderSingle(lyrics, key) {
  const st = splitStanzas(lyrics?.[key]);
  if (!st.length) return '<p class="muted">Chưa có lời cho ngôn ngữ này.</p>';
  return `<div class="single ly-${key}" lang="${langAttr(key)}">${st.map((s) => `<p>${s.map(esc).join('<br>')}</p>`).join('')}</div>`;
}
