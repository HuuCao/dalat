import { h } from '../lib/dom.js';

// Offered when a newer schedule arrived after people started reading
// (controllers/plan.js), instead of reloading under them.
export function createUpdateToast() {
  const reload = h('button', { class: 'update-toast-reload', type: 'button' }, 'Tải lại');
  const close = h('button', { class: 'update-toast-close', type: 'button', 'aria-label': 'Đóng' }, '✕');
  const element = h('div', { class: 'update-toast', role: 'status', hidden: true },
    h('span', { class: 'update-toast-text', text: '🔄 Lịch trình vừa thay đổi' }), reload, close);

  reload.addEventListener('click', () => window.location.reload());
  close.addEventListener('click', () => { element.hidden = true; });

  return {
    element,
    show() {
      element.hidden = false;
    },
  };
}
