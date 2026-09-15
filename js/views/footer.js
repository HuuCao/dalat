import { h } from '../lib/dom.js';
import { clockText } from '../lib/time.js';

export function renderFooter(footer, stamp = null) {
  return h('footer', { class: 'footer' },
    footer.title,
    footer.note ? [h('br'), h('small', { text: footer.note })] : null,
    stamp ? [h('br'), stamp] : null);
}

// "Lịch trình cập nhật 14:05": when the sheet copy on screen was fetched.
export function createPlanStamp(fetchedAt) {
  const element = h('small', { class: 'footer-stamp' });
  const set = (ms) => {
    element.textContent = `Lịch trình cập nhật ${clockText(ms)}`;
  };
  set(fetchedAt);
  return { element, set };
}
