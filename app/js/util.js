// Tiện ích dùng chung

export const TAG_FIELDS = [
  { key: 'circle', label: 'Circle', icon: '◎' },
  { key: 'album', label: 'Album', icon: '◫' },
  { key: 'event', label: 'Event', icon: '✦', single: true },
  { key: 'arrangement', label: 'Arrangement', icon: '♪' },
  { key: 'lyricist', label: 'Lyrics', icon: '✎' },
  { key: 'vocals', label: 'Vocals', icon: '♫' },
  { key: 'originalTitle', label: 'Original Title', icon: '❖' },
  { key: 'source', label: 'Source', icon: '☯' },
];
export const FIELD_BY_KEY = Object.fromEntries(TAG_FIELDS.map((f) => [f.key, f]));

export const COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Tạo phần tử từ chuỗi HTML (1 phần tử gốc). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function hashColor(value) {
  let h = 0;
  for (const ch of String(value)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** YYYY-MM-DD hoặc ISO → DD/MM/YYYY */
export function fmtDate(iso) {
  if (!iso) return '';
  const d = String(iso).slice(0, 10).split('-');
  if (d.length !== 3) return String(iso);
  return `${d[2]}/${d[1]}/${d[0]}`;
}

export function todayISO() {
  return new Date().toISOString();
}

export function removeDiacritics(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function norm(s) {
  return removeDiacritics(s).toLowerCase();
}

export function slugify(s) {
  return norm(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function shortId(n = 4) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const buf = crypto.getRandomValues(new Uint8Array(n));
  for (const b of buf) s += a[b % a.length];
  return s;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Lấy ID video YouTube từ link hoặc ID trần. */
export function youtubeId(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12);
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
      const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* không phải URL */
  }
  return '';
}

export function displayTitle(p) {
  const main = p.titleJP || p.titleRM || p.titleVI || '(Chưa có tiêu đề)';
  const rm = p.titleJP && p.titleRM ? p.titleRM : '';
  return { main, rm, vi: p.titleJP || p.titleRM ? p.titleVI : '' };
}

export function plainTitle(p) {
  const t = displayTitle(p);
  return t.rm ? `${t.main} | ${t.rm}` : t.main;
}

export function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* bỏ qua */
  }
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Tạo ảnh bìa giả (SVG) khi bài chưa có ảnh. */
export function placeholderCover(p, color) {
  const t = displayTitle(p).main;
  const ch = [...t][0] || '♪';
  return `<div class="cover-ph c-${esc(color || 'default')}" aria-hidden="true"><span>${esc(ch)}</span></div>`;
}
