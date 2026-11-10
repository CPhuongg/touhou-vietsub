// Trang tạo / sửa bài
import { TAG_FIELDS, esc, el, youtubeId, debounce, accentVars, postAccent, extractPalette, ACCENT_PRESETS, isHex } from '../util.js';
import { TagSelect, toast, hydrateMedia } from '../ui.js';
import { EMPTY_POST } from '../store.js';
import { markdown } from '../markdown.js';
import { LANGS, align } from '../lyrics.js';

const MAX_COVER = 1200;

/** Ảnh bất kỳ → Blob WebP (cạnh dài tối đa 1200px). */
async function processCover(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_COVER / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86));
  if (blob && blob.type === 'image/webp') return blob;
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
}

export function editorView(ctx, id) {
  const { store, app } = ctx;
  if (!app.editing) {
    return {
      el: el(`<div class="empty"><h2>Cần bật chế độ biên tập</h2><p>Bấm <strong>✎ Biên tập</strong> ở cuối trang và chọn thư mục repo <code>TH VSub</code> để tạo hoặc sửa bài.</p><a class="btn" href="#/">← Về trang chủ</a></div>`),
      title: 'Biên tập',
    };
  }
  const existing = id ? store.get(id) : null;
  if (id && !existing) {
    return { el: el(`<div class="empty"><h2>Không tìm thấy bài</h2><a class="btn" href="#/">← Về trang chủ</a></div>`), title: 'Không tìm thấy' };
  }
  const p = existing ? structuredClone({ ...existing }) : EMPTY_POST();
  const pendingColors = [];
  let coverBlob = null;
  let coverURL = '';
  let removeCover = false;
  let audioFile = null;
  let removeAudio = false;
  let dirty = false;
  let saving = false;

  const root = el(`<form class="editor pa" autocomplete="off" novalidate>
    <div class="editor-head">
      <div class="eh-dot" aria-hidden="true">♪</div>
      <div>
      <h1>${existing ? 'Sửa bài' : 'Bài mới'}</h1>
      <p class="muted small">Dán lời vào các ô bên dưới, trang sẽ tự ghép theo dòng. Dòng trống = ngắt đoạn. <kbd>Ctrl</kbd>+<kbd>S</kbd> để lưu.</p>
      </div>
    </div>

    <section class="eblock">
      <h2 class="block-h">Tiêu đề</h2>
      <div class="grid3">
        <label class="field"><span>Tiếng Nhật</span><input class="input" name="titleJP" lang="ja" placeholder="花籠" value="${esc(p.titleJP)}"></label>
        <label class="field"><span>Romaji</span><input class="input" name="titleRM" placeholder="Hanakago" value="${esc(p.titleRM)}"></label>
        <label class="field"><span>Tiếng Việt</span><input class="input" name="titleVI" lang="vi" placeholder="Giỏ hoa" value="${esc(p.titleVI)}"></label>
      </div>
    </section>

    <section class="eblock two">
      <div>
        <h2 class="block-h">Ảnh bìa</h2>
        <div class="dropzone" tabindex="0" aria-label="Ảnh bìa: bấm để chọn, kéo thả hoặc dán ảnh">
          <div class="dz-preview"></div>
          <div class="dz-hint"><strong>Bấm để chọn ảnh</strong><br><span class="muted small">hoặc kéo-thả / <kbd>Ctrl</kbd>+<kbd>V</kbd> dán ảnh</span></div>
        </div>
        <input type="file" accept="image/*" class="cover-input" hidden>
        <button type="button" class="btn small-btn cover-remove" hidden>Xoá ảnh bìa</button>
        <h2 class="block-h" style="margin-top:22px">Màu chủ đạo</h2>
        <div class="accent-picker"></div>
      </div>
      <div>
        <h2 class="block-h">Audio</h2>
        <label class="field"><span>Link YouTube</span><input class="input" name="youtube" placeholder="https://www.youtube.com/watch?v=…" value="${esc(p.youtube)}"></label>
        <div class="yt-preview muted small"></div>
        <div class="field">
          <span>File nhạc trong máy <span class="muted">(chỉ lưu trong máy, không lên GitHub)</span></span>
          <div class="audio-row">
            <button type="button" class="btn audio-pick">Chọn file nhạc…</button>
            <span class="audio-name muted small"></span>
            <button type="button" class="btn small-btn audio-remove" hidden>Bỏ</button>
          </div>
          <input type="file" accept="audio/*,.flac,.m4a,.opus,.ogg,.wav,.mp3" class="audio-input" hidden>
        </div>
      </div>
    </section>

    <section class="eblock">
      <h2 class="block-h">Thông tin</h2>
      <div class="meta-grid">
        <label class="field"><span>Release</span><input class="input" type="date" name="release" value="${esc(p.release)}"></label>
      </div>
    </section>

    <section class="eblock">
      <div class="block-head"><h2 class="block-h">Lời bài hát</h2><span class="align-status"></span></div>
      <div class="ly-inputs">
        ${LANGS.map(
          (l) => `<label class="field"><span>${l.label} · ${l.name} <span class="muted small" data-count="${l.key}"></span></span>
            <textarea class="input ly-input" name="ly-${l.key}" rows="16" spellcheck="${l.key === 'vi' || l.key === 'en'}" lang="${l.key === 'vi' ? 'vi' : l.key === 'en' ? 'en' : 'ja'}" placeholder="Dán lời ${l.name.toLowerCase()}…">${esc(p.lyrics[l.key])}</textarea></label>`,
        ).join('')}
      </div>
      <details class="align-preview" open>
        <summary>Xem trước ghép dòng</summary>
        <div class="align-body"></div>
      </details>
    </section>

    ${['other', 'comment']
      .map(
        (k) => `<section class="eblock">
        <div class="block-head"><h2 class="block-h">${k === 'other' ? 'Other' : 'Comment'}</h2>
          <div class="seg small" role="group"><button type="button" data-md="${k}" data-view="write" aria-pressed="true">Viết</button><button type="button" data-md="${k}" data-view="preview" aria-pressed="false">Xem trước</button></div>
        </div>
        <textarea class="input md-input" name="${k}" rows="5" lang="vi" placeholder="${k === 'other' ? 'Ghi chú dịch, giải thích từ, nguồn tham khảo…' : 'Cảm nghĩ, nhận xét…'} (hỗ trợ **đậm**, *nghiêng*, [link](https://…), - danh sách, > trích dẫn)">${esc(p[k])}</textarea>
        <div class="md md-preview" data-preview="${k}" hidden></div>
      </section>`,
      )
      .join('')}

    <div class="savebar">
      <span class="save-state muted small"></span>
      <a class="btn" href="${existing ? `#/post/${esc(p.id)}` : '#/'}">Huỷ</a>
      <button type="submit" class="btn primary">💾 Lưu</button>
    </div>
  </form>`);

  /* ---------- tag fields ---------- */
  const metaGrid = root.querySelector('.meta-grid');
  const selects = {};
  for (const f of TAG_FIELDS) {
    const ts = new TagSelect({
      label: f.label,
      options: store.suggestions(f.key),
      value: p[f.key],
      single: f.single,
      colorOf: (v) => store.color(f.key, v),
      onColor: (v, c) => {
        pendingColors.push([f.key, v, c]);
        markDirty();
      },
    });
    selects[f.key] = ts;
    const wrap = el(`<div class="field"><span>${esc(f.label)}</span></div>`);
    wrap.appendChild(ts.root);
    metaGrid.appendChild(wrap);
  }

  /* ---------- dirty ---------- */
  const stateEl = root.querySelector('.save-state');
  function markDirty() {
    dirty = true;
    stateEl.textContent = '● Chưa lưu thay đổi';
  }
  root.addEventListener('input', markDirty);
  root.addEventListener('change', markDirty);

  /* ---------- ảnh bìa ---------- */
  const dz = root.querySelector('.dropzone');
  const dzPrev = root.querySelector('.dz-preview');
  const coverInput = root.querySelector('.cover-input');
  const coverRemove = root.querySelector('.cover-remove');
  function showCover() {
    if (coverURL) {
      dzPrev.innerHTML = `<img src="${coverURL}" alt="Ảnh bìa">`;
    } else if (p.cover && !removeCover) {
      dzPrev.innerHTML = `<img data-media="${esc(p.cover)}" data-v="${esc(p.updatedAt)}" alt="Ảnh bìa">`;
      hydrateMedia(dzPrev, store.source);
    } else dzPrev.innerHTML = '';
    const has = !!dzPrev.innerHTML;
    dz.classList.toggle('has', has);
    coverRemove.hidden = !has;
  }
  async function takeCover(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('File này không phải ảnh.', 'error');
      return;
    }
    try {
      coverBlob = await processCover(file);
      if (coverURL) URL.revokeObjectURL(coverURL);
      coverURL = URL.createObjectURL(coverBlob);
      removeCover = false;
      showCover();
      markDirty();
      loadPalette(coverBlob);
    } catch (e) {
      console.error(e);
      toast('Không đọc được ảnh này.', 'error');
    }
  }
  dz.addEventListener('click', () => coverInput.click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      coverInput.click();
    }
  });
  coverInput.addEventListener('change', () => takeCover(coverInput.files[0]));
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('over');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    takeCover(e.dataTransfer.files[0]);
  });
  const onPaste = (e) => {
    const img = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (img) {
      e.preventDefault();
      takeCover(img);
    }
  };
  document.addEventListener('paste', onPaste);
  coverRemove.addEventListener('click', () => {
    coverBlob = null;
    if (coverURL) URL.revokeObjectURL(coverURL);
    coverURL = '';
    removeCover = true;
    showCover();
    markDirty();
    coverPalette = [];
    if (!accentManual) accent = '';
    renderAccent();
  });
  showCover();

  /* ---------- màu chủ đạo ---------- */
  let accent = p.accent || '';
  let accentManual = !!p.accent;
  let coverPalette = [];
  const ap = root.querySelector('.accent-picker');
  const autoAccent = () => postAccent({ ...p, accent: '', titleJP: root.querySelector('[name="titleJP"]').value || p.titleJP });
  function applyAccent() {
    root.setAttribute('style', accentVars(accent || autoAccent()));
  }
  function renderAccent() {
    const cur = accent || autoAccent();
    const sw = (hex, title) =>
      `<button type="button" class="swatch" style="--sw:${hex}" data-hex="${hex}" title="${esc(title || hex)}" aria-label="Chọn màu ${hex}" aria-pressed="${accent === hex}"></button>`;
    ap.innerHTML = `
      <div class="ap-current">
        <label class="ap-swatch-big" title="Bấm để tự chọn màu"><input type="color" class="ap-color" value="${cur}" aria-label="Tự chọn màu"></label>
        <input class="input ap-hex" value="${accent || ''}" placeholder="${cur}" maxlength="7" aria-label="Mã màu hex" spellcheck="false">
        <span class="muted small">${accent ? (coverPalette.includes(accent) ? 'Lấy từ ảnh bìa' : 'Màu tự chọn') : 'Tự động'}</span>
      </div>
      <div class="ap-row"><span class="ap-label">Từ ảnh bìa</span>
        <div class="swatches">${coverPalette.length ? coverPalette.map((h) => sw(h, 'Màu từ ảnh bìa')).join('') : '<span class="from-cover-empty">Thêm ảnh bìa để lấy màu tự động</span>'}</div>
      </div>
      <div class="ap-row"><span class="ap-label">Bảng màu</span>
        <div class="swatches"><button type="button" class="swatch auto" data-hex="" title="Tự động" aria-label="Màu tự động" aria-pressed="${!accent}">A</button>${ACCENT_PRESETS.map((h) => sw(h)).join('')}</div>
      </div>`;
    applyAccent();
  }
  function setAccent(hex, manual = true) {
    accent = hex;
    accentManual = manual && !!hex;
    renderAccent();
    markDirty();
  }
  ap.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b) setAccent(b.dataset.hex);
  });
  ap.addEventListener('input', (e) => {
    if (e.target.matches('.ap-color')) {
      accent = e.target.value;
      accentManual = true;
      applyAccent();
      ap.querySelector('.ap-hex').value = accent;
      markDirty();
    } else if (e.target.matches('.ap-hex')) {
      let v = e.target.value.trim().toLowerCase();
      if (v && !v.startsWith('#')) v = '#' + v;
      if (isHex(v)) {
        accent = v;
        accentManual = true;
        applyAccent();
        ap.querySelector('.ap-color').value = v;
      }
    }
  });
  ap.addEventListener('change', (e) => {
    if (e.target.matches('.ap-color, .ap-hex')) renderAccent();
  });
  async function loadPalette(src) {
    try {
      coverPalette = await extractPalette(src);
      if (!accentManual && coverPalette[0]) {
        accent = coverPalette[0];
        markDirty();
      }
    } catch (err) {
      console.warn('Không lấy được màu từ ảnh', err);
      coverPalette = [];
    }
    renderAccent();
  }
  root.querySelector('[name="titleJP"]').addEventListener('input', () => {
    if (!accent) applyAccent();
  });
  renderAccent();
  if (p.cover) {
    store.source.mediaURL(p.cover, p.updatedAt).then((u) => {
      if (!u) return;
      // giữ màu đã lưu; chỉ hiển thị gợi ý từ ảnh
      extractPalette(u)
        .then((pal) => {
          coverPalette = pal;
          renderAccent();
        })
        .catch((err) => console.warn('Không lấy được màu từ ảnh', err));
    });
  }

  /* ---------- YouTube ---------- */
  const ytInput = root.querySelector('[name="youtube"]');
  const ytPrev = root.querySelector('.yt-preview');
  function showYt() {
    const v = ytInput.value.trim();
    const vid = youtubeId(v);
    if (!v) ytPrev.innerHTML = '';
    else if (!vid) ytPrev.innerHTML = '<span class="warn-text">⚠ Không nhận ra link YouTube</span>';
    else ytPrev.innerHTML = `<img src="https://i.ytimg.com/vi/${vid}/mqdefault.jpg" alt="" width="160" height="90"><span>✓ Video: ${vid}</span>`;
  }
  ytInput.addEventListener('input', debounce(showYt, 250));
  showYt();

  /* ---------- file nhạc ---------- */
  const audioInput = root.querySelector('.audio-input');
  const audioName = root.querySelector('.audio-name');
  const audioRemove = root.querySelector('.audio-remove');
  function showAudio() {
    const name = audioFile ? audioFile.name : p.audio && !removeAudio ? p.audioName || p.audio : '';
    audioName.textContent = name ? `🎵 ${name}` : 'Chưa chọn';
    audioRemove.hidden = !name;
  }
  root.querySelector('.audio-pick').addEventListener('click', () => audioInput.click());
  audioInput.addEventListener('change', () => {
    if (audioInput.files[0]) {
      audioFile = audioInput.files[0];
      removeAudio = false;
      showAudio();
      markDirty();
    }
  });
  audioRemove.addEventListener('click', () => {
    audioFile = null;
    removeAudio = true;
    showAudio();
    markDirty();
  });
  showAudio();

  /* ---------- lời + xem trước ---------- */
  const lyInputs = Object.fromEntries(LANGS.map((l) => [l.key, root.querySelector(`[name="ly-${l.key}"]`)]));
  const alignBody = root.querySelector('.align-body');
  const alignStatus = root.querySelector('.align-status');
  function renderAlign() {
    const ly = Object.fromEntries(LANGS.map((l) => [l.key, lyInputs[l.key].value]));
    const a = align(ly);
    for (const l of LANGS) {
      const st = a.split[l.key];
      root.querySelector(`[data-count="${l.key}"]`).textContent = st.length ? `${st.length} đoạn · ${st.reduce((n, s) => n + s.length, 0)} dòng` : '';
    }
    if (!a.langs.length) {
      alignStatus.innerHTML = '';
      alignBody.innerHTML = '<p class="muted small">Chưa có lời.</p>';
      return;
    }
    const stanzaCounts = a.langs.map((k) => a.split[k].length);
    const stanzaMismatch = new Set(stanzaCounts).size > 1;
    alignStatus.innerHTML =
      a.mismatches || stanzaMismatch
        ? `<span class="badge warn">⚠ ${stanzaMismatch ? 'Số đoạn khác nhau' : ''}${stanzaMismatch && a.mismatches ? ' · ' : ''}${a.mismatches ? `${a.mismatches} đoạn lệch dòng` : ''}</span>`
        : `<span class="badge ok">✓ Khớp ${a.stanzas.length} đoạn</span>`;
    alignBody.innerHTML = a.stanzas
      .map((s, i) => {
        const rows = Math.max(...a.langs.map((k) => s[k].length));
        let body = '';
        for (let r = 0; r < rows; r++)
          body += `<tr>${a.langs
            .map((k) => {
              const v = s[k][r];
              return `<td class="${v == null ? 'missing' : ''} ly-${k}">${v == null ? '—' : esc(v)}</td>`;
            })
            .join('')}</tr>`;
        const counts = a.langs.map((k) => `${k.toUpperCase()} ${s[k].length}`).join(' · ');
        return `<div class="astanza${s.mismatch ? ' bad' : ''}">
          <div class="astanza-h"><strong>Đoạn ${i + 1}</strong><span class="muted small">${counts}</span>${s.mismatch ? '<span class="badge warn">lệch</span>' : ''}</div>
          <table class="atable"><thead><tr>${a.langs.map((k) => `<th>${k.toUpperCase()}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
        </div>`;
      })
      .join('');
  }
  const renderAlignSoon = debounce(renderAlign, 250);
  for (const t of Object.values(lyInputs)) t.addEventListener('input', renderAlignSoon);
  renderAlign();

  /* ---------- markdown xem trước ---------- */
  root.querySelectorAll('[data-md]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.md;
      const preview = b.dataset.view === 'preview';
      const ta = root.querySelector(`[name="${k}"]`);
      const pv = root.querySelector(`[data-preview="${k}"]`);
      root.querySelectorAll(`[data-md="${k}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      ta.hidden = preview;
      pv.hidden = !preview;
      if (preview) pv.innerHTML = ta.value.trim() ? markdown(ta.value) : '<p class="muted">Chưa có nội dung.</p>';
    }),
  );

  /* ---------- lưu ---------- */
  async function save() {
    if (saving) return;
    const fd = new FormData(root);
    const data = {
      ...p,
      titleJP: fd.get('titleJP').trim(),
      titleRM: fd.get('titleRM').trim(),
      titleVI: fd.get('titleVI').trim(),
      release: fd.get('release') || '',
      youtube: fd.get('youtube').trim(),
      other: fd.get('other'),
      comment: fd.get('comment'),
      accent: isHex(accent) ? accent : '',
      lyrics: Object.fromEntries(LANGS.map((l) => [l.key, lyInputs[l.key].value.replace(/\r\n?/g, '\n').replace(/\s+$/, '')])),
    };
    for (const f of TAG_FIELDS) data[f.key] = selects[f.key].getValue();
    if (!data.titleJP && !data.titleRM && !data.titleVI) {
      toast('Cần ít nhất một tiêu đề.', 'error');
      root.querySelector('[name="titleJP"]').focus();
      return;
    }
    if (data.youtube && !youtubeId(data.youtube)) {
      toast('Link YouTube không hợp lệ.', 'error');
      ytInput.focus();
      return;
    }
    saving = true;
    root.classList.add('busy');
    stateEl.textContent = 'Đang lưu…';
    try {
      for (const [field, v, c] of pendingColors) (store.meta.colors[field] ||= {})[v] = c;
      const saved = await store.save(data, { coverBlob, removeCover, audioFile, removeAudio, colorsChanged: pendingColors.length > 0 });
      dirty = false;
      toast('Đã lưu bài.', 'ok');
      app.navigate(`#/post/${saved.id}`);
    } catch (e) {
      console.error(e);
      toast(`Lưu thất bại: ${e.message}`, 'error', 8000);
      stateEl.textContent = '● Chưa lưu thay đổi';
    } finally {
      saving = false;
      root.classList.remove('busy');
    }
  }
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };
  document.addEventListener('keydown', onKey);
  // Enter trong ô input không submit form (tránh lưu nhầm)
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input:not([type="submit"])')) e.preventDefault();
  });
  const onBeforeUnload = (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return {
    el: root,
    title: existing ? 'Sửa bài' : 'Bài mới',
    canLeave: () => !dirty,
    destroy() {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (coverURL) URL.revokeObjectURL(coverURL);
    },
  };
}
