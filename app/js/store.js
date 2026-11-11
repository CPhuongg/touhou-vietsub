// Kho bài viết: nạp, lưu, thùng rác, tag, tìm kiếm, nhập/xuất
import { TAG_FIELDS, hashColor, norm, slugify, shortId, todayISO, lsGet, lsSet, isHex } from './util.js';

export const EMPTY_POST = () => ({
  id: '',
  titleJP: '',
  titleRM: '',
  titleVI: '',
  circle: [],
  album: [],
  release: '',
  event: [],
  arrangement: [],
  lyricist: [],
  vocals: [],
  originalTitle: [],
  source: [],
  cover: '',
  accent: '',
  youtube: '',
  audio: '',
  audioName: '',
  lyrics: { jp: '', rm: '', en: '', vi: '' },
  other: '',
  comment: '',
  createdAt: '',
  updatedAt: '',
  trashedAt: null,
  version: 1,
});

/** Chuẩn hoá bài đọc từ file (thiếu trường, sai kiểu...). */
export function normalizePost(raw) {
  const p = Object.assign(EMPTY_POST(), raw || {});
  for (const f of TAG_FIELDS) {
    const v = p[f.key];
    p[f.key] = Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : [];
  }
  p.lyrics = Object.assign({ jp: '', rm: '', en: '', vi: '' }, p.lyrics || {});
  for (const k of Object.keys(p.lyrics)) p.lyrics[k] = p.lyrics[k] == null ? '' : String(p.lyrics[k]);
  for (const k of ['titleJP', 'titleRM', 'titleVI', 'release', 'cover', 'youtube', 'audio', 'audioName', 'other', 'comment']) {
    p[k] = p[k] == null ? '' : String(p[k]);
  }
  p.accent = isHex(p.accent) ? p.accent.toLowerCase() : '';
  p.trashedAt = p.trashedAt || null;
  return p;
}

const PENDING_KEY = 'vsub-pending';

export class Store {
  constructor(source) {
    this.source = source;
    this.posts = new Map();
    this.meta = { colors: {} };
    this.listeners = new Set();
  }

  get writable() {
    return !!this.source?.writable;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }

  async load() {
    const src = this.source;
    this.posts.clear();
    const meta = await src.readJSON('meta.json');
    this.meta = meta && typeof meta === 'object' ? meta : { colors: {} };
    this.meta.colors ||= {};

    const listed = await src.listPosts();
    if (listed) {
      for (const raw of listed) {
        const p = normalizePost(raw);
        if (p.id) this.posts.set(p.id, p);
      }
      // Đồng bộ lại index.json nếu lệch (vd. sửa tay file bài)
      const cur = await src.readJSON('index.json');
      const next = this.buildIndex();
      if (JSON.stringify(cur) !== JSON.stringify(next)) await src.writeJSON('index.json', next);
    } else {
      const index = (await src.readJSON('index.json')) || [];
      const entries = Array.isArray(index) ? index.filter((e) => e && e.id && !e.trashed) : [];
      const results = await Promise.all(
        entries.map((e) =>
          src.readJSON(`posts/${e.id}.json`, e.updatedAt).catch((err) => {
            console.warn('Không tải được bài', e.id, err);
            return null;
          }),
        ),
      );
      for (const raw of results) {
        if (!raw) continue;
        const p = normalizePost(raw);
        if (p.id) this.posts.set(p.id, p);
      }
    }
    this.emit();
  }

  buildIndex() {
    return [...this.posts.values()]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((p) => (p.trashedAt ? { id: p.id, updatedAt: p.updatedAt, trashed: true } : { id: p.id, updatedAt: p.updatedAt }));
  }

  /* ---------- truy vấn ---------- */
  list({ trashed = false } = {}) {
    return [...this.posts.values()]
      .filter((p) => (trashed ? !!p.trashedAt : !p.trashedAt))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  get(id) {
    return this.posts.get(id) || null;
  }

  /** Map giá trị → số bài, cho 1 trường tag. */
  values(field) {
    const m = new Map();
    for (const p of this.list()) for (const v of p[field] || []) m.set(v, (m.get(v) || 0) + 1);
    return new Map([...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  }
  /** Mọi giá trị đã từng dùng (kể cả trong thùng rác, và trong meta) để gợi ý. */
  suggestions(field) {
    const s = new Set(Object.keys(this.meta.colors[field] || {}));
    for (const p of this.posts.values()) for (const v of p[field] || []) s.add(v);
    return [...s].sort((a, b) => a.localeCompare(b));
  }

  color(field, value) {
    return this.meta.colors[field]?.[value] || hashColor(value);
  }

  searchText(p) {
    if (!p._search) {
      const parts = [p.titleJP, p.titleRM, p.titleVI, p.release, p.other, p.comment, p.lyrics.jp, p.lyrics.rm, p.lyrics.en, p.lyrics.vi];
      for (const f of TAG_FIELDS) parts.push(...(p[f.key] || []));
      Object.defineProperty(p, '_search', { value: norm(parts.join('\n')), enumerable: false, writable: true, configurable: true });
    }
    return p._search;
  }
  matches(p, q) {
    if (!q) return true;
    const text = this.searchText(p);
    return norm(q)
      .split(/\s+/)
      .filter(Boolean)
      .every((w) => text.includes(w));
  }

  /* ---------- ghi ---------- */
  requireWritable() {
    if (!this.writable) throw new Error('Đang ở chế độ chỉ đọc. Hãy bấm “Biên tập” và chọn thư mục repo.');
  }
  markPending() {
    if (this.source.kind === 'folder') lsSet(PENDING_KEY, (lsGet(PENDING_KEY, 0) || 0) + 1);
  }
  static pendingCount() {
    return lsGet(PENDING_KEY, 0) || 0;
  }
  static clearPending() {
    lsSet(PENDING_KEY, 0);
  }

  makeId(p) {
    const base = slugify(p.titleRM || p.titleVI || p.titleJP) || 'bai';
    let id;
    do id = `${base}-${shortId()}`;
    while (this.posts.has(id));
    return id;
  }

  async writePost(p) {
    delete p._search;
    const clean = { ...p };
    await this.source.writeJSON(`posts/${p.id}.json`, clean);
    this.posts.set(p.id, normalizePost(clean));
  }
  async writeIndex() {
    await this.source.writeJSON('index.json', this.buildIndex());
  }
  async writeMeta() {
    await this.source.writeJSON('meta.json', this.meta);
  }

  /** Ghi nhận màu cho giá trị mới để màu cố định về sau. */
  rememberColors(p) {
    let changed = false;
    for (const f of TAG_FIELDS) {
      for (const v of p[f.key]) {
        const bucket = (this.meta.colors[f.key] ||= {});
        if (!bucket[v]) {
          bucket[v] = hashColor(v);
          changed = true;
        }
      }
    }
    return changed;
  }

  /* ---------- đồng bộ theo album ---------- */
  albumSiblings(p) {
    if (!p.album.length) return [];
    return this.list().filter((q) => q.id !== p.id && q.album.some((a) => p.album.includes(a)));
  }

  /**
   * Sau khi lưu bài `p` (trước đó là `prev`): các bài cùng album dùng chung Release và Event.
   * - Release/Event vừa đổi (khác rỗng) → ghi sang các bài cùng album.
   * - Album vừa đổi → bài này lấy Release/Event còn trống từ bài cùng album.
   * Trả về danh sách bài đã được cập nhật thêm (kể cả `p` nếu nó được điền).
   */
  async syncAlbum(p, prev) {
    const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
    const empty = (v) => (Array.isArray(v) ? !v.length : !v);
    const copy = (v) => (Array.isArray(v) ? [...v] : v);
    const fields = ['release', 'event'];
    const out = [];
    let cur = p;
    if (prev && !same(prev.album, p.album)) {
      const sib = this.albumSiblings(p);
      const upd = { ...p };
      let diff = false;
      for (const f of fields) {
        if (!empty(p[f])) continue;
        const src = sib.find((q) => !empty(q[f]));
        if (src) {
          upd[f] = copy(src[f]);
          diff = true;
        }
      }
      if (diff) {
        cur = await this.save(upd);
        out.push(cur);
      }
    }
    const pushed = fields.filter((f) => !empty(cur[f]) && (!prev || !same(prev[f], cur[f])));
    if (pushed.length) {
      for (const q of this.albumSiblings(cur)) {
        const upd = { ...q };
        let diff = false;
        for (const f of pushed) {
          if (!same(q[f], cur[f])) {
            upd[f] = copy(cur[f]);
            diff = true;
          }
        }
        if (diff) out.push(await this.save(upd));
      }
    }
    return out;
  }

  async setColor(field, value, color) {
    this.requireWritable();
    (this.meta.colors[field] ||= {})[value] = color;
    await this.writeMeta();
    this.markPending();
    this.emit();
  }

  /**
   * Lưu bài. opts: { coverBlob, removeCover, audioFile, removeAudio }
   */
  async save(input, opts = {}) {
    this.requireWritable();
    const p = normalizePost(input);
    const isNew = !p.id || !this.posts.has(p.id);
    if (!p.id) p.id = this.makeId(p);
    const now = todayISO();
    if (isNew) p.createdAt ||= now;
    p.updatedAt = now;

    const prev = this.posts.get(p.id);
    if (opts.coverBlob) {
      const ext = opts.coverBlob.type === 'image/webp' ? 'webp' : opts.coverBlob.type === 'image/png' ? 'png' : 'jpg';
      const path = `media/${p.id}-cover.${ext}`;
      if (prev?.cover && prev.cover !== path) await this.source.remove(prev.cover);
      await this.source.writeBlob(path, opts.coverBlob);
      p.cover = path;
    } else if (opts.removeCover && p.cover) {
      await this.source.remove(p.cover);
      p.cover = '';
    }
    if (opts.audioFile) {
      const m = opts.audioFile.name.match(/\.([a-z0-9]{1,5})$/i);
      const path = `media-private/${p.id}-audio.${m ? m[1].toLowerCase() : 'mp3'}`;
      if (prev?.audio && prev.audio !== path) await this.source.remove(prev.audio);
      await this.source.writeBlob(path, opts.audioFile);
      p.audio = path;
      p.audioName = opts.audioFile.name;
    } else if (opts.removeAudio && p.audio) {
      await this.source.remove(p.audio);
      p.audio = '';
      p.audioName = '';
    }

    await this.writePost(p);
    await this.writeIndex();
    if (this.rememberColors(p) || opts.colorsChanged) await this.writeMeta();
    this.markPending();
    this.emit();
    return this.posts.get(p.id);
  }

  async trash(id) {
    this.requireWritable();
    const p = this.get(id);
    if (!p) return;
    p.trashedAt = todayISO();
    p.updatedAt = p.trashedAt;
    await this.writePost(p);
    await this.writeIndex();
    this.markPending();
    this.emit();
  }
  async restore(id) {
    this.requireWritable();
    const p = this.get(id);
    if (!p) return;
    p.trashedAt = null;
    p.updatedAt = todayISO();
    await this.writePost(p);
    await this.writeIndex();
    this.markPending();
    this.emit();
  }
  async destroy(id) {
    this.requireWritable();
    const p = this.get(id);
    if (!p) return;
    if (p.cover) await this.source.remove(p.cover);
    if (p.audio) await this.source.remove(p.audio);
    await this.source.remove(`posts/${id}.json`);
    this.posts.delete(id);
    await this.writeIndex();
    this.markPending();
    this.emit();
  }

  /* ---------- nhập / xuất ---------- */
  exportData() {
    return {
      app: 'cphnggg-vietsub-storage',
      version: 1,
      exportedAt: todayISO(),
      meta: this.meta,
      posts: [...this.posts.values()].map((p) => ({ ...p })),
    };
  }

  /** Phân tích file nhập: trả về { posts, conflicts } */
  analyzeImport(data) {
    if (!data || typeof data !== 'object') throw new Error('File không hợp lệ.');
    const list = Array.isArray(data) ? data : data.posts;
    if (!Array.isArray(list)) throw new Error('Không tìm thấy danh sách bài (posts) trong file.');
    const posts = list.map(normalizePost).filter((p) => p.id || p.titleJP || p.titleRM || p.titleVI);
    const conflicts = posts.filter((p) => p.id && this.posts.has(p.id)).length;
    return { posts, conflicts, meta: data.meta };
  }

  async importPosts({ posts, meta }, overwrite) {
    this.requireWritable();
    let added = 0;
    let skipped = 0;
    for (const raw of posts) {
      const p = { ...raw };
      if (p.id && this.posts.has(p.id) && !overwrite) {
        skipped++;
        continue;
      }
      if (!p.id) p.id = this.makeId(p);
      p.createdAt ||= todayISO();
      p.updatedAt ||= p.createdAt;
      await this.writePost(p);
      this.rememberColors(this.posts.get(p.id));
      added++;
    }
    if (meta?.colors) {
      for (const [field, bucket] of Object.entries(meta.colors)) {
        Object.assign((this.meta.colors[field] ||= {}), bucket);
      }
    }
    await this.writeIndex();
    await this.writeMeta();
    this.markPending();
    this.emit();
    return { added, skipped };
  }
}
