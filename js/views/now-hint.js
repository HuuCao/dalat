import { h } from '../lib/dom.js';

// Offered instead of scrolling when a slot starts while the viewer is busy
// (controllers/status.js); tapping it brings that slot into view.
export function createNowHint() {
  const text = h('span', { class: 'now-hint-text' });
  const element = h('button', { class: 'now-hint', type: 'button', hidden: true },
    h('span', { 'aria-hidden': 'true', text: '📍' }), text);

  return {
    element,
    show(name) {
      text.textContent = `Đang diễn ra: ${name}`;
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    },
  };
}
