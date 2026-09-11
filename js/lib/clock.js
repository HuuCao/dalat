// `?now=2026-10-16T12:00:00%2B07:00` pins the page to that moment and lets it
// run from there, so the live and finished states can be checked early.
export function createClock(search, now = Date.now) {
  const param = new URLSearchParams(search).get('now');
  // URLSearchParams decodes a raw "+" in the offset to a space.
  const pinned = param ? Date.parse(param.replace(' ', '+')) : Number.NaN;
  if (Number.isNaN(pinned)) return now;

  const openedAt = now();
  return () => pinned + (now() - openedAt);
}
