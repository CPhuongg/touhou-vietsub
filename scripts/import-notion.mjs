// Nhập bài từ file export Notion (Markdown & CSV, đã giải nén) vào data/
//   node scripts/import-notion.mjs <thư-mục-export> --dry   (xem trước)
//   node scripts/import-notion.mjs <thư-mục-export>         (ghi)
// Không truyền thư mục thì tự tìm thư mục *ExportBlock* trong repo.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAG_FIELDS, hashColor, slugify, norm } from '../app/js/util.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

// Tên cùng một người/circle → cách viết giữ lại
const ALIAS = { Maika: '舞花', Mika: '美歌', 'Takanashi Koubou': '高梨工房' };

const PROP = {
  circle: 'circle', album: 'album', release: 'release', event: 'event', arrangement: 'arrangement',
  lyrics: 'lyricist', vocals: 'vocals', 'original title': 'originalTitle', source: 'source', 'created time': 'created',
};
const JA_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const VI_RE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const trimAll = (s) => s.replace(/^[\s　]+|[\s　]+$/g, '');
const key = (s) => norm(String(s).normalize('NFKC').replace(/\s+/g, ' ').trim());

/** Bỏ định dạng markdown của lời: **đậm**, ký tự escape, dòng --- */
function cleanLyrics(md) {
  return md
    .split('\n')
    .filter((l) => !/^\s*-{3,}\s*$/.test(l))
    .map((l) => trimAll(l.replace(/\*\*/g, '').replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, '$1')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function cleanMd(md) {
  return md
    .split('\n')
    .filter((l, i, a) => !(i === a.findIndex((x) => x.trim()) && /^\s*-{3,}\s*$/.test(l)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "September 25, 2026 9:30 AM" (giờ Việt Nam) → ISO */
function parseCreated(s) {
  const m = s.match(/^(\w+) (\d{1,2}), (\d{4})(?: (\d{1,2}):(\d{2}) ?(AM|PM))?/i);
  if (!m) return '';
  const mon = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(m[1].toLowerCase());
  let h = +(m[4] || 0);
  if (m[6]?.toUpperCase() === 'PM' && h < 12) h += 12;
  if (m[6]?.toUpperCase() === 'AM' && h === 12) h = 0;
  return new Date(Date.UTC(+m[3], mon, +m[2], h - 7, +(m[5] || 0))).toISOString();
}
/** "31/12/2021" → "2021-12-31" */
function parseRelease(s) {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = parseCreated(s);
  return d ? d.slice(0, 10) : '';
}

export function parsePage(text, file) {
  const t = text.replace(/\r\n?/g, '\n');
  const lines = t.split('\n');
  const h1 = [];
  lines.forEach((l, i) => l.startsWith('# ') && h1.push(i));
  const post = {
    titleJP: trimAll(lines[h1[0]]?.slice(2) || basename(file).replace(/ [0-9a-f]{32}\.md$/, '')),
    titleRM: '',
    titleVI: '',
    circle: [], album: [], release: '', event: [], arrangement: [], lyricist: [], vocals: [], originalTitle: [], source: [],
    youtube: '',
    lyrics: { jp: '', rm: '', en: '', vi: '' },
    other: '',
    comment: '',
    created: '',
  };
  // Thuộc tính: các dòng "Tên: giá trị" sau tiêu đề
  for (let i = (h1[0] ?? -1) + 1; i < lines.length && !lines[i].startsWith('#') && !lines[i].startsWith('<aside'); i++) {
    const m = lines[i].match(/^([A-Za-z ]+?)\s*:\s*(.*)$/);
    const k = m && PROP[m[1].trim().toLowerCase()];
    if (!k) continue;
    const v = m[2].trim();
    if (k === 'release') post.release = parseRelease(v);
    else if (k === 'created') post.created = parseCreated(v);
    else post[k] = v.split(/,\s+/).map(trimAll).filter(Boolean).map((x) => ALIAS[x] || x);
  }
  if (h1[1] !== undefined) post.titleVI = trimAll(lines[h1[1]].slice(2).replace(/\*\*/g, ''));

  // Các khối <aside> ## Tên ... </aside>
  const sections = {};
  for (const m of t.matchAll(/<aside>\s*\n\s*##\s*(.+?)\s*\n([\s\S]*?)<\/aside>/g)) sections[m[1].trim().toUpperCase()] = m[2];
  const ly = sections.LYRICS || '';
  const yt = ly.match(/https?:\/\/(?:www\.)?(?:youtu\.be\/[\w-]{11}|youtube\.com\/watch\?v=[\w-]{11})[^\s)\]]*/);
  if (yt) post.youtube = yt[0];

  // Khối lời gốc có thể tên "EN/JP", "JP/EN", "EN" hoặc "JP": xếp theo chữ thực tế bên trong
  for (const name of ['EN/JP', 'JP/EN', 'JP', 'EN']) {
    const txt = cleanLyrics(sections[name] || '');
    if (!txt) continue;
    const k = JA_RE.test(txt) ? 'jp' : 'en';
    if (!post.lyrics[k]) post.lyrics[k] = txt;
  }
  post.lyrics.vi = cleanLyrics(sections.VI || '');
  // Dự phòng: khối gốc trống → lấy các đoạn tiếng Nhật trong phần Lyrics xen kẽ
  if (!post.lyrics.jp && !post.lyrics.en && ly) {
    const paras = cleanLyrics(ly.replace(/\[https?:[^\]]*\]\([^)]*\)/g, '')).split(/\n\n+/);
    post.lyrics.jp = paras.filter((p) => JA_RE.test(p)).join('\n\n');
    if (!post.lyrics.vi) post.lyrics.vi = paras.filter((p) => VI_RE.test(p)).join('\n\n');
  }
  post.other = cleanMd(sections.OTHER || '');
  post.comment = cleanMd(sections.COMMENT || '');
  return post;
}

async function findExportDir() {
  const given = args.find((a) => !a.startsWith('--'));
  if (given) return given;
  for (const name of await readdir(ROOT)) {
    const p = join(ROOT, name);
    if (/ExportBlock/i.test(name) && statSync(p).isDirectory()) return p;
  }
  throw new Error('Không tìm thấy thư mục export Notion. Hãy giải nén file .zip vào thư mục repo hoặc truyền đường dẫn.');
}

async function main() {
  const dir = await findExportDir();
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md') && !/^VS NAME /.test(f));

  // Bài đang có
  const existing = new Map();
  for (const f of await readdir(join(DATA, 'posts'))) {
    if (!f.endsWith('.json')) continue;
    const p = JSON.parse(await readFile(join(DATA, 'posts', f), 'utf8'));
    existing.set(p.id, p);
  }
  // Cách viết sẵn có của từng giá trị tag (để "上海紅茶館　～ Chinese Tea" khớp "上海紅茶館 ～ Chinese Tea")
  const canon = {};
  for (const f of TAG_FIELDS) {
    canon[f.key] = new Map();
    for (const p of existing.values()) for (const v of p[f.key] || []) if (!canon[f.key].has(key(v))) canon[f.key].set(key(v), v);
  }
  const byTitle = new Map();
  for (const p of existing.values()) for (const t of [p.titleJP, p.titleRM]) if (t) byTitle.set(key(t), p.id);

  const created = [];
  const merged = [];
  for (const f of files) {
    const nid = f.match(/([0-9a-f]{32})\.md$/)?.[1] || '';
    const p = parsePage(await readFile(join(dir, f), 'utf8'), f);
    for (const fl of TAG_FIELDS) p[fl.key] = [...new Set(p[fl.key].map((v) => canon[fl.key].get(key(v)) || v))];

    const dupId = byTitle.get(key(p.titleJP));
    if (dupId && !existing.get(dupId).notionId) {
      // Gộp vào bài WordPress: chỉ bổ sung những gì bài đó còn thiếu
      const e = existing.get(dupId);
      const added = [];
      if (!e.release && p.release) (e.release = p.release), added.push('Release');
      for (const fl of TAG_FIELDS)
        if (!e[fl.key]?.length && p[fl.key].length) (e[fl.key] = p[fl.key]), added.push(fl.label);
      for (const k of ['jp', 'rm', 'en', 'vi'])
        if (!e.lyrics?.[k]?.trim() && p.lyrics[k]) (e.lyrics[k] = p.lyrics[k]), added.push(`lời ${k.toUpperCase()}`);
      if (!e.youtube && p.youtube) (e.youtube = p.youtube), added.push('YouTube');
      if (!e.titleVI && p.titleVI) (e.titleVI = p.titleVI), added.push('tiêu đề VI');
      if (!e.other?.trim() && p.other) (e.other = p.other), added.push('Other');
      if (!e.comment?.trim() && p.comment) (e.comment = p.comment), added.push('Comment');
      e.notionId = nid;
      merged.push({ post: e, added });
      continue;
    }
    const prev = [...existing.values()].find((x) => x.notionId === nid);
    // Tiêu đề có chữ Nhật thì slug từ tiêu đề Việt cho dễ đọc
    const slug = (JA_RE.test(p.titleJP) ? slugify(p.titleVI) : '') || slugify(p.titleJP) || 'vsub';
    const id = prev?.id || `${slug}-${nid.slice(-4) || Math.random().toString(36).slice(2, 6)}`;
    const createdAt = p.created || new Date().toISOString();
    delete p.created;
    created.push({
      ...p,
      id,
      cover: prev?.cover || '',
      accent: prev?.accent || '',
      audio: prev?.audio || '',
      audioName: prev?.audioName || '',
      createdAt: prev?.createdAt || createdAt,
      updatedAt: createdAt,
      trashedAt: null,
      version: 1,
      notionId: nid,
    });
  }

  /* báo cáo */
  const count = (k) => created.filter((p) => p.lyrics[k].trim()).length;
  console.log(`Đọc ${files.length} trang Notion: tạo ${created.length} bài mới, gộp ${merged.length} bài vào bài đã có.`);
  console.log(`Bài mới có lời: JP ${count('jp')} · EN ${count('en')} · VI ${count('vi')}`);
  for (const m of merged) console.log(`Gộp vào ${m.post.id}: thêm ${m.added.join(', ') || '(không có gì mới)'}`);
  const noLy = created.filter((p) => !p.lyrics.vi && !p.lyrics.jp && !p.lyrics.en);
  if (noLy.length) console.log('⚠ Không tìm thấy lời: ' + noLy.map((p) => p.titleJP).join(', '));
  if (DRY) {
    for (const p of created)
      console.log(
        `- ${p.id} | ${p.titleJP} | VI: ${p.titleVI} | ${p.circle.join(', ')} | ${p.album.join(', ')} | rel: ${p.release} | ev: ${p.event.join(', ')} | arr: ${p.arrangement.join(', ')} | ly: ${p.lyricist.join(', ')} | vo: ${p.vocals.join(', ')} | orig: ${p.originalTitle.join(' + ')} | src: ${p.source.join(', ')} | yt: ${p.youtube ? 'có' : '—'} | lời: ${['jp', 'en', 'vi'].map((k) => k + '=' + (p.lyrics[k] ? p.lyrics[k].split('\n\n').length : 0)).join(' ')}${p.other ? ' | other' : ''}${p.comment ? ' | comment' : ''} | ${p.createdAt.slice(0, 10)}`,
      );
    console.log('\n(--dry: chưa ghi gì)');
    return;
  }

  /* ghi */
  for (const p of [...created, ...merged.map((m) => m.post)]) {
    await writeFile(join(DATA, 'posts', `${p.id}.json`), JSON.stringify(p, null, 2) + '\n');
    existing.set(p.id, p);
  }
  const index = [...existing.values()]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((p) => (p.trashedAt ? { id: p.id, updatedAt: p.updatedAt, trashed: true } : { id: p.id, updatedAt: p.updatedAt }));
  await writeFile(join(DATA, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  const metaPath = join(DATA, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(await readFile(metaPath, 'utf8')) : { colors: {} };
  meta.colors ||= {};
  for (const p of created)
    for (const f of TAG_FIELDS)
      for (const v of p[f.key]) {
        const b = (meta.colors[f.key] ||= {});
        b[v] ||= hashColor(v);
      }
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n');
  console.log(`Đã ghi ${created.length} bài mới, cập nhật ${merged.length} bài, index.json và meta.json.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
