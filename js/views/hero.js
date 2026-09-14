import { h } from '../lib/dom.js';

export function renderHero(hero) {
  return h('header', { class: 'hero' },
    hero.image
      ? renderImage('hero-bg', hero.image, { sizes: '130vw', fetchpriority: 'high' })
      : h('div', { class: 'hero-bg' }),
    h('div', { class: 'hero-overlay' }),
    h('div', { class: 'hero-inner wrap' },
      h('div', { class: 'eyebrow', text: hero.eyebrow }),
      h('h1', { text: hero.title }),
      h('div', { class: 'subtitle', text: hero.subtitle }),
      h('div', { class: 'chips' }, hero.chips.map((chip) => h('span', { class: 'chip', text: chip })))),
    hero.thumbs.length > 0
      ? h('div', { class: 'hero-thumbs' },
        hero.thumbs.map((thumb) => renderImage('thumb', thumb, { sizes: '92px', loading: 'lazy' })))
      : null);
}

// Attribute order matters: loading, sizes and srcset go before src, or the
// browser may start fetching the largest file first. `130vw` on the hero
// covers the 1.3× parallax zoom.
function renderImage(className, image, { sizes, loading, fetchpriority }) {
  return h('img', {
    class: className,
    alt: '',
    decoding: 'async',
    loading,
    fetchpriority,
    sizes,
    srcset: image.srcset,
    src: image.src,
  });
}
