// Google Sheets "Publish to web" CSV: quoted cells may hold commas, doubled
// quotes and line breaks. Blank rows are kept so row index + 1 is the line
// number people see in the sheet.
export function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, '');
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
  if (text.replace(/^\uFEFF/, '').trimStart().startsWith('<')) throw new Error('Sheet chưa publish dạng CSV');
  return text;
}

const FETCH_TIMEOUT_MS = 15_000;

// A published sheet as text. Skips the browser cache; Google still caches
// published CSV for ~5 min.
export async function fetchCsv(url) {
  const busted = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(busted, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return assertCsv(await response.text());
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Hết thời gian tải (15s)');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
