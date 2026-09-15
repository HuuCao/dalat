// Builds the three sheet tabs, as published CSV, from a trip.json-shaped
// object. Dates and times use the forms Google Sheets (Vietnam) publishes.

const cell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const csvOf = (rows) => rows.map((row) => row.map(cell).join(',')).join('\n');

const vnDate = (iso) => {
  const [year, month, day] = iso.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
};

export const ITEM_HEADER = ['Ngày', 'Bắt đầu', 'Kết thúc', 'Icon', 'Tên', 'Tag', 'Maps', 'Dự kiến', 'Trống'];
export const DAY_HEADER = ['Ngày', 'Icon', 'Ghi chú'];
export const SHARED_HEADER = ['Tên', 'Icon', 'Dự kiến', 'Ghi chú'];

export function sheetsOf(raw) {
  return {
    // Start as "7:00" (leading zero dropped), end as "09:00:00": both forms
    // the sheet may publish.
    items: csvOf([ITEM_HEADER, ...raw.days.flatMap((day) => day.items.map((item) => [
      vnDate(day.date), item.start.replace(/^0/, ''), `${item.end}:00`, item.icon, item.title,
      item.tag, item.map, item.budget, item.empty ? 'TRUE' : 'FALSE',
    ]))]),
    days: csvOf([DAY_HEADER, ...raw.days.map((day) => [vnDate(day.date), day.icon, day.note])]),
    shared: csvOf([SHARED_HEADER, ...(raw.fund?.shared ?? []).map((cost) => [cost.title, cost.icon, cost.budget, cost.note])]),
  };
}

// For the fixture trip: LichTrinh lines 23–29, Ngay lines 5–6, ChiChung
// lines 5–7 are appended. Only lines 29 ("Dậy sớm") and Ngay 5 (19/10) are
// kept; every other appended row is dropped with a warning.
export function messySheets(raw) {
  const sheets = sheetsOf(raw);
  const add = (csv, rows) => [csv, csvOf(rows)].join('\n');
  return {
    items: add(sheets.items, [
      ['32/10/2026', '08:00', '09:00', '', 'Sai ngày', '', '', '', ''],
      ['16/10/2026', '10:00', '09:00', '', 'Ngược giờ', '', '', '', ''],
      ['16/10/2026', '7h', '09:00', '', 'Sai giờ', '', '', '', ''],
      ['17/10/2026', '23:00', '23:30', '', 'phát sinh', '', '', '', ''],
      ['16/10/2026', '23:00', '23:30', '', 'hidden land', '', '', '', ''],
      ['18/10/2026', '13:00', '14:00', '', '', '', '', '', ''],
      ['17/10/2026', '06:00', '06:30', '⏰', 'Dậy sớm', '', '', 'hai trăm', ''],
    ]),
    days: add(sheets.days, [
      ['19/10/2026', '🧳', 'Ngày thêm'],
      ['16/10/2026', '🌿', 'trùng'],
    ]),
    shared: add(sheets.shared, [
      ['khách sạn', '', '1', ''],
      ['Phát sinh', '', '', ''],
      ['', '', '5', ''],
    ]),
  };
}
