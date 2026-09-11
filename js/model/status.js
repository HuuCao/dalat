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

  return { phase, current, next, pastPlaces, pastIds, remainingMs: Math.max(trip.start.getTime() - now, 0) };
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

export function describeStatus(trip, status) {
  const place = trip.hero.title;
  const progress = `${status.pastPlaces}/${trip.placeCount} điểm`;

  if (status.phase === 'soon') {
    const [first] = trip.items;
    const firstDay = trip.days.find((day) => day.id === first.dayId);
    return {
      label: 'Đếm ngược khởi hành',
      tiles: countdownTiles(status.remainingMs),
      headline: null,
      note: `${place} đang chờ · bắt đầu ${first.startText} · ${firstDay.dateText}`,
    };
  }

  if (status.phase === 'done') {
    return {
      label: 'Hành trình đã khép lại',
      tiles: null,
      headline: `Hẹn gặp lại ${place} ✦`,
      note: `Đã đi qua ${trip.placeCount} điểm trong ${trip.dayCount} ngày`,
    };
  }

  if (status.current) {
    return {
      label: 'Đang diễn ra',
      tiles: null,
      headline: status.current.heading,
      note: `Đến ${status.current.endText} · đã qua ${progress}`,
    };
  }

  return {
    label: 'Đang di chuyển',
    tiles: null,
    headline: status.next ? status.next.heading : 'Nghỉ giữa chặng',
    note: status.next ? `Tiếp theo lúc ${status.next.startText} · đã qua ${progress}` : `Đã qua ${progress}`,
  };
}
