import { h } from '../lib/dom.js';

const LINK = { target: '_blank', rel: 'noopener noreferrer' };

// Sheet rows the schedule had to skip, shown above every tab so whoever
// opens the page can go and fix them.
export function renderPlanWarnings(warnings, sheet) {
  if (warnings.length === 0) return null;
  return h('details', { class: 'warn-box plan-warn' },
    h('summary', { text: `⚠️ Lịch trình có ${warnings.length} dòng lỗi` }),
    h('ul', {}, warnings.map((text) => h('li', { text }))),
    sheet ? h('a', { class: 'plan-warn-link', href: sheet, ...LINK }, 'Mở Sheet') : null);
}
