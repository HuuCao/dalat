import { fetchCsv } from '../lib/csv.js';

export const CACHE_KEY = 'plan-cache:v1';
export const RELOAD_KEY = 'plan-reloaded-at';
export const RELOAD_WINDOW_MS = 4000;
export const RELOAD_GUARD_MS = 60_000;

const TABS = ['items', 'days', 'shared'];

export const sameCopy = (a, b) => TABS.every((tab) => a[tab] === b[tab]);

// What to do once a background fetch is back (spec §5.2). `cached` is on
// screen; `fresh` is null when the fetch failed.
export function decide({ cached, fresh, buildable, elapsedMs, lastReloadAt, canMark, now }) {
  if (!fresh) return 'none';
  if (sameCopy(cached, fresh)) return 'touch';
  if (!buildable) return 'none';
  // Google's edge caches may answer old and new copies in turn: at most one
  // reload a minute.
  if (lastReloadAt != null && now - lastReloadAt < RELOAD_GUARD_MS) return 'save';
  // Past the first seconds people are reading. Without a mark a reload could
  // loop, so ask instead.
  if (elapsedMs > RELOAD_WINDOW_MS || !canMark) return 'toast';
  return 'reload';
}

// A copy is only trusted for the links it was fetched from.
export function readCopy(storage, links) {
  try {
    const copy = JSON.parse(storage.getItem(CACHE_KEY));
    const valid = copy && Number.isFinite(copy.fetchedAt)
      && TABS.every((tab) => typeof copy[tab] === 'string' && copy.urls?.[tab] === links[tab]);
    return valid ? copy : null;
  } catch {
    return null;
  }
}

export function writeCopy(storage, copy) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

export function readReloadMark(session) {
  try {
    const at = Number(session.getItem(RELOAD_KEY));
    return { at: at > 0 ? at : null, usable: true };
  } catch {
    return { at: null, usable: false };
  }
}

export function writeReloadMark(session, at) {
  try {
    session.setItem(RELOAD_KEY, String(at));
    return true;
  } catch {
    return false;
  }
}

// All three tabs or nothing: never one new tab beside two old ones.
export async function fetchPlan(links) {
  const [items, days, shared] = await Promise.all(TABS.map((tab) => fetchCsv(links[tab])));
  return { urls: { ...links }, fetchedAt: Date.now(), items, days, shared };
}

// Runs after the page was built from `cached`. Returns the action taken.
export async function refreshPlan({
  links, cached, storage, session, openedAt, build, onTouch, onToast, reload,
  fetchCopy = fetchPlan, now = Date.now,
}) {
  let fresh = null;
  try {
    fresh = await fetchCopy(links);
  } catch (error) {
    console.error(error);
  }

  let buildable = false;
  if (fresh && !sameCopy(cached, fresh)) {
    try {
      build(fresh);
      buildable = true;
    } catch (error) {
      console.error(error);
    }
  }

  const mark = readReloadMark(session);
  const at = now();
  let action = decide({
    cached, fresh, buildable, elapsedMs: at - openedAt, lastReloadAt: mark.at, canMark: mark.usable, now: at,
  });

  if (action === 'touch') {
    writeCopy(storage, { ...cached, fetchedAt: fresh.fetchedAt });
    onTouch(fresh.fetchedAt);
  } else if (action !== 'none') {
    writeCopy(storage, fresh);
  }
  if (action === 'reload' && !writeReloadMark(session, at)) action = 'toast';
  if (action === 'reload') reload();
  if (action === 'toast') onToast();
  return action;
}
