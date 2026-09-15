import { durationText, localDateOf, shortWeekdayText } from '../lib/time.js';

export function getStatus(trip, now) {
  let current = null;
  let next = null;
  let pastPlaces = 0;
  const pastIds = new Set();

  for (const item of trip.items) {
    if (now >= item.end.getTime()) {
      pastIds.add(item.id);
      if (!item.empty) pastPlaces += 1;
    } else if (now >= item.start.getTime()) {
      current ??= item;
    } else {
      next ??= item;
    }
  }

  let phase = 'live';
  if (now < trip.start.getTime()) phase = 'soon';
  else if (now >= trip.end.getTime()) phase = 'done';

  return { phase, now, current, next, pastPlaces, pastIds, remainingMs: Math.max(trip.start.getTime() - now, 0) };
}

// Time until the next slot starts or ends (Infinity once the last one has
// ended), so the clock can tick on that very moment instead of up to a whole
// tick late.
export function msUntilNextChange(trip, now) {
  let next = Infinity;
  for (const item of trip.items) {
    for (const edge of [item.start.getTime(), item.end.getTime()]) {
      if (edge > now && edge < next) next = edge;
    }
  }
  return next - now;
}

export function countdownTiles(ms) {
  const total = Math.floor(ms / 1000);
  const parts = [
    { unit: 'ngày', value: Math.floor(total / 86_400) },
    { unit: 'giờ', value: Math.floor(total / 3600) % 24 },
    { unit: 'phút', value: Math.floor(total / 60) % 60 },
    { unit: 'giây', value: total % 60 },
  ];
  // Drop leading zero units so the row never reads "00 ngày 00 giờ".
  while (parts.length > 2 && parts[0].value === 0) parts.shift();
  return parts.map(({ unit, value }) => ({ unit, value: String(value).padStart(2, '0') }));
}

// A viewer who has not touched the page for this long is not in the middle
// of something, so the page may scroll for them.
export const IDLE_MS = 30_000;

// What to do when the slot in progress changes: follow a slot that just
// started, or only offer it while the viewer is busy.
export function followAction({ previousId, currentId, idleMs }) {
  if (!currentId || currentId === previousId) return null;
  return idleMs >= IDLE_MS ? 'move' : 'hint';
}

export function describeStatus(trip, status) {
  const place = trip.hero.title;
  const progress = `${status.pastPlaces}/${trip.placeCount} điểm`;
  const quiet = { progress: null, next: null, mapUrl: null };

  if (status.phase === 'soon') {
    // An empty first day has no start time to show, only its date.
    const [firstDay] = trip.days;
    const [first] = firstDay.items;
    const start = first ? `${first.startText} · ${firstDay.dateText}` : firstDay.dateText;
    return {
      label: 'Đếm ngược khởi hành',
      tiles: countdownTiles(status.remainingMs),
      headline: null,
      note: `${place} đang chờ · bắt đầu ${start}`,
      ...quiet,
    };
  }

  if (status.phase === 'done') {
    return {
      label: 'Hành trình đã khép lại',
      tiles: null,
      headline: `Hẹn gặp lại ${place} ✦`,
      note: `Đã đi qua ${trip.placeCount} điểm trong ${trip.dayCount} ngày`,
      ...quiet,
    };
  }

  const { current, next, now } = status;
  if (current) {
    return {
      label: 'Đang diễn ra',
      tiles: null,
      headline: current.heading,
      note: `Còn ${durationText(current.end.getTime() - now)} · đến ${current.endText}`,
      progress,
      next: upNext(trip, current),
      mapUrl: current.mapUrl,
    };
  }

  if (next) {
    // On an empty day, or overnight, the next slot is not today: name its weekday.
    const day = trip.days.find((entry) => entry.id === next.dayId);
    const when = day.date === localDateOf(now, trip.timezone) ? next.startText : `${shortWeekdayText(day.date)} ${next.startText}`;
    return {
      label: 'Đang di chuyển',
      tiles: null,
      headline: next.heading,
      note: `Bắt đầu ${when} · còn ${durationText(next.start.getTime() - now)}`,
      progress,
      next: upNext(trip, next),
      mapUrl: next.mapUrl,
    };
  }

  return { label: 'Đang di chuyển', tiles: null, headline: 'Nghỉ giữa chặng', note: `Đã qua ${progress}`, ...quiet };
}

// The slot after `item`; on another day it names the weekday too.
function upNext(trip, item) {
  const after = trip.items[trip.items.indexOf(item) + 1];
  if (!after) return null;
  const day = trip.days.find((entry) => entry.id === after.dayId);
  const when = after.dayId === item.dayId ? after.startText : `${shortWeekdayText(day.date)} ${after.startText}`;
  return `Tiếp theo ${when} · ${after.heading}`;
}
