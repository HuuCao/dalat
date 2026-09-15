import { parseCsv, fetchCsv } from '../lib/csv.js';
import { buildLedger } from '../model/fund.js';

const REFRESH_MS = 5 * 60_000;
const STALE_MS = 60_000;
const CACHE_KEY = 'fund-cache:v1';

// Reads both sheets, rebuilds the ledger and hands it to the view. The last
// good copy is kept on the phone, so a weak signal on the pass still shows
// numbers. Nothing thrown here reaches the schedule.
export function startFund({ trip, view, clock }) {
  const { csv } = trip.fund;
  if (!csv) {
    view.update(buildLedger(trip, { expenses: null, contributions: null }, clock()), { state: 'unlinked' });
    return;
  }

  let loading = false;
  let lastAttempt = 0;

  // Throws when a sheet lost a required column, before that copy is cached.
  const show = (copy, state, error) => {
    const tables = { expenses: parseCsv(copy.expenses), contributions: parseCsv(copy.contributions) };
    view.update(buildLedger(trip, tables, clock()), { state, fetchedAt: copy.fetchedAt, error });
  };

  async function load() {
    if (loading) return;
    loading = true;
    lastAttempt = Date.now();
    try {
      const [expenses, contributions] = await Promise.all([fetchCsv(csv.expenses), fetchCsv(csv.contributions)]);
      const copy = { fetchedAt: Date.now(), expenses, contributions };
      show(copy, 'fresh');
      writeCache(copy);
    } catch (error) {
      console.error(error);
      const cached = readCache();
      try {
        if (!cached) throw error;
        show(cached, 'stale', error.message);
      } catch {
        view.fail(error.message);
      }
    } finally {
      loading = false;
    }
  }

  const cached = readCache();
  if (cached) {
    try {
      show(cached, 'cached');
    } catch {
      // A broken copy is replaced by the load below.
    }
  }

  view.onRefresh(load);
  load();

  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, REFRESH_MS);

  // Phones freeze background tabs; catch up when the page is looked at again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastAttempt > STALE_MS) load();
  });
}

function readCache() {
  try {
    const copy = JSON.parse(window.localStorage.getItem(CACHE_KEY));
    const valid = copy && typeof copy.expenses === 'string' && typeof copy.contributions === 'string'
      && Number.isFinite(copy.fetchedAt);
    return valid ? copy : null;
  } catch {
    return null;
  }
}

function writeCache(copy) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(copy));
  } catch {
    // Private mode or storage blocked: live data still works.
  }
}
