// Thùng rác
import { esc, el, fmtDate, plainTitle } from '../util.js';
import { confirmBox, toast } from '../ui.js';

export function trashView(ctx) {
  const { store, app } = ctx;
  if (!app.editing) {
    return { el: el(`<div class="empty"><h2>Cần bật chế độ biên tập</h2><a class="btn" href="#/">← Về trang chủ</a></div>`), title: 'Thùng rác' };
  }
  const root = el(`<section class="trash">
    <div class="block-head"><h1>🗑 Thùng rác</h1><button class="btn danger-ghost empty-all" type="button">Dọn sạch</button></div>
    <p class="muted small">Bài trong thùng rác bị ẩn khỏi trang. Xoá vĩnh viễn sẽ xoá cả file bài, ảnh bìa và file nhạc.</p>
    <div class="trash-list"></div>
  </section>`);
  const listEl = root.querySelector('.trash-list');
  const emptyAll = root.querySelector('.empty-all');

  function render() {
    const list = store.list({ trashed: true }).sort((a, b) => (b.trashedAt || '').localeCompare(a.trashedAt || ''));
    emptyAll.hidden = !list.length;
    listEl.innerHTML = list.length
      ? `<ul class="tlist">${list
          .map(
            (p) => `<li>
          <div><a href="#/post/${esc(p.id)}">${esc(plainTitle(p))}</a><div class="muted small">Xoá ngày ${fmtDate(p.trashedAt)}</div></div>
          <div class="tl-actions"><button class="btn" data-restore="${esc(p.id)}">↺ Khôi phục</button><button class="btn danger-ghost" data-destroy="${esc(p.id)}">Xoá vĩnh viễn</button></div>
        </li>`,
          )
          .join('')}</ul>`
      : '<div class="empty small"><p>Thùng rác trống.</p></div>';
  }

  listEl.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-restore]');
    const d = e.target.closest('[data-destroy]');
    try {
      if (r) {
        await store.restore(r.dataset.restore);
        toast('Đã khôi phục bài.', 'ok');
        render();
      } else if (d) {
        const p = store.get(d.dataset.destroy);
        if (!(await confirmBox('Xoá vĩnh viễn?', `Bài “${esc(plainTitle(p))}” cùng ảnh bìa và file nhạc sẽ bị xoá khỏi thư mục. <strong>Không thể hoàn tác</strong> (trừ khi bạn khôi phục bằng git).`, { okLabel: 'Xoá vĩnh viễn', danger: true }))) return;
        await store.destroy(p.id);
        toast('Đã xoá vĩnh viễn.', 'ok');
        render();
      }
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
  });
  emptyAll.addEventListener('click', async () => {
    const list = store.list({ trashed: true });
    if (!(await confirmBox('Dọn sạch thùng rác?', `${list.length} bài sẽ bị xoá vĩnh viễn khỏi thư mục. <strong>Không thể hoàn tác.</strong>`, { okLabel: 'Xoá tất cả', danger: true }))) return;
    try {
      for (const p of list) await store.destroy(p.id);
      toast('Đã dọn sạch thùng rác.', 'ok');
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
    render();
  });
  render();
  return { el: root, title: 'Thùng rác' };
}
