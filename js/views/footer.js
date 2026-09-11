import { h } from '../lib/dom.js';

export function renderFooter(footer) {
  return h('footer', { class: 'footer' },
    footer.title,
    footer.note ? [h('br'), h('small', { text: footer.note })] : null);
}
