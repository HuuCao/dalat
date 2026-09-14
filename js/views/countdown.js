import { h } from '../lib/dom.js';

// Constant artwork, not data, so building it from a string is safe.
const HOURGLASS_SVG = `<svg class="hourglass" viewBox="0 0 24 24" aria-hidden="true">
  <defs>
    <clipPath id="hgTop"><path d="M6.6 4h10.8L12 11.6z" /></clipPath>
    <clipPath id="hgBot"><path d="M12 12.4 17.4 20H6.6z" /></clipPath>
  </defs>
  <rect class="hg-sand hg-sand-top" clip-path="url(#hgTop)" x="6.6" y="4" width="10.8" height="7.6" />
  <rect class="hg-sand hg-sand-bot" clip-path="url(#hgBot)" x="6.6" y="12.4" width="10.8" height="7.6" />
  <rect class="hg-stream" x="11.65" y="11" width=".7" height="3" />
  <path class="hg-frame" d="M5.4 3h13.2M5.4 21h13.2M6.8 3.4v3.3c0 1 .4 1.9 1.1 2.6L12 12l-4.1 2.7c-.7.7-1.1 1.6-1.1 2.6v3.3M17.2 3.4v3.3c0 1-.4 1.9-1.1 2.6L12 12l4.1 2.7c.7.7 1.1 1.6 1.1 2.6v3.3" />
</svg>`;

function renderHourglass() {
  const template = document.createElement('template');
  template.innerHTML = HOURGLASS_SVG;
  return template.content.firstElementChild;
}

export function createCountdown() {
  const label = h('span', { class: 'cd-label-text' });
  const progress = h('span', { class: 'cd-progress' });
  const headline = h('div', { class: 'cd-headline' });
  const map = h('a', { class: 'cd-map', target: '_blank', rel: 'noopener noreferrer', hidden: true }, '📍 Maps');
  const headlineRow = h('div', { class: 'cd-headline-row' }, headline, map);
  const note = h('div', { class: 'cd-note' });
  const next = h('div', { class: 'cd-next', hidden: true });
  const clock = h('div', { class: 'cd-clock' });

  // Order of importance: what is happening, how long, what comes next.
  const element = h('section', { class: 'countdown', 'aria-label': 'Trạng thái chuyến đi' },
    h('div', { class: 'cd-glow', 'aria-hidden': 'true' }),
    renderHourglass(),
    h('div', { class: 'cd-body' },
      h('div', { class: 'cd-label' }, h('span', { class: 'pulse' }), label, progress),
      headlineRow,
      note),
    clock,
    next);

  function update(description, phase) {
    label.textContent = description.label;
    progress.textContent = description.progress ?? '';
    headline.textContent = description.headline ?? '';
    headlineRow.hidden = !description.headline;
    map.hidden = !description.mapUrl;
    if (description.mapUrl) map.href = description.mapUrl;
    note.textContent = description.note;
    next.textContent = description.next ?? '';
    next.hidden = !description.next;
    clock.hidden = !description.tiles;
    clock.replaceChildren(...(description.tiles ?? []).map(renderTile));
    element.classList.toggle('soon', phase === 'soon');
    element.classList.toggle('live', phase === 'live');
  }

  return { element, update };
}

function renderTile(tile, index, tiles) {
  const isLast = index === tiles.length - 1;
  return h('span', { class: isLast ? 'cd-unit sec' : 'cd-unit' },
    h('b', { text: tile.value }),
    h('i', { text: tile.unit }));
}
