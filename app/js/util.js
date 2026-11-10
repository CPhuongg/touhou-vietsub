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

/** Ảnh bìa giả khi bài chưa có ảnh: dùng màu chủ đạo của bài (cần nằm trong phần tử .pa). */
export function placeholderCover(p) {
  const t = displayTitle(p).main;
  const ch = [...t][0] || '♪';
  return `<div class="cover-ph" aria-hidden="true"><span>${esc(ch)}</span></div>`;
}

/* ============ Màu chủ đạo (accent) của từng bài ============ */
export const ACCENT_PRESETS = [
  '#e5484d', '#f76b15', '#f5a524', '#30a46c', '#12a594', '#0091ff',
  '#3e63dd', '#6e56cf', '#ab4aba', '#d6409f', '#e54666', '#8d7a5e',
];

export const isHex = (s) => /^#[0-9a-f]{6}$/i.test(String(s || ''));

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Màu chủ đạo của bài: màu đã chọn, hoặc màu tự động từ id/tiêu đề. */
export function postAccent(p) {
  if (isHex(p?.accent)) return p.accent.toLowerCase();
  let h = 0;
  for (const ch of String(p?.id || p?.titleJP || p?.titleRM || p?.titleVI || 'x')) h = (h * 33 + ch.codePointAt(0)) >>> 0;
  return ACCENT_PRESETS[h % ACCENT_PRESETS.length];
}

const WHITE = [255, 255, 255];
const DARK_BG = [24, 25, 33];
/** Sinh biến CSS cho 1 màu chủ đạo, đảm bảo chữ màu đó đủ tương phản trên nền sáng và tối. */
export function accentVars(hex) {
  const rgb = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(...rgb);
  let ll = Math.min(l, 0.5);
  let inkL = hslToRgb(h, Math.min(s, 0.85), ll);
  while (contrast(inkL, WHITE) < 4.8 && ll > 0.05) inkL = hslToRgb(h, Math.min(s, 0.85), (ll -= 0.02));
  let ld = Math.max(l, 0.6);
  let inkD = hslToRgb(h, Math.min(s, 0.8), ld);
  while (contrast(inkD, DARK_BG) < 5 && ld < 0.95) inkD = hslToRgb(h, Math.min(s, 0.8), (ld += 0.02));
  const on = contrast(rgb, WHITE) >= 3 ? '#ffffff' : '#16171d';
  return `--pa:${hex};--pa-rgb:${rgb.join(',')};--pa-ink-l:${rgbToHex(...inkL)};--pa-ink-d:${rgbToHex(...inkD)};--pa-on:${on}`;
}
export const accentStyle = (p) => accentVars(postAccent(p));

/**
 * Lấy bảng màu nổi bật từ ảnh (Blob/File hoặc URL). Trả về mảng hex, màu nên dùng đứng đầu.
 */
export async function extractPalette(src, max = 6) {
  let bmp;
  if (!(src instanceof Blob)) src = await (await fetch(src)).blob();
  if (src.type === 'image/svg+xml') {
    // SVG: createImageBitmap không đọc được trực tiếp → vẽ qua <img>
    const img = new Image();
    img.src = URL.createObjectURL(src);
    await img.decode();
    bmp = img;
  } else bmp = await createImageBitmap(src);
  const W = 64;
  const H = Math.max(1, Math.round((W * (bmp.height || W)) / (bmp.width || W)));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close?.();
  const data = ctx.getImageData(0, 0, W, H).data;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const cands = [...buckets.values()].map((e) => {
    const rgb = [e.r / e.n, e.g / e.n, e.b / e.n];
    const [, s, l] = rgbToHsl(...rgb);
    const lightOk = l > 0.18 && l < 0.82 ? 1 : 0.15;
    return { rgb, s, l, score: e.n * (0.15 + s * s * 1.6) * lightOk };
  });
  cands.sort((a, b) => b.score - a.score);
  // Bỏ trắng/đen gần như thuần, trừ khi ảnh không có màu nào khác
  const usable = cands.filter((c2) => c2.l > 0.08 && c2.l < 0.94);
  if (usable.length) cands.splice(0, cands.length, ...usable);
  const out = [];
  for (const c2 of cands) {
    if (out.some((o) => Math.hypot(o[0] - c2.rgb[0], o[1] - c2.rgb[1], o[2] - c2.rgb[2]) < 56)) continue;
    out.push(c2.rgb);
    if (out.length >= max) break;
  }
  return out.map((rgb) => rgbToHex(...rgb));
}
