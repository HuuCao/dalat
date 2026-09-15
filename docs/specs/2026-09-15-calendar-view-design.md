# Đà Lạt Trip Plan — Lịch biểu tổng quan

- **Ngày:** 2026-09-15
- **Trạng thái:** Chờ duyệt
- **Phạm vi:** Thêm chế độ xem `📅 Lịch` trong tab `Tất cả`: lưới tuần (cột = ngày, trục dọc = giờ), khối cao theo thời lượng thật, trạng thái thời gian thực, bấm khối để nhảy tới thẻ. Không đổi dữ liệu, cách tính quỹ, animation hiện có.

## 1. Bối cảnh

Tab `Tất cả` xếp dọc ba ngày thành một danh sách dài ~3.500px trên điện thoại. Muốn trả lời "ngày nào dày, ngày nào thưa", "chiều thứ 7 còn trống không", "giờ này mọi ngày đang làm gì" thì phải cuộn qua lại. Chưa có chỗ nào nhìn cả chuyến trên một màn hình.

## 2. Mục tiêu

1. Một lưới nhìn được cả chuyến: mỗi khung giờ là một khối đặt đúng giờ, cao đúng thời lượng; khoảng trống giữa các khung thấy ngay.
2. Lịch phản ánh "bây giờ" giống danh sách: khối đang diễn ra lime, khối đã qua xám, có vạch giờ hiện tại.
3. Từ lịch tới chi tiết một chạm: bấm khối → mở ngày, cuộn tới thẻ, thẻ nháy lên.
4. Không thêm tab: chuyển `Danh sách | Lịch` ngay trong `Tất cả`, nhớ lựa chọn cho lần mở sau.
5. Không cuộn ngang ở mọi độ rộng, kể cả khi thêm ngày.

## 3. Ngoài phạm vi

- Kéo thả, sửa lịch trên lịch; popover chi tiết; 💰 trong lịch.
- Khung qua đêm (validate đã cấm `end ≤ start`), xem theo tháng, zoom, in.
- Hiệu ứng bay vào cho từng khối (panel chỉ dùng `fade` sẵn có).
- Cuộn ngang khi nhiều ngày.

## 4. Model — `js/model/calendar.js`

Thuần, không đụng DOM, có test.

### 4.1. `buildCalendar(trip)`

```js
{
  startMinute: 420,             // 07:00
  endMinute: 1320,              // 22:00
  span: 900,                    // endMinute - startMinute
  hours: [{ top: 0, text: '07:00' }, …, { top: 900, text: '22:00' }],
  days: [{
    id: 'day-1', title: 'Ngày 1', shortDate: 'T6 16/10', dateText: 'Th 6, 16/10', date: '2026-10-16',
    blocks: [{ item, top: 0, height: 120, lane: 0, lanes: 1 }, …],
  }, …],
}
```

- `startMinute`: giờ bắt đầu sớm nhất của mọi khung mọi ngày, làm tròn **xuống** tới giờ (`07:30` → `07:00`).
- `endMinute`: giờ kết thúc trễ nhất, làm tròn **lên** tới giờ (`21:30` → `22:00`; `22:00` giữ `22:00`).
- `hours`: mỗi giờ từ `startMinute` tới `endMinute`, gồm cả hai đầu → `07:00…22:00` là 16 nhãn.
- `top`, `height` tính bằng phút; view nhân với `--ppm` (px/phút).
- `item` là object khung giờ của `buildTrip` (dùng `id`, `icon`, `name`, `startText`, `endText`, `empty`, `dayId`).
- Ngày không có khung → `blocks: []`.

### 4.2. Làn cho khung chồng giờ

Validate cho phép hai khung trong một ngày chồng giờ nhau. Data hiện không có, nhưng khối không được đè nhau.

1. Duyệt khung theo giờ bắt đầu (đã sắp sẵn). Gom thành cụm: khung mới vào cụm hiện tại nếu `start < end lớn nhất của cụm`; không thì mở cụm mới.
2. Trong cụm, mỗi khung lấy làn nhỏ nhất có khung cuối kết thúc `≤ start` của nó; không có thì mở làn mới.
3. Mọi khối trong cụm có `lanes` = số làn của cụm.

Chạm nhau (`end == start`) không tính là chồng. Ví dụ A 9–11, B 10–12, C 11–13 → một cụm; A làn 0, B làn 1, C làn 0; cả ba `lanes: 2`.

### 4.3. `nowMark(calendar, now, timezone)`

Trả `{ dayId, top }` hoặc `null`.

- Ngày: `localDateOf(now, timezone)` trùng `day.date`; không trùng ngày nào → `null`.
- Phút trong ngày: `localMinuteOf(now, timezone)` (mới, `lib/time.js`).
- Phút `< startMinute` hoặc `> endMinute` → `null`. `top = phút − startMinute`.

## 5. Giao diện

### 5.1. Chế độ xem trong tab `Tất cả`

```
[ Tất cả     ][ Ngày 1  ][ Ngày 2  ][ Ngày 3  ][ 💰 Quỹ ]
[ ☰ Danh sách][ T6 16/10 ][ T7 17/10 ][ CN 18/10 ]
```

- Không có hàng công tắc riêng. Tab `Tất cả` có dòng thứ hai `span.tab-date.tab-view` > `span.tab-view-icon` + `span.tab-view-word` ghi chế độ đang xem: `☰ Danh sách` / `📅 Lịch` (`VIEW_TEXT` trong `views/tabs.js`). Dưới 761px chỉ hiện icon (chữ không vừa ô tab 52–58px), từ 761px hiện cả icon và chữ; `aria-label` `Tất cả, dạng danh sách. Bấm lần nữa để xem lịch` / `Tất cả, dạng lịch. Bấm lần nữa để xem danh sách`.
- Bấm `Tất cả` khi đang ở tab khác → mở `Tất cả` với chế độ đã nhớ. Bấm `Tất cả` khi nó đang mở (chuột, chạm, Enter/Space) → đổi chế độ. Phím mũi tên chỉ chọn tab, không đổi chế độ.

- Style dùng chung (vẫn giữ cho tab Quỹ): chuyển `.book-tabs` / `.book-tab` từ `css/fund.css` sang `css/base.css` thành `.switch` / `.switch-btn` (giữ nguyên giao diện; cột dùng `grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr)` thay `repeat(2, …)`). `views/fund.js` đổi class thành `switch books-switch`; `margin-bottom: 12px` ở lại `fund.css` dưới `.books-switch`.

### 5.2. Panel lịch

```
       Ngày 1 ●   Ngày 2    Ngày 3     ← dính dưới thanh tab
       T6 16/10   T7 17/10  CN 18/10
07:00 ┃07:00    ┃┃07:00   ┃
      ┃🍃 Đồi chè┃┃🥞 Bánh ┃┊07:30   ┊
08:00 ┃  Cầu Đất┃          ┊🥖 Tự do┊
 ─────────────────────────────────────  (vạch giờ)
10:00 ●━━━━━━━━━  ← vạch now, chỉ cột hôm nay
```

DOM (`views/calendar.js`):

```
section.panel.cal-panel#panel-calendar [role=tabpanel][aria-labelledby=tab-all][data-day=calendar]
  article.cal [style --days --span]
    div.cal-head                                   sticky
      span.cal-corner
      button.cal-day [data-day-id] ×N              span.cal-day-name + span.cal-day-date
    div.cal-body
      div.cal-hours > span.cal-hour [style --top]  một nhãn mỗi giờ
      div.cal-col [data-day-id] ×N                 position: relative
        button.cal-block [data-id][style --top --height --lane --lanes --lines]
          span.cal-time + span.cal-name
        div.cal-now [hidden][style --top]          tạo một lần, update() chuyển nó sang cột hôm nay
```

`.cal-hours` và `.cal-col` cao `calc(var(--span) * var(--ppm))`.

- **Thẻ:** nền `--card`, viền `--line`, bo 14px, padding 12px, bóng `--shadow-md`, `margin-top: 18px` — giống `.day`. **Không** dùng `overflow: hidden`/`clip` trên `.cal` hay tổ tiên (làm hỏng sticky).
- **Tỷ lệ:** `--ppm: 1px` (mobile) → cao 900px; ≥ 761px `--ppm: 1.2px`, padding 20px, bo `--radius`.
- **Lưới cột:** `.cal-head` và `.cal-body` cùng `grid-template-columns: 38px repeat(var(--days), minmax(0, 1fr))`, gap 4px; ≥ 761px cột giờ 48px. Nhiều ngày thì cột hẹp lại, không cuộn ngang.
- **Vạch giờ:** mỗi `.cal-col` nền `repeating-linear-gradient` 1px `--line` mỗi `60 × --ppm`. `.cal-body` padding trên 10px, dưới 8px để nhãn `07:00` / `22:00` không bị cắt. `.cal-hour` 11px `--text-sub`, `tabular-nums`, căn giữa theo vạch (`translateY(-50%)`).
- **Hàng tiêu đề:** `position: sticky; top: var(--tabbar-h, 78px); z-index: 5`, nền `--card`, viền dưới `--line`. `.cal-day-name` 13px đậm `--primary`, `.cal-day-date` 11px `--text-sub`; tối thiểu 44px cao. `[data-today]` → chấm lime 6px dưới chữ như `.tab[data-today]`. `aria-label`: `Mở Ngày 1, Th 6, 16/10`.

### 5.3. Khối

- Vị trí: `position: absolute; top: calc(var(--top) * var(--ppm)); height: calc(var(--height) * var(--ppm) - 2px); left: calc(100% * var(--lane) / var(--lanes)); width: calc(100% / var(--lanes) - 2px)`.
- Kiểu: nền `--accent-soft`, viền trái 3px `--accent`, bo 8px, padding 3px 5px 3px 6px, chữ căn trái, `font: inherit`.
- `.cal-time`: giờ bắt đầu, 11px 600 `--text-sub`, `tabular-nums`.
- `.cal-name`: `icon + ' ' + name`, 12px 700 `--text`, line-height 16px, `-webkit-line-clamp: var(--lines)`.
- `--lines` (view tính theo tỷ lệ mobile): `max(1, floor((height − 22) / 16))`.
- Khối cao `< 40` phút → class `is-short`: ẩn `.cal-time`, `--lines: 1`.
- Khung trống (`item.empty`): viền nét đứt `#c3cfc7`, không viền trái, nền `#f7faf8`, tên `--empty-ink` 600 — giống `.card.empty`.
- `aria-label`: `Ngày 1, 07:00 – 09:00, Đồi chè Cầu Đất`; thêm `, đang diễn ra` / `, đã qua` theo trạng thái.
- Hover (chỉ `@media (hover: hover)`): bóng `--shadow-md` (khối chỉ có viền trái nên không đổi màu viền). `:focus-visible`: viền 2px `--primary`, offset 2px.

### 5.4. Trạng thái thời gian thực

- `.cal-block.is-now`: nền `--live`, chữ `--live-ink`, viền trái `--live-strong`; `prefers-reduced-motion: no-preference` → `animation: live-chip 1.6s ease-out infinite` (keyframe sẵn có).
- `.cal-block.is-past`: nền `#e4e8e5`, chữ `#58605b`, viền trái `#a3aba6` — cùng màu ô giờ `.item.is-past`.
- `.cal-now`: vạch 2px `--live-strong` ngang cả cột, chấm 8px `--live` ở mép trái; `top: calc(var(--top) * var(--ppm))`; `pointer-events: none`; `z-index` trên khối.
- `.cal-day[data-today]`: chấm lime.

## 6. Tương tác

### 6.1. Chế độ xem (`controllers/tabs.js`)

- Hằng mới trong `views/tabs.js`: `CALENDAR_PANEL = 'calendar'`. Tab `Tất cả` có `aria-controls` gồm cả `panel-calendar`.
- Hàm thuần xuất ra để test:
  - `panelShown(key, tab, view)` — `key` là `panel.dataset.day`:
    - `tab === ALL_TAB` và `view === 'calendar'` → chỉ `key === CALENDAR_PANEL`.
    - `tab === ALL_TAB` và `view === 'list'` → mọi `key` trừ `FUND_TAB`, `CALENDAR_PANEL`.
    - Tab khác → `key === tab`.
  - `readView(storage)` — đọc khóa `dalat:schedule-view`; `'calendar'` → `'calendar'`; mọi giá trị khác, `storage` thiếu, hoặc ném lỗi → `'list'`.
- `createTabs(tablist, panels, { onChange, switcher, storage })`:
  - Khởi tạo `view = readView(storage)`.
  - Bấm `button.switch-btn` → `setView(view)`: cập nhật `aria-pressed`, ghi `storage.setItem` (try/catch, lỗi thì bỏ qua), gọi lại `select(ALL_TAB, { user: true })` để ẩn/hiện panel, đưa panel lên dưới thanh tab và gọi `onChange`.
  - `select` ẩn `switcher` khi tab khác `Tất cả`.
  - Trả thêm `view()` (đọc chế độ hiện tại).
- `main.js`: `onChange(shown)` như cũ gọi `reveal.replay`; thêm: `shown` có panel lịch → `calendar.scrollToNow()`.

### 6.2. `scrollToNow()` (view)

Vạch now đang hiện → `scrollIntoView({ block: 'center', behavior })`, `behavior` là `instant` khi giảm chuyển động, không thì `smooth`. Vạch ẩn → không làm gì (thanh tab đã đưa đầu lịch lên).

### 6.3. Cập nhật mỗi tick (`controllers/status.js`)

- `startStatus({ …, calendar })`. Mỗi tick, sau vòng lặp `.item`:
  ```js
  calendar.update({ currentId, pastIds, todayId, mark: nowMark(calModel, now, trip.timezone) })
  ```
  `calModel` do `main.js` dựng một lần, truyền cùng `calendar`.
- `update` chỉ đổi class, `aria-label`, `data-today`, `--top`, `hidden` khi giá trị khác lần trước. `mark` khác `null` → chuyển `.cal-now` vào `.cal-col` có `data-day-id === mark.dayId`.
- **Tự theo khung mới:** panel lịch đang hiện (`!calendar.panel.hidden`) → bỏ qua cả `move` lẫn `hint`; lịch tự sáng khối lime. `jumpToLive` lúc mở trang giữ nguyên (vẫn mở tab ngày).
- `startStatus` trả `{ show(itemId) }`: tìm `item` theo id → `moveTo(item, { openDay: true, flash: true })`.

### 6.4. Bấm khối / tiêu đề (`controllers/calendar.js`)

`startCalendar({ view, tabs, show, tabbar })`:

- Click ủy quyền trên `view.panel`: `.cal-block` → `show(id)`; `.cal-day` → `tabs.select(dayId, { user: true })`.
- `--tabbar-h`: `ResizeObserver` trên `tabbar` → `view.panel.style.setProperty('--tabbar-h', offsetHeight + 'px')`; không có `ResizeObserver` thì đặt một lần.

`moveTo(item, { openDay, flash })` thêm, sau khi cuộn:

1. `el.focus({ preventScroll: true })`. `renderItem` thêm `tabindex="-1"` cho `.item`; CSS `.item:focus { outline: none }` (nháy thay cho viền focus).
2. `flash` → bỏ rồi thêm lại class `is-flash` (đọc `offsetWidth` giữa hai lần để chạy lại animation), gỡ sau 1.200ms.
3. CSS:
   - `prefers-reduced-motion: no-preference` → `.item.is-flash .card { animation: flash .6s ease-out 2 }`.
   - Giảm chuyển động → `.item.is-flash .card { box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .45) }`.
   - `keyframes.css`: `@keyframes flash { 0% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), .6) } 100% { box-shadow: 0 0 0 8px rgba(var(--accent-rgb), 0) } }`.
- Thẻ chưa hiện (còn `.reveal`, chưa `.in`) → `reveal.settle(el)` bỏ hiệu ứng vào cho thẻ đó trước khi nháy, để vòng nháy đầu không chạy khi thẻ còn ẩn.

## 7. Nối vào trang (`main.js`)

```js
const calModel = buildCalendar(trip);
const calendar = createCalendar(calModel);
// main: calendar.switcher, …day panels, calendar.panel, fund?.panel, footer
```

- `startReveal` không đổi: `TARGETS` là `.day-head, .item`, khối lịch không bị ẩn.
- `startStatus` tìm `.item[data-id]`, không gặp `.cal-block[data-id]`.
- `createTabs(…, { onChange, switcher: calendar.switcher, storage: safeStorage() })`, với `safeStorage()` trả `window.localStorage` hoặc `null` nếu truy cập ném lỗi.
- `startCalendar({ view: calendar, tabs, show: status.show, tabbar })`.
- `startStatus({ …, calendar, calModel, reveal })`.

## 8. File

| File | Thay đổi |
|---|---|
| `js/lib/time.js` | thêm `localMinuteOf(ms, timezone)` |
| `js/model/calendar.js` | **mới** — `buildCalendar`, `nowMark` |
| `js/views/calendar.js` | **mới** — `createCalendar` → `{ panel, switcher, update, scrollToNow }` |
| `js/controllers/calendar.js` | **mới** — `startCalendar` |
| `js/views/tabs.js` | `CALENDAR_PANEL`; `aria-controls` của `Tất cả` |
| `js/views/day.js` | `.item` thêm `tabindex="-1"` |
| `js/views/fund.js` | class `switch books-switch` / `switch-btn` |
| `js/controllers/tabs.js` | `panelShown`, `readView`, `setView`, `view()`, bấm lại `Tất cả` để đổi chế độ, dòng chữ chế độ |
| `js/controllers/status.js` | gọi `calendar.update`; bỏ qua follow khi đang xem lịch; trả `show`; `flash` + focus |
| `js/main.js` | dựng và nối lịch |
| `css/calendar.css` | **mới** — công tắc xem, panel, khối, trạng thái, vạch now |
| `css/base.css` | `.switch`, `.switch-btn` |
| `css/fund.css` | bỏ `.book-tabs`/`.book-tab`, thêm `.books-switch { margin-bottom: 12px }` |
| `css/timeline.css` | `.item:focus`, `.item.is-flash .card` |
| `css/motion/keyframes.css` | `@keyframes flash` |
| `index.html` | `<link rel="stylesheet" href="css/calendar.css">` sau `timeline.css` |
| `tests/calendar.test.js` | **mới** — xem 9.1 |
| `tests/tabs.test.js` | **mới** — `panelShown`, `readView` |
| `tests/time.test.js` | `localMinuteOf` |
| `README.md` | mục 2 (công tắc), mục mới "Lịch biểu", mục 5, bảng kiểm thử, cấu trúc thư mục, tài liệu |

## 9. Kiểm thử

### 9.1. Unit test (`npm test`)

Ca dùng `trip.json` đọc file thật như `status.test.js`. Ca làm tròn, làn, ngày trống dựng trip nhỏ qua `buildTrip` (không có `fund`, nên không vướng luật trùng tên).

| File | Ca kiểm |
|---|---|
| `time.test.js` | `localMinuteOf`: `2026-10-16T12:00+07:00` → 720; cùng thời điểm viết theo UTC vẫn 720; qua nửa đêm theo múi giờ chuyến (`2026-10-16T17:30Z` → 30) |
| `calendar.test.js` | Khung giờ từ `trip.json`: `startMinute 420`, `endMinute 1320`, 16 nhãn, nhãn đầu `07:00`, cuối `22:00` |
| | Làm tròn: khung sớm nhất `07:30` → 420; muộn nhất `21:30` → 1320; đúng `22:00` → 1320 |
| | Vị trí: `day-1-item-1` → `top 0, height 120, lane 0, lanes 1`; khối cuối ngày 3 (`12:15–13:00`) → `top 315, height 45` |
| | Ngày không có khung → `blocks: []` |
| | Làn: A 9–11, B 10–12, C 11–13 → làn 0/1/0, `lanes 2`; A 9–10, B 10–11 → cả hai `lane 0, lanes 1` |
| | `nowMark`: `2026-10-16T12:00+07:00` → `{ dayId: 'day-1', top: 300 }`; `2026-10-19T12:00+07:00` → `null`; `06:59` → `null`; `22:01` → `null`; `22:00` → `top 900` |
| `tabs.test.js` | `panelShown` cho `all+list`, `all+calendar`, tab ngày, tab quỹ với mọi `key` |
| | `readView`: `'calendar'`, `'list'`, `'xyz'`, `null` storage, `getItem` ném lỗi |

### 9.2. Trình duyệt

Chrome headless qua CDP, 360 / 390 / 430 / 1440px, bật và tắt `prefers-reduced-motion`:

1. Không cuộn ngang ở chế độ Lịch.
2. Khối thẳng hàng vạch giờ; `07:00–09:00` cao ~118px ở 390px, ~142px ở 1440px.
3. `?now=`:
   - `2026-10-16T12:00` → Gà nướng lime, khối trước xám, vạch now ở cột ngày 1.
   - `2026-10-16T12:30` → không khối lime, có vạch.
   - `2026-10-19T00:00` → tất cả xám, không vạch.
   - Trước chuyến → không trạng thái, không vạch, không chấm hôm nay.
4. Hàng tiêu đề ngày dính ngay dưới thanh tab khi cuộn.
5. Bấm khối → tab đúng ngày, thẻ giữa màn hình, nháy, được focus. Quay `Tất cả` → vẫn Lịch. Tải lại → vẫn Lịch. `localStorage` bị chặn → Danh sách, không lỗi console.
6. Đang ở Lịch, để yên 30 giây, khung mới bắt đầu → không bị chuyển tab, không hiện nút `📍 Đang diễn ra`.
7. Bật Lịch lúc `?now=2026-10-16T17:00` → vạch now vào giữa màn hình.
8. Bàn phím: Enter trên tab `Tất cả` đang mở đổi chế độ; Tab tới khối, Enter hoạt động; `←` `→` trên thanh tab chỉ chọn tab, không đổi chế độ.
9. Giảm chuyển động → khối lime không nhấp nháy; thẻ nhảy tới có viền tĩnh.
10. Thêm ngày 4 và 7 ngày vào data → cột hẹp lại, không cuộn ngang, icon vẫn thấy.
11. Tab Quỹ: công tắc `Sổ chi | Góp quỹ` giống hệt trước.
12. Animation reveal của danh sách vẫn chạy khi chuyển Lịch → Danh sách.
