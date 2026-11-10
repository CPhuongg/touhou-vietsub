// Trang chủ: 4 kiểu xem + sidebar lọc
import { TAG_FIELDS, FIELD_BY_KEY, esc, el, fmtDate, displayTitle, debounce, lsGet, lsSet, placeholderCover, accentStyle } from '../util.js';
import { pill, hydrateMedia } from '../ui.js';

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
  const all = store.list();

  const nCircle = store.values('circle').size;
  const nVocal = store.values('vocals').size;
  const root = el(`<div>
  <section class="home-hero">
    <h1>Vietsub nhạc <span class="grad">Touhou</span></h1>
    <p>Lời gốc, romaji và bản dịch tiếng Việt cho các bài hát doujin Touhou Project.</p>
    ${all.length ? `<div class="stats"><span class="stat"><strong>${all.length}</strong> bài</span><span class="stat"><strong>${nCircle}</strong> circle</span><span class="stat"><strong>${nVocal}</strong> vocal</span></div>` : ''}
  </section>
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
    hydrateMedia(results, store.source);
  }

  const tags = (p, key, max = 99) =>
    p[key]
      .slice(0, max)
      .map((v) => pill(v, store.color(key, v), { href: tagHref(key, v) }))
      .join('');

  const coverImg = (p, cls = '') =>
    p.cover
      ? `<img class="cover ${cls}" data-media="${esc(p.cover)}" data-v="${esc(p.updatedAt)}" alt="" loading="lazy">`
      : placeholderCover(p);

  const titleHTML = (p) => {
    const t = displayTitle(p);
    return `<span class="t-main">${esc(t.main)}</span>${t.rm ? `<span class="t-sep"> | </span><span class="t-rm">${esc(t.rm)}</span>` : ''}`;
  };

  function postsView(list) {
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    const page = Math.min(pages, Math.max(1, +params.get('page') || 1));
    const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const cards = slice
      .map((p) => {
        const t = displayTitle(p);
        return `<article class="card pa" style="${accentStyle(p)}">
          <a class="card-cover" href="#/post/${esc(p.id)}" tabindex="-1" aria-hidden="true">${coverImg(p)}</a>
          <div class="card-body">
            <h2 class="card-title"><a href="#/post/${esc(p.id)}">${titleHTML(p)}</a></h2>
            ${t.vi ? `<p class="card-vi">${esc(t.vi)}</p>` : ''}
            <div class="card-tags">${tags(p, 'circle')}${tags(p, 'source')}${tags(p, 'vocals', 2)}</div>
            <div class="card-meta muted"><span class="dot" aria-hidden="true"></span>${p.album.length ? esc(p.album.join(', ')) + ' · ' : ''}${fmtDate(p.createdAt)}</div>
          </div>
        </article>`;
      })
      .join('');
    const nav =
      pages > 1
        ? `<nav class="pager">
          ${page > 1 ? `<a class="btn" href="${hrefWith(params, { page: page - 1 })}">← Trang trước</a>` : '<span></span>'}
          <span class="muted">Trang ${page}/${pages}</span>
          ${page < pages ? `<a class="btn" href="${hrefWith(params, { page: page + 1 })}">Trang sau →</a>` : '<span></span>'}
        </nav>`
        : '';
    return `<div class="cards">${cards}</div>${nav}`;
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
    if (col === 'title')
      return `<td class="td-title"><div><span class="dot" aria-hidden="true"></span><a href="#/post/${esc(p.id)}">${esc(displayTitle(p).main)}</a></div>${p.titleVI && (p.titleJP || p.titleRM) ? `<div class="small">${esc(p.titleVI)}</div>` : ''}</td>`;
    if (col === 'release' || col === 'createdAt') return `<td class="nowrap">${fmtDate(p[col])}</td>`;
    return `<td><div class="td-tags">${tags(p, col)}</div></td>`;
  }

  function tableView(list, cols = TABLE_COLS, sortable = true) {
    const { col, dir } = sortState();
    const head = cols
      .map((c) =>
        sortable
          ? `<th><button class="th-sort${c.key === col ? ' on' : ''}" data-col="${c.key}">${esc(c.label)}${c.key === col ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>`
          : `<th>${esc(c.label)}</th>`,
      )
      .join('');
    const rows = (sortable ? sorted(list) : list).map((p) => `<tr class="pa" style="${accentStyle(p)}">${cols.map((c) => cell(p, c.key)).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="ntable"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
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
  return { el: root, title: '', destroy: () => wideMQ.removeEventListener('change', syncWide) };
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
