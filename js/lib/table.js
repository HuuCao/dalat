import { keyOf } from './text.js';

// Columns are found by name, so the form's questions can be reordered. Line
// numbers match the sheet (header is line 1); blank rows are skipped.
export function readTable(rows, tableName, columns) {
  const header = (rows[0] ?? []).map(keyOf);
  const positions = Object.entries(columns).map(([key, { names, required }]) => {
    const at = header.findIndex((cell) => names.some((name) => keyOf(name) === cell));
    if (at === -1 && required) throw new Error(`${tableName}: thiếu cột "${names[0]}"`);
    return [key, at];
  });

  return rows.slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ''))
    .map(({ line, cells }) => Object.fromEntries([
      ['line', line],
      ...positions.map(([key, at]) => [key, at === -1 ? '' : (cells[at] ?? '').trim()]),
    ]));
}

export function parseAmount(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  const amount = Number(digits);
  return digits && amount > 0 ? amount : null;
}
