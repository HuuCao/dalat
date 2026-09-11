export const FALLBACK_CLASS = 'no-scroll-timeline';

// The inline script in <head> adds FALLBACK_CLASS when CSS scroll-driven
// animation is unsupported.
export function hasScrollTimeline() {
  return !document.documentElement.classList.contains(FALLBACK_CLASS);
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));
// 4 decimals keeps style strings short; `+ 0` turns -0 into 0.
const round = (value) => Math.round(value * 1e4) / 1e4 + 0;

// Mirrors @keyframes hero-parallax. The image never uncovers an edge while
// scale × |translateY| ≤ (scale − 1) / 2.
export function heroParallax(progress) {
  return { scale: round(1.3 - 0.18 * progress), translate: round(-5 + 10 * progress) };
}

// Fallback for css/motion/scroll-timeline.css: same ranges, same numbers.
// Change both together.
export function scrollFx(y, viewportHeight, scrollHeight) {
  const page = clamp01(y / Math.max(1, scrollHeight - viewportHeight));
  const drift = clamp01(y / 480);
  const lift = clamp01((y - 40) / 320);
  const fling = clamp01(y / 300);
  const { scale, translate } = heroParallax(drift);

  return {
    bar: { transform: `scaleX(${round(page)})` },
    bg: { transform: `scale(${scale}) translateY(${translate}%)` },
    inner: {
      opacity: String(round(1 - lift)),
      transform: `translateY(${round(-48 * lift)}px) scale(${round(1 - 0.08 * lift)})`,
    },
    thumbs: {
      opacity: String(round(1 - fling)),
      transform: `translate3d(${round(60 * fling)}px, ${round(-20 * fling)}px, 0) rotate(${round(7 * fling)}deg)`,
    },
  };
}
