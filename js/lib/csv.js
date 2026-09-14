// Google Sheets "Publish to web" CSV: quoted cells may hold commas, doubled
// quotes and line breaks. Blank rows are kept so row index + 1 is the line
// number people see in the sheet.
export function parseCsv(text) {
  const input = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// An unpublished sheet answers with Google's sign-in page instead of CSV.
export function assertCsv(text) {
  if (text.replace(/^﻿/, '').trimStart().startsWith('<')) throw new Error('Sheet chưa publish dạng CSV');
  return text;
}
