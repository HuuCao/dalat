import { buildLedger } from '../model/fund.js';

// Budgets only: the data has no sheet links yet.
export function startFund({ trip, view, clock }) {
  view.update(buildLedger(trip, { expenses: null, contributions: null }, clock()), { state: 'unlinked' });
}
