const TARGETS = '.day-head, .item';

const byDocumentOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

// Entrance of each day's content (css/motion/reveal.css), in every browser.
// Targets get .reveal now and .in when they reach the viewport. Call in the
// same task as rendering: marking elements .reveal after a paint would flash
// them visible, then hide them.
export function startReveal(root) {
  const targets = [...root.querySelectorAll(TARGETS)];
  for (const el of targets) el.classList.add('reveal');

  if (!('IntersectionObserver' in window)) {
    for (const el of targets) el.classList.add('in');
    return { replay() {}, settle() {} };
  }

  // Entries arriving in the same callback cascade; one arriving alone while
  // scrolling starts at once. Panels hidden by a tab never intersect, so
  // their entries wait until that tab is opened.
  const observer = new IntersectionObserver((entries) => {
    const arriving = entries
      .filter((entry) => entry.isIntersecting)
      .map((entry) => entry.target)
      .sort(byDocumentOrder);

    arriving.forEach((el, order) => {
      el.style.setProperty('--reveal-order', String(order));
      el.classList.add('in');
      observer.unobserve(el);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  const watch = (els) => {
    for (const el of els) observer.observe(el);
  };
  watch(targets);

  return {
    // Hide the entries inside `scope` again so they enter once more.
    replay(scope) {
      const els = [...scope.querySelectorAll(TARGETS)];
      for (const el of els) el.classList.remove('in');
      watch(els);
    },
    // A slot picked on the calendar must be visible for its flash; see
    // controllers/status.js. Drop it out of observation without the entrance.
    settle(el) {
      observer.unobserve(el);
      el.classList.remove('reveal');
    },
  };
}
