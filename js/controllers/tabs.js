import { ALL_TAB } from '../views/tabs.js';

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };

export function createTabs(tablist, panels) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  function select(id, { focus = false, scroll = false } = {}) {
    const active = tabs.find((tab) => tab.dataset.tab === id) ?? tabs[0];

    for (const tab of tabs) {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) {
      panel.hidden = active.dataset.tab !== ALL_TAB && panel.dataset.day !== active.dataset.tab;
    }

    if (focus) active.focus();
    // Only for user input: on phones with many days the row scrolls sideways.
    if (scroll) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab.dataset.tab, { scroll: true });
  });

  tablist.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(event.target);
    if (index === -1) return;

    let target;
    if (event.key in ARROW_STEPS) target = (index + ARROW_STEPS[event.key] + tabs.length) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;

    event.preventDefault();
    select(tabs[target].dataset.tab, { focus: true, scroll: true });
  });

  select(ALL_TAB);
  return { select };
}
