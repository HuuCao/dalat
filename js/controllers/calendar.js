// Taps on the calendar: a block opens its day at that card, a day heading
// opens the day. The heading row sticks right under the tab bar, whatever
// height the bar ends up with.
export function startCalendar({ view, tabs, show, tabbar }) {
  view.panel.addEventListener('click', (event) => {
    const block = event.target.closest('.cal-block');
    if (block) {
      show(block.dataset.id);
      return;
    }
    const day = event.target.closest('.cal-day');
    if (day) tabs.select(day.dataset.dayId, { user: true, focus: true });
  });

  const measure = () => view.panel.style.setProperty('--tabbar-h', `${tabbar.offsetHeight}px`);
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(tabbar);
}
