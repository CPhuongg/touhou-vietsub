// Khởi động, định tuyến, chế độ đọc / biên tập
import { Store } from './store.js';
import { HttpSource, FolderSource, DemoSource, kvGet, kvSet, fsSupported } from './source.js';
import { demoSeed } from './demo.js';
import { esc, el, download, lsGet, lsSet, extractPalette } from './util.js';
import { modal, confirmBox, toast } from './ui.js';
import { homeView } from './views/home.js';
import { postView } from './views/post.js';
import { editorView } from './views/editor.js';
import { trashView } from './views/trash.js';

const SITE = 'CPhnggg Vietsub Storage';
const DEMO = new URLSearchParams(location.search).has('demo');
const viewEl = document.getElementById('view');
const bannerEl = document.getElementById('banner');
const editBtn = document.getElementById('btn-edit');

const app = {
  editing: false,
  store: null,
  current: null,
  navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
};

/* ---------- theme ---------- */
const themeBtn = document.getElementById('btn-theme');
function applyTheme() {
  // Mặc định giao diện sáng; nút ☾/☀ chuyển và được nhớ lại
  const t = lsGet('vsub-theme', null) === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === 'dark' ? '☀' : '☾';
  themeBtn.title = t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
}
themeBtn.addEventListener('click', () => {
  lsSet('vsub-theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  applyTheme();
});
applyTheme();

/* ---------- router ---------- */
let lastHash = location.hash;

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(query) };
}

function render() {
  if (!app.store) return;
  const { parts, params } = parseHash();
  app.current?.destroy?.();
  const ctx = { store: app.store, app, params };
  let v;
  if (parts[0] === 'post' && parts[1]) v = postView(ctx, parts[1]);
  else if (parts[0] === 'new') v = editorView(ctx, null);
  else if (parts[0] === 'edit' && parts[1]) v = editorView(ctx, parts[1]);
  else if (parts[0] === 'trash') v = trashView(ctx);
  else v = homeView(ctx);
  app.current = v;
  viewEl.replaceChildren(v.el);
  document.title = v.title ? `${v.title} · ${SITE}` : SITE;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', (parts[0] || 'home') === a.dataset.nav));
  if (parts[0] !== undefined || !params.toString()) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', async () => {
  if (app.current?.canLeave && !app.current.canLeave()) {
    const target = location.hash;
    history.replaceState(null, '', lastHash || '#/'); // replaceState không phát hashchange
    if (!(await confirmBox('Rời trang?', 'Bạn có thay đổi chưa lưu. Rời trang sẽ mất các thay đổi này.', { okLabel: 'Rời trang', danger: true }))) return;
    app.current.canLeave = null;
    history.replaceState(null, '', target);
  }
  lastHash = location.hash;
  render();
});

/* ---------- nguồn dữ liệu ---------- */
async function useSource(source) {
  const store = new Store(source);
  await store.load();
  store.onChange(renderBanner); // cập nhật thanh nhắc "chưa đăng" sau mỗi lần ghi
  app.store = store;
  app.editing = !!source.writable;
  document.body.classList.toggle('editing', app.editing);
  updateChrome();
  render();
}

function updateChrome() {
  const s = app.store?.source;
  if (DEMO) {
    editBtn.textContent = 'Chế độ demo';
    editBtn.disabled = true;
  } else if (s?.kind === 'folder') {
    editBtn.innerHTML = `✎ Đang biên tập: <strong>${esc(s.name)}</strong> · Thoát`;
  } else {
    editBtn.textContent = '✎ Biên tập';
  }
  renderBanner();
}

async function resumeBanner(handle) {
  bannerEl.innerHTML = '';
  const b = el(`<div class="banner wrap"><span>Tiếp tục biên tập thư mục <strong>${esc(handle.name)}</strong>?</span>
    <span class="banner-actions"><button class="btn primary small-btn" data-a="open">Mở kho</button><button class="btn small-btn" data-a="no">Để sau</button></span></div>`);
  b.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'no') bannerEl.innerHTML = '';
    if (a === 'open') {
      try {
        if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return toast('Chưa được cấp quyền.', 'error');
        const { dataDir } = await FolderSource.inspect(handle);
        if (!dataDir) return toast('Không thấy thư mục data/ trong thư mục đã chọn.', 'error');
        await useSource(new FolderSource(handle, dataDir));
        toast('Đã mở kho dữ liệu.', 'ok');
      } catch (err) {
        toast(err.message, 'error', 6000);
      }
    }
  });
  bannerEl.appendChild(b);
}

function renderBanner() {
  const s = app.store?.source;
  bannerEl.innerHTML = '';
  if (DEMO) {
    bannerEl.appendChild(el(`<div class="banner wrap info"><span>🧪 <strong>Chế độ demo</strong>: dữ liệu mẫu, mọi thay đổi mất khi tải lại trang.</span><a class="btn small-btn" href="./">Thoát demo</a></div>`));
    return;
  }
  if (s?.kind !== 'folder') return;
  const n = Store.pendingCount();
  if (!n) return;
  const b = el(`<div class="banner wrap"><span>📝 Có <strong>${n}</strong> thay đổi chưa đăng lên GitHub.</span>
    <span class="banner-actions"><button class="btn primary small-btn" data-a="how">Lệnh đăng bài</button><button class="btn small-btn" data-a="done">Đã push</button></span></div>`);
  b.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'done') {
      Store.clearPending();
      renderBanner();
    }
    if (a === 'how') showPublishHelp();
  });
  bannerEl.appendChild(b);
}

function showPublishHelp() {
  const cmd = `cd "D:\\0.Touhou\\TH VSub"\ngit add -A\ngit commit -m "Cập nhật vietsub"\ngit push`;
  const body = el(`<div>
    <p>Mở terminal (PowerShell / Git Bash) và chạy:</p>
    <pre class="code"><code>${esc(cmd)}</code></pre>
    <button type="button" class="btn small-btn copy">📋 Sao chép</button>
    <p class="muted small">GitHub Pages cập nhật sau khoảng 1 phút. Bấm “Đã push” trên thanh thông báo để ẩn nhắc nhở.</p>
  </div>`);
  body.querySelector('.copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      toast('Đã sao chép.', 'ok');
    } catch {
      toast('Không sao chép được, hãy bôi đen và copy.', 'error');
    }
  });
  modal({ title: 'Đăng thay đổi lên GitHub', body });
}

async function connectFolder() {
  if (!fsSupported()) {
    modal({
      title: 'Trình duyệt không hỗ trợ',
      body: '<p>Chế độ biên tập cần <strong>Chrome</strong> hoặc <strong>Edge</strong> trên máy tính (File System Access API).</p>',
    });
    return;
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'vsub-repo', mode: 'readwrite' });
  } catch (e) {
    if (e.name !== 'AbortError') toast(e.message, 'error');
    return;
  }
  let { dataDir, looksLikeRepo } = await FolderSource.inspect(handle);
  if (!dataDir) {
    const ok = await confirmBox(
      'Thư mục này chưa có dữ liệu',
      `Không thấy thư mục <code>data/</code> trong <strong>${esc(handle.name)}</strong>.${looksLikeRepo ? '' : ' Thư mục này cũng không giống repo TH VSub (không có index.html).'}<br><br>Tạo thư mục <code>data/</code> mới ở đây?`,
      { okLabel: 'Tạo data/' },
    );
    if (!ok) return;
    dataDir = await handle.getDirectoryHandle('data', { create: true });
  }
  await kvSet('dir', handle);
  try {
    await useSource(new FolderSource(handle, dataDir));
    toast(`Đang biên tập thư mục “${handle.name}”.`, 'ok');
  } catch (e) {
    toast(`Không đọc được thư mục: ${e.message}`, 'error', 6000);
  }
}

editBtn.addEventListener('click', async () => {
  if (DEMO) return;
  if (app.store?.source.kind === 'folder') {
    const choice = await modal({
      title: 'Thoát chế độ biên tập',
      body: '<p>Quay lại chế độ chỉ đọc (dữ liệu từ trang web). Thư mục vẫn được nhớ để lần sau mở nhanh.</p>',
      actions: [
        { label: 'Quên thư mục', value: 'forget' },
        { label: 'Huỷ', value: null },
        { label: 'Thoát', value: 'exit', primary: true },
      ],
    });
    if (!choice) return;
    if (choice === 'forget') await kvSet('dir', undefined);
    await useHttp();
    return;
  }
  connectFolder();
});

async function useHttp() {
  try {
    await useSource(new HttpSource('data/'));
  } catch (e) {
    console.error(e);
    app.store = new Store(new HttpSource('data/'));
    app.editing = false;
    document.body.classList.remove('editing');
    updateChrome();
    viewEl.replaceChildren(
      el(`<div class="empty"><h2>Không tải được dữ liệu</h2>
        <p>${location.protocol === 'file:' ? 'Trang đang được mở trực tiếp từ file. Hãy mở qua GitHub Pages, hoặc chạy <code>python -m http.server</code> trong thư mục rồi vào <code>http://localhost:8000</code>.' : esc(e.message)}</p>
        ${fsSupported() ? '<p>Hoặc bấm <strong>✎ Biên tập</strong> ở cuối trang để đọc thẳng từ thư mục trong máy.</p>' : ''}</div>`),
    );
  }
}

/* ---------- nhập / xuất ---------- */
document.getElementById('btn-io').addEventListener('click', async () => {
  const store = app.store;
  const body = el(`<div class="io">
    <section><h3>Xuất</h3><p class="muted small">Tải toàn bộ bài (kể cả thùng rác) thành 1 file JSON để backup. Ảnh và nhạc vẫn nằm trong thư mục <code>data/</code>.</p>
      <button type="button" class="btn primary" data-a="export">⬇ Xuất JSON</button></section>
    <section><h3>Nhập</h3><p class="muted small">Gộp bài từ file JSON đã xuất trước đó.</p>
      <input type="file" accept="application/json,.json" class="import-file"></section>
    <section><h3>Màu chủ đạo</h3><p class="muted small">Tự lấy màu từ ảnh bìa cho các bài có ảnh nhưng chưa chọn màu (${
      store.list().filter((p) => p.cover && !p.accent).length
    } bài).</p>
      <button type="button" class="btn" data-a="accents">🎨 Lấy màu từ ảnh bìa</button></section>
  </div>`);
  body.querySelector('[data-a="accents"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const todo = store.list().filter((p) => p.cover && !p.accent);
    if (!todo.length) return toast('Không còn bài nào cần lấy màu.', 'ok');
    btn.disabled = true;
    let done = 0;
    for (const p of todo) {
      try {
        const url = await store.source.mediaURL(p.cover, p.updatedAt);
        const [hex] = await extractPalette(url);
        if (hex) {
          await store.save({ ...p, accent: hex });
          done++;
        }
      } catch (err) {
        console.warn('Không lấy được màu', p.id, err);
      }
      btn.textContent = `🎨 Đang xử lý ${done}/${todo.length}…`;
    }
    btn.textContent = '🎨 Lấy màu từ ảnh bìa';
    btn.disabled = false;
    toast(`Đã lấy màu cho ${done} bài.`, 'ok');
    render();
  });
  body.querySelector('[data-a="export"]').addEventListener('click', () => {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    download(`vsub-export-${d}.json`, JSON.stringify(store.exportData(), null, 2));
  });
  body.querySelector('.import-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const info = store.analyzeImport(data);
      document.querySelector('dialog.modal')?.close();
      let overwrite = false;
      if (info.conflicts) {
        const c = await modal({
          title: 'Có bài trùng',
          body: `<p>File có <strong>${info.posts.length}</strong> bài, trong đó <strong>${info.conflicts}</strong> bài đã tồn tại.</p>`,
          actions: [
            { label: 'Huỷ', value: null },
            { label: 'Bỏ qua bài trùng', value: 'skip' },
            { label: 'Ghi đè bài trùng', value: 'over', danger: true },
          ],
        });
        if (!c) return;
        overwrite = c === 'over';
      } else if (!(await confirmBox('Nhập bài?', `Nhập <strong>${info.posts.length}</strong> bài từ file.`, { okLabel: 'Nhập' }))) return;
      const r = await store.importPosts(info, overwrite);
      toast(`Đã nhập ${r.added} bài${r.skipped ? `, bỏ qua ${r.skipped}` : ''}.`, 'ok');
      renderBanner();
      render();
    } catch (err) {
      toast(`Nhập thất bại: ${err.message}`, 'error', 7000);
    }
  });
  modal({ title: 'Nhập / Xuất', body });
});

/* ---------- khởi động ---------- */
async function boot() {
  window.__vsubBooted = true;
  if (DEMO) {
    await useSource(new DemoSource(demoSeed()));
    return;
  }
  let handle = null;
  if (fsSupported()) handle = await kvGet('dir');
  if (handle) {
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const { dataDir } = await FolderSource.inspect(handle);
        if (dataDir) {
          await useSource(new FolderSource(handle, dataDir));
          return;
        }
      }
    } catch (e) {
      console.warn('Không mở lại được thư mục đã lưu', e);
    }
  }
  await useHttp();
  if (handle) resumeBanner(handle);
}

boot().catch((e) => {
  console.error(e);
  viewEl.replaceChildren(el(`<div class="empty"><h2>Lỗi khởi động</h2><p>${esc(e.message)}</p></div>`));
});
