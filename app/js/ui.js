// Thành phần giao diện dùng chung
import { esc, el, COLORS } from './util.js';

/* ---------- Toast ---------- */
export function toast(msg, type = 'info', ms = 3200) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('<div id="toasts" role="status" aria-live="polite"></div>');
    document.body.appendChild(box);
  }
  const t = el(`<div class="toast toast-${type}">${esc(msg)}</div>`);
  box.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/* ---------- Modal ---------- */
/**
 * modal({ title, body: string|Node, actions:[{label, value, primary, danger}] }) → Promise<value|null>
 */
export function modal({ title, body, actions = [{ label: 'Đóng', value: null }], wide = false }) {
  return new Promise((resolve) => {
    const dlg = el(`<dialog class="modal${wide ? ' wide' : ''}">
      <form method="dialog">
        <header><h2>${esc(title)}</h2><button type="button" class="icon-btn modal-x" aria-label="Đóng">✕</button></header>
        <div class="modal-body"></div>
        <footer></footer>
      </form>
    </dialog>`);
    const bodyEl = dlg.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
    const foot = dlg.querySelector('footer');
    actions.forEach((a, i) => {
      const b = el(`<button class="btn${a.primary ? ' primary' : ''}${a.danger ? ' danger' : ''}" value="a${i}">${esc(a.label)}</button>`);
      foot.appendChild(b);
    });
    let result = null;
    dlg.querySelector('.modal-x').addEventListener('click', () => dlg.close(''));
    dlg.addEventListener('close', () => {
      const v = dlg.returnValue;
      if (v && v.startsWith('a')) result = actions[+v.slice(1)].value;
      dlg.remove();
      resolve(result);
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    const primary = foot.querySelector('.primary');
    if (primary) primary.focus();
  });
}

export function confirmBox(title, message, { okLabel = 'Đồng ý', danger = false } = {}) {
  return modal({
    title,
    body: `<p>${message}</p>`,
    actions: [
      { label: 'Huỷ', value: false },
      { label: okLabel, value: true, primary: !danger, danger },
    ],
  }).then((v) => v === true);
}

/* ---------- Tag pill ---------- */
export function pill(value, color, { href, count } = {}) {
  const inner = `${esc(value)}${count != null ? `<span class="count">${count}</span>` : ''}`;
  return href
    ? `<a class="tag c-${color}" href="${esc(href)}">${inner}</a>`
    : `<span class="tag c-${color}">${inner}</span>`;
}

/* ---------- Ảnh / media nạp bất đồng bộ ---------- */
export async function hydrateMedia(root, source) {
  const nodes = root.querySelectorAll('[data-media]');
  await Promise.all(
    [...nodes].map(async (n) => {
      const url = await source.mediaURL(n.dataset.media, n.dataset.v);
      if (!url) {
        n.classList.add('missing');
        return;
      }
      n.src = url;
    }),
  );
}

/* ---------- TagSelect: multi-select có gợi ý (kiểu Notion) ---------- */
export class TagSelect {
  /**
   * @param {{ label:string, options:string[], value:string[], single?:boolean, colorOf:(v)=>string, onColor?:(v,c)=>void, placeholder?:string }} o
   */
  constructor(o) {
    this.o = o;
    this.value = [...(o.value || [])];
    this.options = [...new Set(o.options || [])];
    this.localColors = {};
    this.active = 0;
    this.root = el(`<div class="tagselect">
      <div class="ts-box">
        <span class="ts-pills"></span>
        <input class="ts-input" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(o.placeholder || 'Gõ để tìm hoặc thêm…')}" aria-label="${esc(o.label)}">
      </div>
      <div class="ts-menu" role="listbox" hidden></div>
    </div>`);
    this.input = this.root.querySelector('.ts-input');
    this.menu = this.root.querySelector('.ts-menu');
    this.pills = this.root.querySelector('.ts-pills');
    this.bind();
    this.renderPills();
  }
  colorOf(v) {
    return this.localColors[v] || this.o.colorOf(v);
  }
  bind() {
    this.root.querySelector('.ts-box').addEventListener('mousedown', (e) => {
      if (e.target === this.input || e.target.closest('.ts-x')) return;
      e.preventDefault();
      this.input.focus();
    });
    this.input.addEventListener('focus', () => this.openMenu());
    this.input.addEventListener('input', () => {
      this.active = 0;
      this.openMenu();
    });
    this.input.addEventListener('blur', () => setTimeout(() => this.closeMenu(), 120));
    this.input.addEventListener('keydown', (e) => {
      const items = this.menuItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.active = Math.min(items.length - 1, this.active + 1);
        this.renderMenu();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.active = Math.max(0, this.active - 1);
        this.renderMenu();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = items[this.active];
        if (it) this.add(it.value);
      } else if (e.key === 'Backspace' && !this.input.value && this.value.length) {
        this.remove(this.value[this.value.length - 1]);
      } else if (e.key === 'Escape') {
        this.closeMenu();
      }
    });
    this.menu.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const sw = e.target.closest('.ts-swatch');
      if (sw) {
        this.cycleColor(sw.dataset.v);
        return;
      }
      const opt = e.target.closest('.ts-opt');
      if (opt) this.add(opt.dataset.v);
    });
    this.pills.addEventListener('click', (e) => {
      const x = e.target.closest('.ts-x');
      if (x) this.remove(x.dataset.v);
    });
  }
  menuItems() {
    const q = this.input.value.trim();
    const ql = q.toLowerCase();
    const items = this.options
      .filter((v) => !this.value.includes(v) && (!ql || v.toLowerCase().includes(ql)))
      .slice(0, 50)
      .map((v) => ({ value: v, isNew: false }));
    if (q && !this.options.some((v) => v.toLowerCase() === ql) && !this.value.includes(q)) items.push({ value: q, isNew: true });
    return items;
  }
  openMenu() {
    this.menu.hidden = false;
    this.renderMenu();
  }
  closeMenu() {
    this.menu.hidden = true;
  }
  renderMenu() {
    const items = this.menuItems();
    if (!items.length) {
      this.menu.innerHTML = `<div class="ts-empty">${this.input.value ? 'Không có gợi ý' : 'Gõ để thêm giá trị mới'}</div>`;
      return;
    }
    this.menu.innerHTML =
      `<div class="ts-hint">${this.o.single ? 'Chọn 1 giá trị' : 'Chọn hoặc tạo giá trị'}</div>` +
      items
        .map(
          (it, i) => `<div class="ts-opt${i === this.active ? ' active' : ''}" role="option" data-v="${esc(it.value)}">
            ${it.isNew ? '<span class="ts-new">Tạo</span>' : ''}
            <span class="tag c-${this.colorOf(it.value)}">${esc(it.value)}</span>
            ${it.isNew ? '' : `<button type="button" class="ts-swatch" data-v="${esc(it.value)}" title="Đổi màu" aria-label="Đổi màu ${esc(it.value)}">◐</button>`}
          </div>`,
        )
        .join('');
    this.menu.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }
  renderPills() {
    this.pills.innerHTML = this.value
      .map(
        (v) =>
          `<span class="tag c-${this.colorOf(v)}">${esc(v)}<button type="button" class="ts-x" data-v="${esc(v)}" aria-label="Bỏ ${esc(v)}">×</button></span>`,
      )
      .join('');
    this.input.placeholder = this.value.length ? '' : this.o.placeholder || 'Gõ để tìm hoặc thêm…';
  }
  add(v) {
    v = v.trim();
    if (!v) return;
    if (this.o.single) this.value = [v];
    else if (!this.value.includes(v)) this.value.push(v);
    if (!this.options.includes(v)) this.options.push(v);
    this.input.value = '';
    this.active = 0;
    this.renderPills();
    if (this.o.single) this.closeMenu();
    else this.renderMenu();
    this.changed();
  }
  remove(v) {
    this.value = this.value.filter((x) => x !== v);
    this.renderPills();
    this.changed();
  }
  cycleColor(v) {
    const cur = this.colorOf(v);
    const next = COLORS[(COLORS.indexOf(cur) + 1) % COLORS.length];
    this.localColors[v] = next;
    this.o.onColor?.(v, next);
    this.renderMenu();
    this.renderPills();
  }
  changed() {
    this.root.dispatchEvent(new Event('change', { bubbles: true }));
  }
  getValue() {
    // giá trị đang gõ dở cũng được tính
    const pending = this.input.value.trim();
    if (pending) this.add(pending);
    return [...this.value];
  }
}
