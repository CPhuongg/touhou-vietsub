// Nguồn dữ liệu: HTTP (chỉ đọc), Thư mục trong máy (đọc/ghi), Demo (trong bộ nhớ)

/* ---------- IndexedDB: lưu handle thư mục ---------- */
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vsub', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function kvGet(key) {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}
export async function kvSet(key, value) {
  const db = await idb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    if (value === undefined) tx.objectStore('kv').delete(key);
    else tx.objectStore('kv').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export const fsSupported = () => typeof window.showDirectoryPicker === 'function';

const json = (obj) => JSON.stringify(obj, null, 2) + '\n';

/* ---------- HTTP: GitHub Pages / localhost ---------- */
export class HttpSource {
  constructor(base = 'data/') {
    this.kind = 'http';
    this.writable = false;
    this.base = base;
  }
  async readJSON(path, version) {
    const url = this.base + path + (version ? `?v=${encodeURIComponent(version)}` : '');
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${path}`);
    return res.json();
  }
  async listPosts() {
    return null; // không liệt kê được thư mục qua HTTP → dùng index.json
  }
  async mediaURL(path, version) {
    if (!path) return '';
    return this.base + path + (version ? `?v=${encodeURIComponent(version)}` : '');
  }
  canPlayPrivate() {
    return false;
  }
}

/* ---------- Thư mục trong máy (File System Access API) ---------- */
export class FolderSource {
  /** Kiểm tra thư mục người dùng chọn. */
  static async inspect(handle) {
    let dataDir = null;
    let looksLikeRepo = false;
    try {
      await handle.getFileHandle('index.html');
      looksLikeRepo = true;
    } catch {
      /* không có */
    }
    try {
      dataDir = await handle.getDirectoryHandle('data');
    } catch {
      if (handle.name.toLowerCase() === 'data') {
        try {
          await handle.getFileHandle('index.json');
          dataDir = handle;
        } catch {
          /* không phải */
        }
      }
    }
    return { dataDir, looksLikeRepo };
  }

  constructor(rootHandle, dataDir) {
    this.kind = 'folder';
    this.writable = true;
    this.root = rootHandle;
    this.data = dataDir;
    this.urls = new Map();
  }
  get name() {
    return this.root.name;
  }

  async dir(parts, create) {
    let d = this.data;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create });
    return d;
  }
  async fileHandle(path, create = false) {
    const parts = path.split('/');
    const name = parts.pop();
    const d = await this.dir(parts, create);
    return d.getFileHandle(name, { create });
  }
  async readJSON(path) {
    try {
      const f = await (await this.fileHandle(path)).getFile();
      return JSON.parse(await f.text());
    } catch (e) {
      if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError') return null;
      throw e;
    }
  }
  async writeFile(path, data) {
    const fh = await this.fileHandle(path, true);
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
    this.forget(path);
  }
  writeJSON(path, obj) {
    return this.writeFile(path, json(obj));
  }
  writeBlob(path, blob) {
    return this.writeFile(path, blob);
  }
  async remove(path) {
    const parts = path.split('/');
    const name = parts.pop();
    try {
      const d = await this.dir(parts, false);
      await d.removeEntry(name);
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
    }
    this.forget(path);
  }
  async listPosts() {
    let d;
    try {
      d = await this.dir(['posts'], false);
    } catch {
      return [];
    }
    const out = [];
    for await (const [name, h] of d.entries()) {
      if (h.kind !== 'file' || !name.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(await (await h.getFile()).text()));
      } catch (e) {
        console.warn('Bỏ qua file hỏng', name, e);
      }
    }
    return out;
  }
  forget(path) {
    const u = this.urls.get(path);
    if (u) URL.revokeObjectURL(u);
    this.urls.delete(path);
  }
  async mediaURL(path) {
    if (!path) return '';
    if (this.urls.has(path)) return this.urls.get(path);
    try {
      const f = await (await this.fileHandle(path)).getFile();
      const u = URL.createObjectURL(f);
      this.urls.set(path, u);
      return u;
    } catch {
      return '';
    }
  }
  canPlayPrivate() {
    return true;
  }
}

/* ---------- Demo: dữ liệu mẫu trong bộ nhớ ---------- */
export class DemoSource {
  constructor(seed) {
    this.kind = 'demo';
    this.writable = true;
    this.name = 'demo';
    this.files = new Map();
    this.urls = new Map();
    if (seed) for (const [k, v] of Object.entries(seed)) this.files.set(k, v);
  }
  async readJSON(path) {
    const v = this.files.get(path);
    return v === undefined ? null : structuredClone(v);
  }
  async writeJSON(path, obj) {
    this.files.set(path, structuredClone(obj));
  }
  async writeBlob(path, blob) {
    this.forget(path);
    this.files.set(path, blob);
  }
  async remove(path) {
    this.forget(path);
    this.files.delete(path);
  }
  async listPosts() {
    const out = [];
    for (const [k, v] of this.files) if (k.startsWith('posts/')) out.push(structuredClone(v));
    return out;
  }
  forget(path) {
    const u = this.urls.get(path);
    if (u) URL.revokeObjectURL(u);
    this.urls.delete(path);
  }
  async mediaURL(path) {
    const v = this.files.get(path);
    if (!v) return '';
    if (typeof v === 'string') return v; // data: URL
    if (!this.urls.has(path)) this.urls.set(path, URL.createObjectURL(v));
    return this.urls.get(path);
  }
  canPlayPrivate() {
    return true;
  }
}
