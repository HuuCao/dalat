import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_KEY, RELOAD_KEY, sameCopy, decide, readCopy, writeCopy, readReloadMark, writeReloadMark, refreshPlan,
} from '../js/controllers/plan.js';

const LINKS = { items: 'https://docs.google.com/i', days: 'https://docs.google.com/d', shared: 'https://docs.google.com/s' };
const copyOf = (items, fetchedAt = 1000) => ({ urls: LINKS, fetchedAt, items, days: 'D', shared: 'S' });
const OLD = copyOf('old');
const NEW = copyOf('new', 2000);
const NOW = 1_000_000;
const base = { cached: OLD, fresh: NEW, buildable: true, elapsedMs: 1000, lastReloadAt: null, canMark: true, now: NOW };

const memoryStorage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return { map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); } };
};
const brokenStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

test('sameCopy compares the three tabs only', () => {
  assert.equal(sameCopy(OLD, { ...OLD, fetchedAt: 5 }), true);
  assert.equal(sameCopy(OLD, NEW), false);
  assert.equal(sameCopy(OLD, { ...OLD, shared: 'S2' }), false);
});

test('decide covers every row of the spec table', () => {
  assert.equal(decide({ ...base, fresh: null }), 'none');
  assert.equal(decide({ ...base, fresh: { ...OLD, fetchedAt: 9 } }), 'touch');
  assert.equal(decide({ ...base, buildable: false }), 'none');
  assert.equal(decide({ ...base, lastReloadAt: NOW - 59_000 }), 'save');
  assert.equal(decide({ ...base, lastReloadAt: NOW - 61_000 }), 'reload');
  assert.equal(decide({ ...base, elapsedMs: 4000 }), 'reload');
  assert.equal(decide({ ...base, elapsedMs: 4001 }), 'toast');
  assert.equal(decide({ ...base, canMark: false }), 'toast');
});

test('readCopy returns a stored copy only for the same links', () => {
  const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(OLD) });
  assert.deepEqual(readCopy(storage, LINKS), OLD);
  assert.equal(readCopy(storage, { ...LINKS, days: 'https://docs.google.com/other' }), null);
  assert.equal(readCopy(memoryStorage({ [CACHE_KEY]: '{broken' }), LINKS), null);
  assert.equal(readCopy(memoryStorage({ [CACHE_KEY]: JSON.stringify({ ...OLD, items: 5 }) }), LINKS), null);
  assert.equal(readCopy(memoryStorage(), LINKS), null);
  assert.equal(readCopy(brokenStorage, LINKS), null);
  assert.equal(readCopy(null, LINKS), null);
});

test('writeCopy and the reload mark never throw', () => {
  const storage = memoryStorage();
  assert.equal(writeCopy(storage, NEW), true);
  assert.deepEqual(JSON.parse(storage.map.get(CACHE_KEY)), NEW);
  assert.equal(writeCopy(brokenStorage, NEW), false);
  assert.equal(writeCopy(null, NEW), false);

  const session = memoryStorage();
  assert.deepEqual(readReloadMark(session), { at: null, usable: true });
  assert.equal(writeReloadMark(session, NOW), true);
  assert.deepEqual(readReloadMark(session), { at: NOW, usable: true });
  assert.deepEqual(readReloadMark(brokenStorage), { at: null, usable: false });
  assert.deepEqual(readReloadMark(null), { at: null, usable: false });
  assert.equal(writeReloadMark(brokenStorage, NOW), false);
});

const refresh = async (overrides = {}) => {
  const storage = memoryStorage({ [CACHE_KEY]: JSON.stringify(OLD) });
  const session = memoryStorage();
  const calls = { touch: [], toast: 0, reload: 0 };
  const action = await refreshPlan({
    links: LINKS,
    cached: OLD,
    storage,
    session,
    openedAt: NOW - 1000,
    now: () => NOW,
    fetchCopy: async () => NEW,
    build: () => {},
    onTouch: (at) => calls.touch.push(at),
    onToast: () => { calls.toast += 1; },
    reload: () => { calls.reload += 1; },
    ...overrides,
  });
  return { action, calls, storage, session };
};

const quietly = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};

test('refreshPlan reloads once for a quick change and marks it', async () => {
  const { action, calls, storage, session } = await refresh();
  assert.equal(action, 'reload');
  assert.equal(calls.reload, 1);
  assert.deepEqual(JSON.parse(storage.map.get(CACHE_KEY)), NEW);
  assert.equal(session.map.get(RELOAD_KEY), String(NOW));
});

test('refreshPlan touches, toasts, or keeps the old copy', async () => {
  const same = await refresh({ fetchCopy: async () => ({ ...OLD, fetchedAt: 7 }) });
  assert.equal(same.action, 'touch');
  assert.deepEqual(same.calls.touch, [7]);
  assert.equal(JSON.parse(same.storage.map.get(CACHE_KEY)).fetchedAt, 7);

  const slow = await refresh({ openedAt: NOW - 5000 });
  assert.equal(slow.action, 'toast');
  assert.equal(slow.calls.toast, 1);
  assert.equal(slow.calls.reload, 0);
  assert.deepEqual(JSON.parse(slow.storage.map.get(CACHE_KEY)), NEW);

  const offline = await quietly(() => refresh({ fetchCopy: async () => { throw new Error('offline'); } }));
  assert.equal(offline.action, 'none');
  assert.deepEqual(JSON.parse(offline.storage.map.get(CACHE_KEY)), OLD);

  const broken = await quietly(() => refresh({ build: () => { throw new Error('LichTrinh: thiếu cột "Tên"'); } }));
  assert.equal(broken.action, 'none');
  assert.deepEqual(JSON.parse(broken.storage.map.get(CACHE_KEY)), OLD);
  assert.equal(broken.calls.reload, 0);

  const blocked = await refresh({ session: brokenStorage });
  assert.equal(blocked.action, 'toast');
  assert.equal(blocked.calls.reload, 0);
});
