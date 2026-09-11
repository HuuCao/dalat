import { h } from '../lib/dom.js';

export function renderError(message) {
  return h('div', { class: 'load-error', role: 'alert' },
    h('strong', { text: 'Không tải được lịch trình' }),
    h('p', { text: message }));
}
