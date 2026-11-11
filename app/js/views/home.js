// Trang chủ: 4 kiểu xem + sidebar lọc
import { TAG_FIELDS, FIELD_BY_KEY, esc, el, fmtDate, displayTitle, plainTitle, debounce, lsGet, lsSet, placeholderCover, accentStyle, youtubeId } from '../util.js';
import { pill, hydrateMedia, TagSelect, toast } from '../ui.js';
import { markdown } from '../markdown.js';
import { LANGS, hasLyrics, renderInterleave, renderParallel } from '../lyrics.js';
import { infoRowsHTML } from './post.js';

const TABS = [
  { key: 'posts', label: 'Posts', icon: '☰' },
  { key: 'table', label: 'Bảng', icon: '▦' },
  { key: 'circle', label: 'Circle', icon: '◎' },
  { key: 'gallery', label: 'Gallery', icon: '▣' },
];
const PER_PAGE = 10;
const TABLE_COLS = [
  { key: 'title', label: 'Title' },
  { key: 'circle', label: 'Circle' },
  { key: 'album', label: 'Album' },
  { key: 'release', label: 'Release' },
  { key: 'event', label: 'Event' },
  { key: 'arrangement', label: 'Arrangement' },
  { key: 'lyricist', label: 'Lyrics' },
  { key: 'vocals', label: 'Vocals' },
  { key: 'originalTitle', label: 'Original Title' },
  { key: 'source', label: 'Source' },
  { key: 'createdAt', label: 'Created' },
];

export function hrefWith(params, changes) {
  const p = new URLSearchParams(params);
  for (const [k, v] of Object.entries(changes)) {
    if (v == null || v === '') p.delete(k);
    else p.set(k, v);
  }
  if (!('page' in changes)) p.delete('page');
  const s = p.toString();
  return '#/' + (s ? '?' + s : '');
}

export function tagHref(field, value) {
  return hrefWith(new URLSearchParams(), { [field]: value });
}

export function homeView(ctx) {
  const { store, app } = ctx;
  const params = ctx.params;
  const tab = params.get('tab') || lsGet('vsub-tab', 'posts');
  lsSet('vsub-tab', tab);
  let all = store.list();
  const editable = app.editing && store.writable;

  const root = el(`<div>
  <div class="home">
    <aside class="sidebar"></aside>
    <section class="home-main">
      <div class="toolbar">
        <nav class="tabs" role="tablist">${TABS.map(
          (t) =>
            `<a role="tab" class="tab${t.key === tab ? ' active' : ''}" aria-selected="${t.key === tab}" href="${hrefWith(params, { tab: t.key })}"><span aria-hidden="true">${t.icon}</span> ${t.label}</a>`,
        ).join('')}</nav>
        <span class="result-count muted"></span>
      </div>
      <div class="chips"></div>
      <div class="results"></div>
    </section>
  </div>
  </div>`);

  /* ---------- lọc ---------- */
  const filters = TAG_FIELDS.filter((f) => params.get(f.key)).map((f) => [f.key, params.get(f.key)]);
  const month = params.get('month') || '';
  let q = params.get('q') || '';

  const filtered = () =>
    all.filter(
      (p) =>
        filters.every(([k, v]) => p[k].includes(v)) &&
        (!month || (p.createdAt || '').startsWith(month)) &&
        store.matches(p, q),
    );

  /* ---------- chips ---------- */
  const chips = root.querySelector('.chips');
  const chipList = [
    ...filters.map(([k, v]) => ({ label: `${FIELD_BY_KEY[k].label}: ${v}`, color: store.color(k, v), href: hrefWith(params, { [k]: null }) })),
    ...(month ? [{ label: `Tháng ${month.slice(5)}/${month.slice(0, 4)}`, color: 'default', href: hrefWith(params, { month: null }) }] : []),
  ];
  if (chipList.length) {
    chips.innerHTML =
      chipList.map((c) => `<a class="chip tag c-${c.color}" href="${esc(c.href)}" title="Bỏ lọc">${esc(c.label)} <span aria-hidden="true">×</span></a>`).join('') +
      `<a class="chip-clear" href="${hrefWith(new URLSearchParams({ tab }), {})}">Xoá lọc</a>`;
  }

  /* ---------- sidebar ---------- */
  const side = root.querySelector('.sidebar');
  const wideMQ = matchMedia('(min-width: 960px)');
  const wide = wideMQ.matches;
  side.innerHTML = `<details class="side-details"${wide || chipList.length || q ? ' open' : ''}>
    <summary>Tìm kiếm &amp; lọc</summary>
    <div class="widget">
      <h3>Tìm kiếm</h3>
      <input type="search" class="input search" placeholder="Tiêu đề, circle, lời bài hát…" value="${esc(q)}" aria-label="Tìm kiếm">
    </div>
    ${TAG_FIELDS.map((f) => {
      const vals = store.values(f.key);
      if (!vals.size) return '';
      const items = [...vals.entries()];
      const cur = params.get(f.key);
      const render = (list) =>
        list
          .map(([v, n]) => {
            const on = cur === v;
            return `<span class="${on ? 'on' : ''}">${pill(v, store.color(f.key, v), { href: hrefWith(params, { [f.key]: on ? null : v }), count: n })}</span>`;
          })
          .join('');
      return `<div class="widget">
        <h3>${esc(f.label)} <span class="muted">${vals.size}</span></h3>
        <div class="tagcloud">${render(items.slice(0, 18))}${
          items.length > 18 ? `<details class="more"><summary>Xem thêm ${items.length - 18}</summary><div class="tagcloud">${render(items.slice(18))}</div></details>` : ''
        }</div>
      </div>`;
    }).join('')}
    ${archivesWidget(all, params, month)}
  </details>`;

  // Màn hình rộng: sidebar luôn mở (nút thu gọn bị ẩn bằng CSS)
  const details = side.querySelector('.side-details');
  const syncWide = () => {
    if (wideMQ.matches) details.open = true;
  };
  wideMQ.addEventListener('change', syncWide);

  const search = side.querySelector('.search');
  const onSearch = debounce(() => {
    q = search.value.trim();
    const p = new URLSearchParams(params);
    if (q) p.set('q', q);
    else p.delete('q');
    p.delete('page');
    history.replaceState(null, '', '#/' + (p.toString() ? '?' + p : ''));
    params.delete('page');
    if (q) params.set('q', q);
    else params.delete('q');
    renderResults();
  }, 200);
  search.addEventListener('input', onSearch);

  /* ---------- kết quả ---------- */
  const results = root.querySelector('.results');
  const countEl = root.querySelector('.result-count');

  function renderResults() {
    const list = filtered();
    countEl.textContent = `${list.length} bài`;
    if (!all.length) {
      results.innerHTML = `<div class="empty">
        <div class="empty-icon" aria-hidden="true">🎧</div>
        <h2>Chưa có bản vietsub nào</h2>
        ${
          app.editing
            ? `<p>Bắt đầu bằng cách dán lời gốc và bản dịch của bạn.</p><a class="btn primary" href="#/new">+ Tạo bài đầu tiên</a>`
            : `<p>Bấm <strong>✎ Biên tập</strong> ở cuối trang và chọn thư mục repo để thêm bài.</p>`
        }
      </div>`;
      return;
    }
    if (!list.length) {
      results.innerHTML = `<div class="empty small"><p>Không có bài nào khớp bộ lọc.</p></div>`;
      return;
    }
    if (tab === 'table') results.innerHTML = tableView(list);
    else if (tab === 'circle') results.innerHTML = circleView(list);
    else if (tab === 'gallery') results.innerHTML = galleryView(list);
    else results.innerHTML = postsView(list);
    if (tab === 'table') bindSort();
    else if (tab !== 'circle' && tab !== 'gallery') bindFeed();
    hydrateMedia(results, store.source);
  }

  const tags = (p, key, max = 99, link = true) =>
    p[key]
      .slice(0, max)
      .map((v) => pill(v, store.color(key, v), link ? { href: tagHref(key, v) } : {}))
      .join('');

  const coverImg = (p, cls = '') =>
    p.cover
      ? `<img class="cover ${cls}" data-media="${esc(p.cover)}" data-v="${esc(p.updatedAt)}" alt="" loading="lazy">`
      : placeholderCover(p);

  const titleHTML = (p) => {
    const t = displayTitle(p);
    return `<span class="t-main">${esc(t.main)}</span>${t.rm ? `<span class="t-sep"> | </span><span class="t-rm">${esc(t.rm)}</span>` : ''}`;
  };

  /* ---------- Posts: hiện cả bài như blog ---------- */
  const lyPrefs = () => ({
    mode: lsGet('vsub-lymode', 'interleave') === 'parallel' ? 'parallel' : 'interleave',
    rm: lsGet('vsub-showrm', true),
    en: lsGet('vsub-showen', true),
  });

  function feedPost(p) {
    const t = displayTitle(p);
    const yt = youtubeId(p.youtube);
    const eyebrow = [p.circle[0], p.event[0], p.release ? p.release.slice(0, 4) : ''].filter(Boolean);
    const info = infoRowsHTML(store, p);
    const href = `#/post/${esc(p.id)}`;
    return `<article class="fpost pa" style="${accentStyle(p)}">
      <header class="post-hero compact">
        <div class="hero-bg" aria-hidden="true">${p.cover ? `<img data-media="${esc(p.cover)}" data-v="${esc(p.updatedAt)}" alt="" loading="lazy">` : ''}</div>
        <div class="hero-inner">
          <a class="hero-cover" href="${href}" tabindex="-1" aria-hidden="true">${coverImg(p)}</a>
          <div class="hero-text">
            ${eyebrow.length ? `<div class="eyebrow">${eyebrow.map(esc).join(' · ')}</div>` : ''}
            <h2 class="post-title"><a href="${href}">${titleHTML(p)}</a></h2>
            ${t.vi ? `<p class="post-vi">${esc(t.vi)}</p>` : ''}
            <div class="hero-tags">${tags(p, 'circle')}${tags(p, 'source')}</div>
            <div class="fmeta muted small">Đăng ${fmtDate(p.createdAt)} · <a href="${href}">Mở bài riêng →</a>${editable ? ` · <a href="#/edit/${esc(p.id)}">✎ Sửa</a>` : ''}</div>
          </div>
        </div>
      </header>
      <div class="post-body">
        ${info.length ? `<section class="block"><h3 class="block-h">Info</h3><div class="props">${info.join('')}</div></section>` : ''}
        ${
          yt
            ? `<section class="block"><h3 class="block-h">Audio</h3><button type="button" class="yt yt-facade" data-yt="${yt}" aria-label="Phát ${esc(plainTitle(p))} trên YouTube"><img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play" aria-hidden="true">▶</span></button></section>`
            : ''
        }
        <section class="block lyrics-block"><h3 class="block-h">Lyrics</h3><div class="lyrics" data-id="${esc(p.id)}"></div></section>
        ${p.other.trim() ? `<section class="block callout"><h3 class="block-h">Other</h3><div class="md">${markdown(p.other)}</div></section>` : ''}
        ${p.comment.trim() ? `<section class="block callout"><h3 class="block-h">Comment</h3><div class="md">${markdown(p.comment)}</div></section>` : ''}
      </div>
    </article>`;
  }

  function postsView(list) {
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    const page = Math.min(pages, Math.max(1, +params.get('page') || 1));
    const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const pr = lyPrefs();
    const controls = `<div class="feed-controls ly-controls">
      <span class="muted small">Hiển thị lời:</span>
      <div class="seg" role="group" aria-label="Chế độ hiển thị lời">${[
        ['interleave', 'Xen kẽ'],
        ['parallel', 'Song song'],
      ]
        .map(([k, l]) => `<button type="button" data-mode="${k}" aria-pressed="${pr.mode === k}">${l}</button>`)
        .join('')}</div>
      <label class="switch"><input type="checkbox" class="lang-toggle" data-lang="rm"${pr.rm ? ' checked' : ''}> Romaji</label>
      <label class="switch"><input type="checkbox" class="lang-toggle" data-lang="en"${pr.en ? ' checked' : ''}> English</label>
    </div>`;
    const cards = slice.map(feedPost).join('');
    const nav =
      pages > 1
        ? `<nav class="pager">
          ${page > 1 ? `<a class="btn" href="${hrefWith(params, { page: page - 1 })}">← Trang trước</a>` : '<span></span>'}
          <span class="muted">Trang ${page}/${pages}</span>
          ${page < pages ? `<a class="btn" href="${hrefWith(params, { page: page + 1 })}">Trang sau →</a>` : '<span></span>'}
        </nav>`
        : '';
    return `${controls}<div class="feed">${cards}</div>${nav}`;
  }

  function renderFeedLyrics() {
    const pr = lyPrefs();
    results.querySelectorAll('.feed-controls [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === pr.mode)));
    results.querySelectorAll('.feed .lyrics[data-id]').forEach((box) => {
      const p = store.get(box.dataset.id);
      if (!p || !hasLyrics(p.lyrics)) {
        box.innerHTML = '<p class="muted">Chưa có lời.</p>';
        return;
      }
      const enOnly = !p.lyrics.jp.trim();
      const keys = LANGS.map((l) => l.key).filter((k) => (k === 'rm' ? pr.rm : k === 'en' ? pr.en || enOnly : true));
      box.className = `lyrics mode-${pr.mode}`;
      box.innerHTML = pr.mode === 'parallel' ? renderParallel(p.lyrics, keys) : renderInterleave(p.lyrics, keys);
    });
  }

  function bindFeed() {
    renderFeedLyrics();
    results.querySelectorAll('.feed-controls [data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        lsSet('vsub-lymode', b.dataset.mode);
        renderFeedLyrics();
      }),
    );
    results.querySelectorAll('.feed-controls .lang-toggle').forEach((t) =>
      t.addEventListener('change', () => {
        lsSet(t.dataset.lang === 'rm' ? 'vsub-showrm' : 'vsub-showen', t.checked);
        renderFeedLyrics();
      }),
    );
    results.querySelectorAll('.yt-facade').forEach((b) =>
      b.addEventListener('click', () => {
        b.replaceWith(
          el(
            `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`,
          ),
        );
      }),
    );
  }

  const sortState = () => {
    const [col, dir] = (params.get('sort') || 'createdAt:desc').split(':');
    return { col, dir: dir === 'asc' ? 'asc' : 'desc' };
  };
  const sortKey = (p, col) => {
    if (col === 'title') return displayTitle(p).main;
    if (col === 'release' || col === 'createdAt') return p[col] || '';
    return (p[col] || []).join(', ');
  };
  function sorted(list) {
    const { col, dir } = sortState();
    const s = [...list].sort((a, b) => sortKey(a, col).localeCompare(sortKey(b, col), 'ja'));
    return dir === 'desc' ? s.reverse() : s;
  }

  function cell(p, col) {
    const ed = editable ? ` data-col="${col}" tabindex="0"` : '';
    if (col === 'title')
      return `<td class="td-title"${ed}><div><span class="dot" aria-hidden="true"></span><a href="#/post/${esc(p.id)}">${esc(displayTitle(p).main)}</a></div>${p.titleVI && (p.titleJP || p.titleRM) ? `<div class="small">${esc(p.titleVI)}</div>` : ''}</td>`;
    if (col === 'release' || col === 'createdAt') return `<td class="nowrap"${ed}>${fmtDate(p[col])}</td>`;
    return `<td${ed}><div class="td-tags">${tags(p, col, 99, !editable)}</div></td>`;
  }

  const rowHTML = (p, cols) => `<tr class="pa" style="${accentStyle(p)}" data-id="${esc(p.id)}">${cols.map((c) => cell(p, c.key)).join('')}</tr>`;

  function tableView(list, cols = TABLE_COLS, sortable = true) {
    const { col, dir } = sortState();
    const head = cols
      .map((c) =>
        sortable
          ? `<th><button class="th-sort${c.key === col ? ' on' : ''}" data-col="${c.key}">${esc(c.label)}${c.key === col ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>`
          : `<th>${esc(c.label)}</th>`,
      )
      .join('');
    const rows = (sortable ? sorted(list) : list).map((p) => rowHTML(p, cols)).join('');
    const hint = editable && sortable ? `<p class="table-hint muted small">✎ Bấm vào một ô để sửa nhanh. Release và Event được đồng bộ cho các bài cùng album.</p>` : '';
    return `${hint}<div class="table-wrap"><table class="ntable${editable ? ' editable' : ''}" data-cols="${cols.map((c) => c.key).join(',')}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- sửa nhanh trong bảng ---------- */
  const COL_LABEL = Object.fromEntries(TABLE_COLS.map((c) => [c.key, c.label]));
  let pop = null;
  let queue = Promise.resolve();

  function closePop() {
    if (!pop) return;
    document.removeEventListener('mousedown', pop.outside, true);
    window.removeEventListener('resize', pop.onResize);
    pop.box.remove();
    pop = null;
  }

  function openCellEditor(td) {
    closePop();
    const id = td.parentElement.dataset.id;
    const col = td.dataset.col;
    const p = store.get(id);
    if (!p) return;
    const box = el(`<div class="cell-pop pa" style="${accentStyle(p)}" role="dialog" aria-label="Sửa ${esc(COL_LABEL[col] || col)}"></div>`);
    const colors = [];
    let getValue;
    let focusEl;
    const f = FIELD_BY_KEY[col];
    if (f) {
      const ts = new TagSelect({
        label: f.label,
        options: store.suggestions(col),
        value: p[col],
        single: f.single,
        colorOf: (v) => store.color(col, v),
        onColor: (v, c) => colors.push([v, c]),
      });
      box.appendChild(el(`<div class="cell-pop-h">${esc(f.label)}</div>`));
      box.appendChild(ts.root);
      getValue = () => ts.getValue();
      focusEl = ts.input;
    } else if (col === 'release' || col === 'createdAt') {
      box.innerHTML = `<label class="field"><span>${esc(COL_LABEL[col])}</span><input class="input" type="date" value="${esc((p[col] || '').slice(0, 10))}"></label>`;
      const inp = box.querySelector('input');
      getValue = () => inp.value;
      focusEl = inp;
    } else if (col === 'title') {
      box.innerHTML = [
        ['titleJP', 'Tiêu đề gốc (JP)'],
        ['titleRM', 'Romaji'],
        ['titleVI', 'Tiêu đề tiếng Việt'],
      ]
        .map(([k, l]) => `<label class="field"><span>${l}</span><input class="input" name="${k}" value="${esc(p[k])}" autocomplete="off"></label>`)
        .join('');
      getValue = () => Object.fromEntries([...box.querySelectorAll('input')].map((i) => [i.name, i.value.trim()]));
      focusEl = box.querySelector('input');
    } else return;
    box.appendChild(el(`<div class="cell-pop-foot muted small"><span>Bấm ra ngoài, Esc hoặc Enter để lưu</span><button type="button" class="btn small-btn" data-cancel>Huỷ</button></div>`));
    document.body.appendChild(box);

    const r = td.getBoundingClientRect();
    const w = Math.min(Math.max(r.width, 300), innerWidth - 16);
    box.style.width = w + 'px';
    box.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + scrollX + 'px';
    box.style.top = r.top + scrollY + 'px';

    const commit = () => {
      const value = getValue();
      closePop();
      queue = queue.then(() => saveCell(id, col, value, colors));
    };
    const outside = (e) => {
      if (!box.contains(e.target)) commit();
    };
    // capture: xử lý trước TagSelect (Enter khi ô gõ trống = lưu, còn chữ = thêm tag)
    box.addEventListener(
      'keydown',
      (e) => {
        const isTagInput = e.target.matches('.ts-input');
        if (e.key === 'Escape' || (e.key === 'Enter' && (!isTagInput || !e.target.value.trim()))) {
          e.preventDefault();
          e.stopPropagation();
          commit();
          td.focus();
        }
      },
      true,
    );
    box.querySelector('[data-cancel]').addEventListener('click', () => {
      closePop();
      td.focus();
    });
    document.addEventListener('mousedown', outside, true);
    const onResize = () => closePop();
    window.addEventListener('resize', onResize);
    pop = { box, outside, onResize };
    focusEl?.focus();
  }

  async function saveCell(id, col, value, colors) {
    const cur = store.get(id);
    if (!cur) return;
    const next = { ...cur };
    if (col === 'title') {
      if (!value.titleJP && !value.titleRM && !value.titleVI) {
        toast('Cần ít nhất một tiêu đề.', 'error');
        return;
      }
      Object.assign(next, value);
    } else if (col === 'createdAt') {
      if (!value) return;
      next.createdAt = value + (cur.createdAt || '').slice(10);
    } else next[col] = value;
    const keys = col === 'title' ? ['titleJP', 'titleRM', 'titleVI'] : [col];
    const changed = keys.some((k) => JSON.stringify(next[k]) !== JSON.stringify(cur[k]));
    if (!changed && !colors.length) return;
    try {
      for (const [v, c] of colors) (store.meta.colors[col] ||= {})[v] = c;
      const saved = await store.save(next, { colorsChanged: colors.length > 0 });
      const synced = await store.syncAlbum(saved, cur);
      all = store.list();
      refreshRows([saved.id, ...synced.map((q) => q.id)]);
      const others = new Set(synced.map((q) => q.id).filter((x) => x !== saved.id)).size;
      toast(others ? `Đã lưu · đồng bộ Release/Event cho ${others} bài cùng album.` : 'Đã lưu.', 'ok');
    } catch (e) {
      console.error(e);
      toast(`Lưu thất bại: ${e.message}`, 'error', 6000);
    }
  }

  function refreshRows(ids) {
    for (const id of new Set(ids)) {
      const p = store.get(id);
      if (!p) continue;
      results.querySelectorAll(`tr[data-id="${CSS.escape(id)}"]`).forEach((tr) => {
        const cols = tr.closest('table').dataset.cols.split(',').map((k) => TABLE_COLS.find((c) => c.key === k));
        const fresh = el(`<table><tbody>${rowHTML(p, cols)}</tbody></table>`).querySelector('tr');
        tr.replaceWith(fresh);
        fresh.classList.add('flash');
      });
    }
  }

  if (editable) {
    results.addEventListener('click', (e) => {
      const td = e.target.closest('td[data-col]');
      if (!td || e.target.closest('a')) return;
      openCellEditor(td);
    });
    results.addEventListener('keydown', (e) => {
      const td = e.target.closest?.('td[data-col]');
      if (td && e.target === td && e.key === 'Enter') {
        e.preventDefault();
        openCellEditor(td);
      }
    });
  }

  function bindSort() {
    results.querySelectorAll('.th-sort').forEach((b) =>
      b.addEventListener('click', () => {
        const { col, dir } = sortState();
        const next = b.dataset.col === col ? (dir === 'asc' ? 'desc' : 'asc') : b.dataset.col === 'title' ? 'asc' : 'desc';
        app.navigate(hrefWith(params, { sort: `${b.dataset.col}:${next}` }));
      }),
    );
  }

  function circleView(list) {
    const groups = new Map();
    for (const p of list) {
      const keys = p.circle.length ? p.circle : ['—'];
      for (const c of keys) {
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c).push(p);
      }
    }
    const cols = TABLE_COLS.filter((c) => ['title', 'album', 'release', 'vocals', 'originalTitle', 'source'].includes(c.key));
    return [...groups.entries()]
      .sort((a, b) => (a[0] === '—' ? 1 : b[0] === '—' ? -1 : a[0].localeCompare(b[0], 'ja')))
      .map(
        ([c, ps]) => `<details class="group" open>
          <summary>${c === '—' ? '<span class="tag c-default">Không có circle</span>' : pill(c, store.color('circle', c))}<span class="muted">${ps.length}</span></summary>
          ${tableView(ps, cols, false)}
        </details>`,
      )
      .join('');
  }

  function galleryView(list) {
    return `<div class="gallery">${list
      .map(
        (p) => `<a class="gcard pa" style="${accentStyle(p)}" href="#/post/${esc(p.id)}">
          <div class="gcover">${coverImg(p)}</div>
          <div class="gtitle">${esc(displayTitle(p).main)}</div>
          ${p.titleVI && (p.titleJP || p.titleRM) ? `<div class="gsub muted">${esc(p.titleVI)}</div>` : ''}
        </a>`,
      )
      .join('')}</div>`;
  }

  renderResults();
  return {
    el: root,
    title: '',
    destroy: () => {
      wideMQ.removeEventListener('change', syncWide);
      closePop();
    },
  };
}

function archivesWidget(all, params, month) {
  if (!all.length) return '';
  const years = new Map();
  for (const p of all) {
    const ym = (p.createdAt || '').slice(0, 7);
    if (!ym) continue;
    const y = ym.slice(0, 4);
    if (!years.has(y)) years.set(y, new Map());
    const m = years.get(y);
    m.set(ym, (m.get(ym) || 0) + 1);
  }
  const ys = [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return `<div class="widget">
    <h3>Lưu trữ</h3>
    <ul class="archives">${ys
      .map(([y, ms]) => {
        const total = [...ms.values()].reduce((a, b) => a + b, 0);
        return `<li><details${month.startsWith(y) || ys[0][0] === y ? ' open' : ''}><summary>${y} <span class="muted">(${total})</span></summary><ul>${[...ms.entries()]
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(
            ([ym, n]) =>
              `<li><a class="${ym === month ? 'on' : ''}" href="${hrefWith(params, { month: ym === month ? null : ym })}">Tháng ${+ym.slice(5)} <span class="muted">(${n})</span></a></li>`,
          )
          .join('')}</ul></details></li>`;
      })
      .join('')}</ul>
  </div>`;
}
