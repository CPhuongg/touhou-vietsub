// Nhập bài từ WordPress.com vào data/
//   node scripts/import-wordpress.mjs --dry        (chỉ xem trước, không ghi)
//   node scripts/import-wordpress.mjs              (ghi bài + tải ảnh bìa)
// Tuỳ chọn: --site shiroway.wordpress.com  --no-covers  --include-albums
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAG_FIELDS, hashColor, slugify, norm } from '../app/js/util.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const NO_COVERS = args.includes('--no-covers');
const INCLUDE_ALBUMS = args.includes('--include-albums');
const SITE = args.includes('--site') ? args[args.indexOf('--site') + 1] : 'shiroway.wordpress.com';

/* ---------------- HTML → chữ ---------------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const clean = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/[​ ]/g, (c) => (c === ' ' ? ' ' : '')).replace(/[ \t]+/g, ' ').trim();
/** Đoạn HTML → mảng dòng (theo <br> và <p>) */
function lines(h) {
  return decode(
    h
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h\d|li|figure|summary)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/​/g, '')
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim());
}
/** Các <p> → đoạn lời (mỗi <p> = 1 đoạn, <br> = xuống dòng) */
function paragraphs(h) {
  return [...h.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => lines(m[1]).filter(Boolean).join('\n'))
    .filter(Boolean);
}

const VI_RE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const JA_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;

/* ---------------- tách 1 bài ---------------- */
const LABELS = {
  circle: 'circle', album: 'album', arrangement: 'arrangement', arrangements: 'arrangement', arranger: 'arrangement',
  lyrics: 'lyricist', lyric: 'lyricist', lyricist: 'lyricist', vocals: 'vocals', vocal: 'vocals',
  original: 'originalTitle', originals: 'originalTitle', 'original(s)': 'originalTitle', 'original title': 'originalTitle',
  'original titles': 'originalTitle', source: 'originalTitle', composer: 'arrangement', chorus: 'chorus',
};
const PEOPLE_SPLIT = /\s*(?:;|、|,|＆|&|×|\s[x×]\s|\s\/\s)\s*/i;
const stripBracket = (s) => s.replace(/\s*[\[［][^\]］]*[\]］]/g, '').trim();

function parseEvent(album) {
  const m = album.match(/\s*[（(]\s*([^()（）]+?)\s*[)）]\s*$/);
  if (!m) return { album, event: '' };
  let ev = m[1].normalize('NFKC').replace(/[̀-ͯ´]/g, '').replace(/\s+/g, ' ').trim();
  const c = ev.match(/^(?:Comiket|C|コミケ|コミックマーケット)\s*(\d+)$/i);
  if (c) ev = `Comiket ${c[1]}`;
  else if (!/(comiket|例大祭|r[ei]{1,2}taisai|m3|紅楼夢|kouroumu|秋季|thpf|コミケ|サンシャイン|ボーマス)/i.test(ev)) return { album, event: '' };
  ev = ev.replace(/r[ei]{1,2}taisai/i, 'Reitaisai');
  return { album: album.slice(0, m.index).trim(), event: ev };
}

function youtubeFrom(h) {
  const m = h.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/) || h.match(/youtu\.be\/([\w-]{11})/) || h.match(/youtube\.com\/watch\?v=([\w-]{11})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : '';
}

export function parsePost(wp) {
  const h = wp.content || '';
  const title = clean(wp.title);
  const [tMain, tRm] = title.split(/\s*\|\s*\|?\s*/).map((s) => s.trim()).filter(Boolean);
  const post = {
    titleJP: tMain || title,
    titleRM: tRm || '',
    titleVI: '',
    circle: [], album: [], release: '', event: [], arrangement: [], lyricist: [], vocals: [], originalTitle: [], source: [],
    youtube: youtubeFrom(h),
    lyrics: { jp: '', rm: '', en: '', vi: '' },
    other: '',
    comment: '',
  };
  const notes = [];

  /* Info: tìm đoạn <p> chứa "Circle:"; tiêu đề nằm ở các <p> ngay trước nó */
  const iInfo = h.search(/>\s*Info\s*</i);
  const lyM = h.match(/<h\d[^>]*>\s*Lyrics\s*<\/h\d>|<details/i);
  const iLy = lyM ? lyM.index : -1;
  const paras = [...h.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const ci = paras.findIndex((m) => /Circle\s*(?:<\/strong>)?\s*[:：]/i.test(m[1]));
  if (ci >= 0) {
    const from = iInfo >= 0 && iInfo < paras[ci].index ? iInfo : paras[Math.max(0, ci - 1)].index;
    const before = paras.slice(0, ci).filter((m) => m.index >= from).slice(-3);
    const seg = before.map((m) => m[0]).join('') + paras[ci][0];
    const ls = lines(seg).filter(Boolean);
    const titleLines = [];
    let current = null;
    for (const l of ls) {
      const m = l.match(/^([A-Za-z() ]{3,20}?)\s*[:：]\s*(.*)$/);
      const key = m && LABELS[m[1].trim().toLowerCase()];
      if (key) {
        current = key;
        addValue(post, key, m[2], notes, m[1].trim());
      } else if (/^original\s*(track|song)?\s*!?$/i.test(l)) {
        post.originalTitle.push('Original!');
        current = 'originalTitle';
      } else if (!current) titleLines.push(l);
      else if (current === 'originalTitle') addValue(post, current, l, notes); // dòng tiếp theo của Original
    }
    // tiêu đề tiếng Việt: dòng có dấu tiếng Việt, nếu không thì dòng cuối khác tiêu đề gốc
    if (titleLines[0]) titleLines[0] = titleLines[0].split(/\s*\|\s*\|?\s*/)[0];
    const rest = titleLines.slice(1).filter((l) => norm(l) !== norm(post.titleJP) && norm(l) !== norm(post.titleRM));
    post._titleCands = rest;
  }
  for (const f of TAG_FIELDS) post[f.key] = [...new Set(post[f.key].filter(Boolean))];

  /* Lời: ưu tiên các khối <details><summary>XX Lyrics</summary> */
  const blocks = [...h.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)];
  for (const [, sumRaw, body] of blocks) {
    const sum = clean(sumRaw).toUpperCase();
    const key = sum.startsWith('JP') ? 'jp' : sum.startsWith('RM') ? 'rm' : sum.startsWith('EN') ? 'en' : sum.startsWith('VI') ? 'vi' : '';
    if (!key || post.lyrics[key]) continue;
    post.lyrics[key] = paragraphs(body).join('\n\n');
  }
  /* Không có khối tách sẵn → tự phân loại từng đoạn trong phần Lyrics xen kẽ */
  if (!blocks.length && iLy >= 0) {
    const seg = h.slice(iLy);
    const acc = { jp: [], rm: [], en: [], vi: [] };
    for (const m of seg.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      const txt = lines(m[1]).filter(Boolean).join('\n');
      if (!txt) continue;
      const key = JA_RE.test(txt) ? 'jp' : VI_RE.test(txt) ? 'vi' : /<em>/i.test(m[1]) ? 'rm' : 'en';
      acc[key].push(txt);
    }
    for (const k of Object.keys(acc)) post.lyrics[k] = acc[k].join('\n\n');
  }
  // Tiêu đề Việt: dòng có dấu tiếng Việt; nếu không có thì chỉ lấy dòng cuối khi bài có lời Việt
  const cands = post._titleCands || [];
  delete post._titleCands;
  post.titleVI = cands.find((l) => VI_RE.test(l)) || (post.lyrics.vi.trim() ? cands[cands.length - 1] || '' : '');
  if (notes.length) post.other = notes.map((n) => `- ${n}`).join('\n');
  return post;
}

function addValue(post, key, raw, notes, label) {
  let v = raw.trim();
  if (!v) return;
  if (key === 'composer' || key === 'chorus') {
    notes.push(`**${label}**: ${v}`);
    return;
  }
  if (key === 'album') {
    const { album, event } = parseEvent(stripBracket(v.replace(/\s*[\[［][^\]］]*[\]］]\s*(?=[（(]|$)/, '')) || v);
    if (album) post.album.push(album);
    if (event) post.event.push(event);
    return;
  }
  if (key === 'originalTitle') {
    for (const part of v.split(/\s*(?:\s\/\s|;|、(?=\S{2,})|,\s+(?=[^\x00-\x7f]))\s*/)) {
      const t = stripBracket(part).replace(/^\(\d+\)\s*/, '').replace(/[,，、]+$/, '').trim();
      if (!t) continue;
      if (/^[（(].*[)）]$/.test(t)) notes.push(`**Original**: ${t.slice(1, -1)}`);
      else post.originalTitle.push(t);
    }
    return;
  }
  for (const part of v.split(PEOPLE_SPLIT)) {
    const t = stripBracket(part);
    if (t) post[key].push(t);
  }
}

/* ---------------- chạy ---------------- */
async function main() {
  const url = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE}/posts/?number=100&order_by=date&order=ASC&fields=ID,title,date,modified,URL,featured_image,categories,content`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WordPress API lỗi ${res.status}`);
  const { posts: wpPosts } = await res.json();

  // Bài đã có trong data/ (để không tạo trùng)
  const existing = new Map();
  const postsDir = join(DATA, 'posts');
  for (const f of existsSync(postsDir) ? await readdir(postsDir) : []) {
    if (!f.endsWith('.json')) continue;
    const p = JSON.parse(await readFile(join(postsDir, f), 'utf8'));
    existing.set(p.id, p);
  }
  const byTitle = new Map([...existing.values()].map((p) => [norm(p.titleJP || p.titleRM), p.id]));

  const out = [];
  const skipped = [];
  for (const wp of wpPosts) {
    const cats = Object.keys(wp.categories || {});
    if (!INCLUDE_ALBUMS && cats.length && cats.every((c) => /ALBUM/i.test(c))) {
      skipped.push(`${clean(wp.title)} (bài dịch cả album)`);
      continue;
    }
    if (/Subscribe to keep reading|paywall/i.test(wp.content || '')) {
      skipped.push(`${clean(wp.title)} (bài trả phí, API không trả về nội dung)`);
      continue;
    }
    const p = parsePost(wp);
    const id = `${slugify(p.titleRM || p.titleJP) || 'wp'}-${Number(wp.ID).toString(36)}`;
    const dupId = byTitle.get(norm(p.titleJP));
    if (dupId && dupId !== id && !existing.get(dupId)?.importedFrom?.includes(wp.URL)) {
      skipped.push(`${p.titleJP} (đã có bài ${dupId})`);
      continue;
    }
    p.id = id;
    p.createdAt = new Date(wp.date).toISOString();
    p.updatedAt = new Date(wp.modified || wp.date).toISOString();
    p.trashedAt = null;
    p.version = 1;
    p.accent = existing.get(id)?.accent || '';
    p.importedFrom = wp.URL;
    p.cover = existing.get(id)?.cover || '';
    p._coverUrl = wp.featured_image || '';
    out.push(p);
  }

  /* Gộp các cách viết hoa/thường khác nhau của cùng một giá trị (vd. 紺碧studio / 紺碧Studio) */
  for (const f of TAG_FIELDS) {
    const freq = new Map();
    for (const p of [...existing.values(), ...out]) for (const v of p[f.key] || []) freq.set(v, (freq.get(v) || 0) + 1);
    const best = new Map();
    for (const [v, n] of freq) {
      const k = v.toLowerCase().replace(/\s+/g, ' ');
      const cur = best.get(k);
      if (!cur || n > freq.get(cur) || (n === freq.get(cur) && /[A-Z]/.test(v) && !/[A-Z]/.test(cur))) best.set(k, v);
    }
    for (const p of out) p[f.key] = [...new Set(p[f.key].map((v) => best.get(v.toLowerCase().replace(/\s+/g, ' ')) || v))];
  }

  /* báo cáo */
  const count = (k) => out.filter((p) => p.lyrics[k].trim()).length;
  console.log(`Đọc ${wpPosts.length} bài, nhập ${out.length}, bỏ qua ${skipped.length}.`);
  console.log(`Có lời: JP ${count('jp')} · RM ${count('rm')} · EN ${count('en')} · VI ${count('vi')}`);
  const noLy = out.filter((p) => !Object.values(p.lyrics).some((v) => v.trim()));
  const noInfo = out.filter((p) => !p.circle.length);
  if (skipped.length) console.log('Bỏ qua:\n  ' + skipped.join('\n  '));
  if (noLy.length) console.log('⚠ Không tìm thấy lời: ' + noLy.map((p) => p.titleJP).join(', '));
  if (noInfo.length) console.log('⚠ Không tìm thấy Circle: ' + noInfo.map((p) => p.titleJP).join(', '));
  if (DRY) {
    for (const p of out)
      console.log(
        `- ${p.id} | ${p.titleJP}${p.titleRM ? ' | ' + p.titleRM : ''} | VI: ${p.titleVI} | ${p.circle.join(', ')} | ${p.album.join(', ')} | ev: ${p.event.join(', ')} | arr: ${p.arrangement.join(', ')} | ly: ${p.lyricist.join(', ')} | vo: ${p.vocals.join(', ')} | orig: ${p.originalTitle.join(' + ')} | yt: ${p.youtube ? 'có' : '—'} | lời: ${['jp', 'rm', 'en', 'vi'].map((k) => k + '=' + (p.lyrics[k] ? p.lyrics[k].split('\n\n').length : 0)).join(' ')}`,
      );
    console.log('\n(--dry: chưa ghi gì)');
    return;
  }

  /* ghi */
  await mkdir(join(DATA, 'posts'), { recursive: true });
  await mkdir(join(DATA, 'media'), { recursive: true });
  for (const p of out) {
    const coverUrl = p._coverUrl;
    delete p._coverUrl;
    if (coverUrl && !NO_COVERS && !p.cover) {
      try {
        const ext = (coverUrl.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        const r = await fetch(`${coverUrl.split('?')[0]}?w=900`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rel = `media/${p.id}-cover.${ext}`;
        await writeFile(join(DATA, rel), Buffer.from(await r.arrayBuffer()));
        p.cover = rel;
      } catch (e) {
        console.warn(`⚠ Không tải được ảnh bìa của ${p.titleJP}: ${e.message}`);
      }
    }
    await writeFile(join(DATA, 'posts', `${p.id}.json`), JSON.stringify(p, null, 2) + '\n');
    existing.set(p.id, p);
  }

  // index.json + meta.json
  const index = [...existing.values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((p) => (p.trashedAt ? { id: p.id, updatedAt: p.updatedAt, trashed: true } : { id: p.id, updatedAt: p.updatedAt }));
  await writeFile(join(DATA, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  const metaPath = join(DATA, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(await readFile(metaPath, 'utf8')) : { colors: {} };
  meta.colors ||= {};
  for (const p of out)
    for (const f of TAG_FIELDS)
      for (const v of p[f.key]) {
        const b = (meta.colors[f.key] ||= {});
        b[v] ||= hashColor(v);
      }
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Đã ghi ${out.length} bài vào data/posts và cập nhật index.json, meta.json.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
