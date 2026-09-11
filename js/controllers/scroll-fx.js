import { hasScrollTimeline, prefersReducedMotion, scrollFx } from '../lib/motion.js';

// Layer B parallax and progress bar. Inline styles ignore
// @media (prefers-reduced-motion), so the check has to happen here.
export function startScrollFx(targets) {
  if (hasScrollTimeline() || prefersReducedMotion()) return;

  const root = document.documentElement;
  let queued = false;

  function frame() {
    queued = false;
    const styles = scrollFx(window.scrollY, window.innerHeight, root.scrollHeight);
    for (const [name, style] of Object.entries(styles)) {
      if (targets[name]) Object.assign(targets[name].style, style);
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  frame();
}
