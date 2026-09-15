/**
 * Keeps the "Địa điểm" dropdown of the linked Google Form in step with the
 * LichTrinh / Ngay / ChiChung tabs.
 *
 * Install: Sheet → Tiện ích mở rộng → Apps Script → paste this file → run
 * setup() once and allow access. From then on every change to the sheet
 * syncs the Form within seconds; the "🔄 Đồng bộ Form" menu syncs on demand.
 *
 * The label rules mirror readPlan (js/model/plan.js) and buildFund
 * (js/model/trip.js); tests/form-sync.test.js runs this file against the
 * page code, so change them together. Plain script: no modules, no ?. / ??.
 */

const PLACE_QUESTION = 'Địa điểm';
const EXTRA_TITLE = 'Phát sinh';
const SHARED_GROUP = 'Chung';

// Same key as js/lib/text.js. Vietnamese has no locale-specific casing, so
// toLowerCase() matches toLocaleLowerCase('vi').
function keyOf(value) {
  return String(value == null ? '' : value).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

const pad = (value) => String(value).padStart(2, '0');

// "16/10/2026" or "2026-10-16" → "2026-10-16"; null unless a real date.
function parseDate(text) {
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = vn ? `${vn[3]}-${pad(vn[2])}-${pad(vn[1])}` : text;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? iso : null;
}

// "7:00", "07:00", "7:00:00" → minutes after midnight; null otherwise.
function parseMinutes(text) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

// Rows under the header as { line, field: text }; columns found by name,
// blank rows skipped, line = the row number seen in the sheet.
function readRows(values, table, columns) {
  const header = (values[0] || []).map(keyOf);
  const fields = Object.keys(columns);
  const at = {};
  for (const field of fields) {
    at[field] = header.indexOf(keyOf(columns[field]));
    if (at[field] === -1) throw new Error(`${table}: thiếu cột "${columns[field]}"`);
  }
  return values.slice(1)
    .map((cells, index) => ({ line: index + 2, cells }))
    .filter(({ cells }) => cells.some((cell) => String(cell).trim() !== ''))
    .map(({ line, cells }) => {
      const row = { line };
      for (const field of fields) {
        const cell = cells[at[field]];
        row[field] = String(cell == null ? '' : cell).trim();
      }
      return row;
    });
}

// The dropdown choices, in the order the page lists them: shared costs, the
// shared extra bucket, then each day's slots closed by its extra bucket.
function planLabels(itemValues, dayValues, sharedValues) {
  const itemRows = readRows(itemValues, 'LichTrinh', { date: 'Ngày', start: 'Bắt đầu', end: 'Kết thúc', title: 'Tên' });
  const dayRows = readRows(dayValues, 'Ngay', { date: 'Ngày' });
  const sharedRows = readRows(sharedValues, 'ChiChung', { title: 'Tên' });
  const extraKey = keyOf(EXTRA_TITLE);
  const labels = [];

  const costs = new Set();
  for (const row of sharedRows) {
    const key = keyOf(row.title);
    if (!key || key === extraKey || costs.has(key)) continue;
    costs.add(key);
    labels.push(`${SHARED_GROUP} · ${row.title}`);
  }
  labels.push(`${SHARED_GROUP} · ${EXTRA_TITLE}`);

  const days = new Map();
  const dayAt = (date) => {
    if (!days.has(date)) days.set(date, { items: [], titles: new Set() });
    return days.get(date);
  };
  for (const row of itemRows) {
    const date = parseDate(row.date);
    const start = parseMinutes(row.start);
    const end = parseMinutes(row.end);
    const key = keyOf(row.title);
    if (!date || start === null || end === null || end <= start || !key || key === extraKey) continue;
    const day = dayAt(date);
    if (day.titles.has(key)) continue;
    day.titles.add(key);
    day.items.push({ start, title: row.title });
  }
  for (const row of dayRows) {
    const date = parseDate(row.date);
    if (date) dayAt(date);
  }

  [...days.keys()].sort().forEach((date, index) => {
    const label = `Day ${index + 1}`;
    days.get(date).items.slice()
      .sort((a, b) => a.start - b.start)
      .forEach((item) => labels.push(`${label} · ${item.title}`));
    labels.push(`${label} · ${EXTRA_TITLE}`);
  });
  return labels;
}

function syncForm() {
  const lock = LockService.getScriptLock();
  // Runs queue up; each reads the sheet after taking the lock, so the last
  // edit always lands.
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActive();
    const formUrl = spreadsheet.getFormUrl();
    if (!formUrl) throw new Error('Sheet chưa liên kết Google Form');
    const valuesOf = (name) => {
      const sheet = spreadsheet.getSheetByName(name);
      if (!sheet) throw new Error(`Không tìm thấy tab "${name}"`);
      return sheet.getDataRange().getDisplayValues();
    };
    const labels = planLabels(valuesOf('LichTrinh'), valuesOf('Ngay'), valuesOf('ChiChung'));

    const question = FormApp.openByUrl(formUrl).getItems(FormApp.ItemType.LIST)
      .find((item) => keyOf(item.getTitle()) === keyOf(PLACE_QUESTION));
    if (!question) throw new Error(`Không tìm thấy câu hỏi "${PLACE_QUESTION}" (menu thả xuống)`);

    const list = question.asListItem();
    const current = list.getChoices().map((choice) => choice.getValue());
    // Form submissions fire the change trigger too: write only real changes.
    const changed = current.length !== labels.length || current.some((value, index) => value !== labels[index]);
    if (changed) list.setChoiceValues(labels);
    return { changed, count: labels.length };
  } finally {
    lock.releaseLock();
  }
}

function setup() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'syncForm') ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('syncForm').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  return syncForm();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 Đồng bộ Form')
    .addItem('Cập nhật danh sách địa điểm', 'syncFromMenu')
    .addToUi();
}

function syncFromMenu() {
  try {
    const result = syncForm();
    SpreadsheetApp.getActive().toast(
      result.changed ? `Đã cập nhật ${result.count} địa điểm` : `Form đã khớp (${result.count} địa điểm)`,
      'Đồng bộ Form',
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(`Không đồng bộ được Form: ${error.message}`);
  }
}
