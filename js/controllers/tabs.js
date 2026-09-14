import { ALL_TAB, FUND_TAB } from '../views/tabs.js';

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };
const GAP_BELOW_TABBAR = 12;

// onChange(shownPanels) runs after every tab the user picks, so the shown
// days can play their entrance again.
export function createTabs(tablist, panels, { onChange = () => {} } = {}) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const tabbar = tablist.closest('.tabbar');

  function select(id, { focus = false, user = false } = {}) {
    const active = tabs.find((tab) => tab.dataset.tab === id) ?? tabs[0];

    for (const tab of tabs) {
      const selected = tab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) {
      // "Tất cả" means every day; the fund panel only shows on its own tab.
      panel.hidden = active.dataset.tab === ALL_TAB
        ? panel.dataset.day === FUND_TAB
        : panel.dataset.day !== active.dataset.tab;
    }

    if (focus) active.focus();
    if (!user) return;

    const shown = panels.filter((panel) => !panel.hidden);
    // On phones with many days the tab row scrolls sideways.
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    bringIntoView(shown[0]);
    onChange(shown);
  }

  // Scrolled past the start of the chosen day? Jump back so it begins right
  // under the sticky tab bar and its entrance plays on screen.
  function bringIntoView(panel) {
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - tabbar.offsetHeight - GAP_BELOW_TABBAR;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab.dataset.tab, { user: true });
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
    select(tabs[target].dataset.tab, { focus: true, user: true });
  });

  const TODAY = ', hôm nay';

  // Lime dot on the day in progress; the clock calls this every tick, so the
  // dot moves on at midnight.
  function markToday(dayId) {
    for (const tab of tabs) {
      const today = tab.dataset.tab === dayId;
      if (today === tab.hasAttribute('data-today')) continue;
      tab.toggleAttribute('data-today', today);
      const label = tab.getAttribute('aria-label');
      if (label) tab.setAttribute('aria-label', today ? `${label}${TODAY}` : label.replace(TODAY, ''));
    }
  }

  select(ALL_TAB);
  return { select, markToday };
}
