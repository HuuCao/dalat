import { toMinutes, localDateOf, localMinuteOf } from '../lib/time.js';

const HOUR = 60;

const hourText = (minute) => `${String(minute / HOUR).padStart(2, '0')}:00`;

// The whole trip on one time grid: whole hours from the earliest start to
// the latest end, each slot a block measured in minutes from the top. The
// view turns minutes into pixels.
export function buildCalendar(trip) {
  const startMinute = Math.floor(Math.min(...trip.items.map((item) => toMinutes(item.startText))) / HOUR) * HOUR;
  const endMinute = Math.ceil(Math.max(...trip.items.map((item) => toMinutes(item.endText))) / HOUR) * HOUR;

  const hours = [];
  for (let minute = startMinute; minute <= endMinute; minute += HOUR) {
    hours.push({ top: minute - startMinute, text: hourText(minute) });
  }

  return {
    startMinute,
    endMinute,
    span: endMinute - startMinute,
    hours,
    days: trip.days.map((day) => ({
      id: day.id,
      title: day.title,
      shortDate: day.shortDate,
      dateText: day.dateText,
      date: day.date,
      blocks: layoutBlocks(day.items, startMinute),
    })),
  };
}

// Where the current minute sits, or null off the trip's days or outside the
// grid's hours.
export function nowMark(calendar, now, timezone) {
  const date = localDateOf(now, timezone);
  const day = calendar.days.find((entry) => entry.date === date);
  if (!day) return null;
  const minute = localMinuteOf(now, timezone);
  if (minute < calendar.startMinute || minute > calendar.endMinute) return null;
  return { dayId: day.id, top: minute - calendar.startMinute };
}

// Nothing stops two slots of a day from overlapping, so overlapping slots
// share the width side by side. Slots that only touch (end == start) do not
// overlap. Items arrive sorted by start (buildDay).
function layoutBlocks(items, startMinute) {
  const clusters = [];
  let clusterEnd = -Infinity;
  for (const item of items) {
    const start = toMinutes(item.startText);
    const end = toMinutes(item.endText);
    if (start >= clusterEnd) clusters.push([]);
    clusters[clusters.length - 1].push({ item, start, end });
    clusterEnd = Math.max(clusterEnd, end);
  }

  return clusters.flatMap((cluster) => {
    const laneEnds = [];
    const placed = cluster.map(({ item, start, end }) => {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = end;
      return { item, top: start - startMinute, height: end - start, lane };
    });
    return placed.map((block) => ({ ...block, lanes: laneEnds.length }));
  });
}
