import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseCsv } from '../js/lib/csv.js';
import { buildTrip } from '../js/model/trip.js';
import { readPlan, mergePlan } from '../js/model/plan.js';
import { sheetsOf, messySheets } from './helpers/sheets.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/trip.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../scripts/apps-script/form-sync.js', import.meta.url), 'utf8');
const FORM_URL = 'https://docs.google.com/forms/d/abc/edit';

const pageLabels = (sheets) => buildTrip(mergePlan(fixture, readPlan(sheets))).fund.labels;

// A fresh copy of the script, with fake Google services around it. Arrays
// the script returns come from another realm: spread them before deepEqual.
function load({ sheets = sheetsOf(fixture), formUrl = FORM_URL, questions = [['Người nhập', []], ['Địa điểm', ['cũ']]] } = {}) {
  const log = { set: [], opened: [], toasts: [], alerts: [], released: 0 };
  let triggers = [];
  const tabs = Object.fromEntries(Object.entries({ LichTrinh: sheets.items, Ngay: sheets.days, ChiChung: sheets.shared })
    .filter(([, csv]) => csv !== undefined));
  const items = questions.map(([title, initial]) => {
    let choices = [...initial];
    return {
      getTitle: () => title,
      asListItem: () => ({
        getChoices: () => choices.map((value) => ({ getValue: () => value })),
        setChoiceValues: (values) => {
          choices = [...values];
          log.set.push([...values]);
        },
      }),
    };
  });
  const spreadsheet = {
    getFormUrl: () => formUrl,
    getSheetByName: (name) => (name in tabs
      ? { getDataRange: () => ({ getDisplayValues: () => parseCsv(tabs[name]) }) }
      : null),
    toast: (message) => log.toasts.push(message),
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      getActive: () => spreadsheet,
      getUi: () => ({
        alert: (message) => log.alerts.push(message),
        createMenu: () => ({ addItem() { return this; }, addToUi() {} }),
      }),
    },
    FormApp: {
      ItemType: { LIST: 'LIST' },
      openByUrl: (url) => {
        log.opened.push(url);
        return { getItems: () => items };
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { log.released += 1; } }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: (trigger) => { triggers = triggers.filter((t) => t !== trigger); },
      newTrigger: (handler) => ({
        forSpreadsheet: () => ({
          onChange: () => ({
            create: () => {
              const trigger = { getHandlerFunction: () => handler };
              triggers.push(trigger);
              return trigger;
            },
          }),
        }),
      }),
    },
  });
  vm.runInContext(source, context);
  return { script: context, log, triggers: () => triggers };
}

test('the script names places exactly like the page, bad rows included', () => {
  for (const sheets of [sheetsOf(fixture), messySheets(fixture)]) {
    const { script } = load({ sheets });
    const labels = [...script.planLabels(parseCsv(sheets.items), parseCsv(sheets.days), parseCsv(sheets.shared))];
    assert.deepEqual(labels, pageLabels(sheets));
  }
  assert.equal(pageLabels(sheetsOf(fixture)).length, 28);
  assert.equal(pageLabels(messySheets(fixture)).length, 30);
});

test('syncForm writes the dropdown only when it differs', () => {
  const { script, log } = load();
  const first = script.syncForm();
  assert.equal(first.changed, true);
  assert.equal(first.count, 28);
  assert.deepEqual(log.set, [pageLabels(sheetsOf(fixture))]);
  assert.deepEqual(log.opened, [FORM_URL]);

  const second = script.syncForm();
  assert.equal(second.changed, false);
  assert.equal(log.set.length, 1);
  assert.equal(log.released, 2);
});

test('syncForm says what is missing and always releases the lock', () => {
  const unlinked = load({ formUrl: null });
  assert.throws(() => unlinked.script.syncForm(), /Sheet chưa liên kết Google Form/);
  assert.equal(unlinked.log.released, 1);
  assert.throws(() => load({ questions: [['Người nhập', []]] }).script.syncForm(), /Không tìm thấy câu hỏi "Địa điểm" \(menu thả xuống\)/);
  assert.throws(() => load({ sheets: { ...sheetsOf(fixture), days: undefined } }).script.syncForm(), /Không tìm thấy tab "Ngay"/);
  assert.throws(() => load({ sheets: { ...sheetsOf(fixture), items: 'Ngày,Tên\n16/10/2026,X' } }).script.syncForm(), /LichTrinh: thiếu cột "Bắt đầu"/);
});

test('setup installs one change trigger however often it runs', () => {
  const { script, triggers } = load();
  script.setup();
  script.setup();
  assert.equal(triggers().length, 1);
  assert.equal(triggers()[0].getHandlerFunction(), 'syncForm');
});

test('the menu reports the result or the error', () => {
  const ok = load();
  ok.script.syncFromMenu();
  ok.script.syncFromMenu();
  assert.deepEqual(ok.log.toasts, ['Đã cập nhật 28 địa điểm', 'Form đã khớp (28 địa điểm)']);

  const failing = load({ formUrl: null });
  failing.script.syncFromMenu();
  assert.deepEqual(failing.log.alerts, ['Không đồng bộ được Form: Sheet chưa liên kết Google Form']);
});
