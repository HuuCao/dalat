import { hasScrollTimeline } from '../lib/motion.js';

const TARGETS = '.day-head, .item';

// Layer B reveal. Call in the same task as rendering: marking elements
// .reveal after a paint would flash them visible, then hide them.
export function startReveal(root) {
  if (hasScrollTimeline()) return;

  const targets = [...root.querySelectorAll(TARGETS)];
  for (const el of targets) el.classList.add('reveal');

  if (!('IntersectionObserver' in window)) {
    for (const el of targets) el.classList.add('in');
    return;
  }

  // Panels hidden by a tab never intersect, so their entries reveal when
  // that tab is opened.
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      observer.unobserve(entry.target); // one-way: never hide again
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  for (const el of targets) observer.observe(el);
}
