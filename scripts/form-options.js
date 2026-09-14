// Prints the "Địa điểm" dropdown choices, one per line. Paste the whole
// output into the first option of the question; Google Forms splits it.
import { readFileSync } from 'node:fs';
import { buildTrip } from '../js/model/trip.js';

const trip = buildTrip(JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url), 'utf8')));

if (!trip.fund) {
  console.error('data/trip.json chưa có khối "fund".');
  process.exit(1);
}

console.log(trip.fund.labels.join('\n'));
