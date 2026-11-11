// Trang bài viết
import { TAG_FIELDS, esc, el, fmtDate, displayTitle, plainTitle, youtubeId, lsGet, lsSet, placeholderCover, accentStyle } from '../util.js';
import { pill, hydrateMedia, confirmBox, toast } from '../ui.js';
import { markdown } from '../markdown.js';
import { LANGS, hasLyrics, renderInterleave, renderParallel, renderSingle } from '../lyrics.js';
import { tagHref } from './home.js';

const MODES = [
  { key: 'interleave', label: 'Xen kẽ' },
  { key: 'parallel', label: 'Song song' },
  { key: 'single', label: 'Từng bản' },
];

export function postView(ctx, id) {
  const { store, app } = ctx;
  const p = store.get(id);
  if (!p || (p.trashedAt && !app.editing)) {
    return {
      el: el(`<div class="empty"><h2>Không tìm thấy bài</h2><p>Bài này không tồn tại hoặc đã bị xoá.</p><a class="btn" href="#/">← Về trang chủ</a></div>`),
      title: 'Không tìm thấy',
    };
  }
  const t = displayTitle(p);
  const list = store.list();
  const idx = list.findIndex((x) => x.id === p.id);
  const newer = idx > 0 ? list[idx - 1] : null;
  const older = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const yt = youtubeId(p.youtube);
  const canPlayAudio = p.audio && store.source.canPlayPrivate();

  const infoRows = [
    ...TAG_FIELDS.filter((f) => p[f.key].length).map(
      (f) => `<div class="prop"><div class="prop-k"><span aria-hidden="true">${f.icon}</span> ${esc(f.label)}</div><div class="prop-v">${p[f.key]
        .map((v) => pill(v, store.color(f.key, v), { href: tagHref(f.key, v) }))
        .join('')}</div></div>`,
    ),
  ];
  if (p.release) infoRows.splice(2, 0, `<div class="prop"><div class="prop-k"><span aria-hidden="true">▤</span> Release</div><div class="prop-v">${fmtDate(p.release)}</div></div>`);

  const eyebrow = [p.circle[0], p.event[0], p.release ? p.release.slice(0, 4) : ''].filter(Boolean);
  const root = el(`<article class="post pa" style="${accentStyle(p)}">
    ${p.trashedAt ? `<div class="notice warn">Bài này đang ở trong thùng rác. <a href="#/trash">Mở thùng rác</a></div>` : ''}
    <header class="post-hero">
      <div class="hero-bg" aria-hidden="true">${p.cover ? `<img data-media="${esc(p.cover)}" data-v="${esc(p.updatedAt)}" alt="">` : ''}</div>
      <div class="hero-inner">
        <div class="hero-cover">${
          p.cover
            ? `<img data-media="${esc(p.cover)}" data-v="${esc(p.updatedAt)}" alt="Ảnh bìa ${esc(t.main)}">`
            : placeholderCover(p)
        }</div>
        <div class="hero-text">
          ${eyebrow.length ? `<div class="eyebrow">${eyebrow.map(esc).join(' · ')}</div>` : ''}
          <h1 class="post-title"><span class="t-main">${esc(t.main)}</span>${t.rm ? `<span class="t-sep"> | </span><span class="t-rm">${esc(t.rm)}</span>` : ''}</h1>
          ${t.vi ? `<p class="post-vi">${esc(t.vi)}</p>` : ''}
          <div class="hero-tags">${p.circle.map((v) => pill(v, store.color('circle', v), { href: tagHref('circle', v) })).join('')}${p.source
            .map((v) => pill(v, store.color('source', v), { href: tagHref('source', v) }))
            .join('')}</div>
          ${
            app.editing
              ? `<div class="post-actions"><a class="btn primary" href="#/edit/${esc(p.id)}">✎ Sửa</a>${
                  p.trashedAt ? '' : '<button class="btn danger-ghost" data-act="trash">🗑 Xoá</button>'
                }</div>`
              : ''
          }
        </div>
      </div>
    </header>

    <div class="post-body">
      ${infoRows.length ? `<section class="block"><h2 class="block-h">Info</h2><div class="props">${infoRows.join('')}</div></section>` : ''}

      ${
        yt || canPlayAudio
          ? `<section class="block"><h2 class="block-h">Audio</h2>
            ${
              yt
                ? `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="YouTube: ${esc(plainTitle(p))}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>
                   <p class="yt-link"><a href="https://www.youtube.com/watch?v=${yt}" target="_blank" rel="noopener noreferrer">▶ Mở trên YouTube ↗</a></p>`
                : ''
            }
            ${canPlayAudio ? `<div class="local-audio"><audio controls preload="metadata" data-media="${esc(p.audio)}"></audio><div class="muted small">🔒 File trong máy: ${esc(p.audioName || p.audio)} (không đưa lên GitHub)</div></div>` : ''}
          </section>`
          : ''
      }

      <section class="block lyrics-block">
        <div class="block-head">
          <h2 class="block-h">Lyrics</h2>
          ${
            hasLyrics(p.lyrics)
              ? `<div class="ly-controls">
              <div class="seg" role="group" aria-label="Chế độ hiển thị lời">${MODES.map((m) => `<button type="button" data-mode="${m.key}">${m.label}</button>`).join('')}</div>
              ${p.lyrics.rm.trim() ? `<label class="switch"><input type="checkbox" class="lang-toggle" data-lang="rm"> Romaji</label>` : ''}
              ${p.lyrics.en.trim() && p.lyrics.jp.trim() ? `<label class="switch"><input type="checkbox" class="lang-toggle" data-lang="en"> English</label>` : ''}
            </div>`
              : ''
          }
        </div>
        <div class="single-tabs" hidden></div>
        <div class="lyrics"></div>
      </section>

      ${p.other.trim() ? `<section class="block callout"><h2 class="block-h">Other</h2><div class="md">${markdown(p.other)}</div></section>` : ''}
      ${p.comment.trim() ? `<section class="block callout"><h2 class="block-h">Comment</h2><div class="md">${markdown(p.comment)}</div></section>` : ''}

      <footer class="post-foot muted small">Đăng ${fmtDate(p.createdAt)}${p.updatedAt && p.updatedAt.slice(0, 10) !== p.createdAt.slice(0, 10) ? ` · Cập nhật ${fmtDate(p.updatedAt)}` : ''}</footer>

      <nav class="prevnext">
        ${older ? `<a class="pn prev" href="#/post/${esc(older.id)}"><span class="muted small">← Bài trước</span><span>${esc(plainTitle(older))}</span></a>` : '<span></span>'}
        ${newer ? `<a class="pn next" href="#/post/${esc(newer.id)}"><span class="muted small">Bài sau →</span><span>${esc(plainTitle(newer))}</span></a>` : '<span></span>'}
      </nav>

      ${relatedHTML(store, p, list)}
    </div>
  </article>`);

  /* ---------- lời bài hát ---------- */
  const lyEl = root.querySelector('.lyrics');
  const tabsEl = root.querySelector('.single-tabs');
  let mode = lsGet('vsub-lymode', 'interleave');
  const show = { rm: lsGet('vsub-showrm', true), en: lsGet('vsub-showen', true) };
  let single = lsGet('vsub-single', 'vi');
  root.querySelectorAll('.lang-toggle').forEach((t) => (t.checked = show[t.dataset.lang]));
  // Bài không có lời Nhật → EN là lời gốc, luôn hiện
  const enOnly = !p.lyrics.jp.trim();
  const visible = (k) => (k === 'rm' ? show.rm : k === 'en' ? show.en || enOnly : true);

  function renderLyrics() {
    if (!hasLyrics(p.lyrics)) {
      lyEl.innerHTML = '<p class="muted">Chưa có lời.</p>';
      return;
    }
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const keys = LANGS.map((l) => l.key).filter(visible);
    lyEl.className = `lyrics mode-${mode}`;
    if (mode === 'single') {
      const avail = LANGS.filter((l) => p.lyrics[l.key].trim() && visible(l.key));
      if (!avail.some((l) => l.key === single)) single = avail[avail.length - 1]?.key || 'jp';
      tabsEl.hidden = false;
      tabsEl.innerHTML = avail
        .map((l) => `<button type="button" class="stab${l.key === single ? ' on' : ''}" data-lang="${l.key}">${l.label} Lyrics</button>`)
        .join('');
      lyEl.innerHTML = renderSingle(p.lyrics, single);
    } else {
      tabsEl.hidden = true;
      lyEl.innerHTML = mode === 'parallel' ? renderParallel(p.lyrics, keys) : renderInterleave(p.lyrics, keys);
    }
  }
  root.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      lsSet('vsub-lymode', mode);
      renderLyrics();
    }),
  );
  root.querySelectorAll('.lang-toggle').forEach((t) =>
    t.addEventListener('change', () => {
      show[t.dataset.lang] = t.checked;
      lsSet(t.dataset.lang === 'rm' ? 'vsub-showrm' : 'vsub-showen', t.checked);
      renderLyrics();
    }),
  );
  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    single = b.dataset.lang;
    lsSet('vsub-single', single);
    renderLyrics();
  });
  renderLyrics();

  /* ---------- xoá ---------- */
  root.querySelector('[data-act="trash"]')?.addEventListener('click', async () => {
    if (!(await confirmBox('Chuyển vào thùng rác?', `Bài “${esc(plainTitle(p))}” sẽ bị ẩn khỏi trang. Bạn có thể khôi phục trong Thùng rác.`, { okLabel: 'Chuyển vào thùng rác', danger: true }))) return;
    try {
      await store.trash(p.id);
      toast('Đã chuyển vào thùng rác.', 'ok');
      app.navigate('#/');
    } catch (e) {
      toast(e.message, 'error', 6000);
    }
  });

  hydrateMedia(root, store.source);
  return { el: root, title: plainTitle(p) };
}

function relatedHTML(store, p, list) {
  const score = (q) => {
    let s = 0;
    for (const k of ['circle', 'originalTitle', 'source', 'album', 'vocals']) for (const v of q[k]) if (p[k].includes(v)) s += k === 'circle' || k === 'originalTitle' ? 3 : 1;
    return s;
  };
  const rel = list
    .filter((q) => q.id !== p.id)
    .map((q) => [q, score(q)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  if (!rel.length) return '';
  return `<section class="related"><h2 class="block-h">Related</h2><div class="related-grid">${rel
    .map(([q]) => {
      const why = q.circle.find((v) => p.circle.includes(v)) || q.originalTitle.find((v) => p.originalTitle.includes(v)) || q.source.find((v) => p.source.includes(v)) || '';
      return `<a class="rcard pa" style="${accentStyle(q)}" href="#/post/${esc(q.id)}">
        <div class="gcover">${q.cover ? `<img data-media="${esc(q.cover)}" data-v="${esc(q.updatedAt)}" alt="" loading="lazy">` : placeholderCover(q)}</div>
        <div class="gtitle">${esc(plainTitle(q))}</div>
        ${why ? `<div class="muted small">Liên quan: ${esc(why)}</div>` : ''}
      </a>`;
    })
    .join('')}</div></section>`;
}
