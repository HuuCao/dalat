# Đà Lạt Trip Plan — Render động từ dữ liệu

- **Ngày:** 2026-09-11
- **Trạng thái:** Chờ duyệt
- **Phạm vi:** Tái cấu trúc `index.html` (1 file, ~309KB) thành trang tách file, render toàn bộ từ `data/trip.json`, kèm animation: nội dung ngày hiện ra theo thời gian khi cuộn tới / đổi tab, hero và thanh tiến trình gắn theo cuộn (2 lớp A/B).

## 1. Bối cảnh

`index.html` hiện được viết để chạy **không cần JavaScript** (xem trước trong Zalo / iOS Quick Look). Vì vậy nội dung và hành vi bị viết cứng:

| Vấn đề | Vị trí hiện tại |
|---|---|
| Tabs = 4 radio ẩn + selector CSS riêng từng ngày | `#day-1:checked ~ main #panel-1` … |
| 13 khối `.item` copy tay, id `v1`…`v9` đánh số tay | `<main>` |
| Số liệu gõ tay, có chỗ sai (`13 điểm`, thực tế 9) | `.day-count`, `.cd-clock`, `.cd-note` |
| Chuỗi ngày viết cứng trong script | `'Th 6 16/10'` trong `update()` |
| Delay animation cứng, chỉ đủ 12 item | `.item:nth-child(1…12)` |
| Animation chỉ chạy một lượt lúc load, không phản ứng theo scroll | `@keyframes rise*` |
| Ảnh ~270KB base64 trong CSS, không cache được | `.hero-bg`, `.thumb-a`, `.thumb-b` |
| Lỗi markup | `id="panel-1"1`, `"panel-2"2`, `"panel-3"3` |
| Màu lệch palette | `rgba(106, 153, 78, …)` |

Trang giờ chạy trên GitHub Pages (https://huucao.github.io/dalat/) nên được dùng JavaScript thoải mái. Người nhận mở **link**, không mở file đính kèm.

## 2. Mục tiêu

1. Toàn bộ nội dung nằm trong `data/trip.json`. Thêm/sửa/xóa ngày hoặc điểm **chỉ cần sửa JSON**, không đụng HTML/CSS/JS.
2. Mọi số liệu và nhãn suy ra được (số ngày, số điểm, khung trống, khoảng giờ, thứ/ngày, buổi) do code tính.
3. Code tách module rõ trách nhiệm: dữ liệu → model → view → controller.
4. Giao diện tĩnh giữ nguyên như bản hiện tại.
5. Animation: nội dung từng ngày hiện ra theo thời lượng cố định khi cuộn tới hoặc đổi tab (mọi trình duyệt); hero, bóng tabbar, thanh tiến trình gắn theo vị trí cuộn — CSS scroll-driven khi hỗ trợ, rAF khi không (mục 10).
6. **Mobile-first:** điện thoại là môi trường xem chính, desktop vẫn đẹp; ảnh nét ở mọi màn hình mà điện thoại không tải thừa (mục 9.1).

## 3. Ngoài phạm vi

- Nút "Đã đến" và mọi lưu trữ (localStorage, đồng bộ server) — **bỏ hẳn**.
- Chạy khi không có JavaScript: iOS Quick Look, mở file bằng `file://`. Nội dung do JS render nên môi trường chặn JS chỉ thấy thông báo `<noscript>`. Cách xử lý: gửi link GitHub Pages thay vì gửi file.
- Vì vậy **lớp C (cascade lúc load dành cho môi trường không JS) không làm**. Chỉ giữ animation vào trang cho hero và thanh tab (mục 10.4).
- Build tool, framework, dependency runtime.
- Sửa lịch trình ngay trên trang, tab theo URL hash.

## 4. Cấu trúc thư mục

```
index.html                  khung trang: script chọn lớp animation trong <head>, .progress,
                            vùng mount rỗng, <link> CSS, <script type="module">
data/trip.json              toàn bộ nội dung
assets/img/                 hero-{800,1600,2560}.jpg, thumb-{a,b}-{240,480}.jpg (Unsplash, nhiều cỡ cho srcset)
css/
  tokens.css                biến màu, radius, shadow
  base.css                  reset, body, .wrap, footer, .progress, trạng thái lỗi
  hero.css
  tabs.css
  timeline.css              .day, .item, .card, .empty, .is-now, .is-past
  countdown.css             panel đếm ngược + hourglass
  motion/
    keyframes.css           toàn bộ @keyframes
    load.css                animation vào trang của hero + tabs (mọi trình duyệt)
    scroll-timeline.css     lớp A — hero, bóng tabbar, thanh tiến trình theo cuộn (@supports)
    reveal.css              reveal nội dung ngày theo thời gian (mọi trình duyệt)
js/
  main.js                   điểm vào: fetch JSON → buildTrip → render → start controllers
  model/trip.js             buildTrip(raw): kiểm tra + chuẩn hóa + tính số liệu (thuần, không DOM)
  model/status.js           getStatus(trip, now): trạng thái đếm ngược (thuần, không DOM)
  lib/dom.js                h(tag, props, ...children): tạo element an toàn
  lib/time.js               parse/format giờ, thứ, suy ra buổi, template {days}/{nights}
  lib/motion.js             hasScrollTimeline(), prefersReducedMotion(), scrollFx() (thuần)
  lib/clock.js              createClock(search, now): đồng hồ thật hoặc giả lập ?now= (thuần)
  views/hero.js
  views/tabs.js
  views/day.js              panel ngày + timeline + card
  views/countdown.js
  views/footer.js
  views/error.js
  controllers/tabs.js       chuyển tab, bàn phím
  controllers/status.js     vòng tick: is-now / is-past / cập nhật countdown
  controllers/reveal.js     reveal theo IntersectionObserver, chạy lại khi đổi tab
  controllers/scroll-fx.js  lớp B: parallax hero + progress bằng rAF
tests/
  time.test.js
  trip.test.js
  status.test.js
  motion.test.js
  clock.test.js
package.json                { "type": "module", scripts: test, dev } — 0 dependency
README.md                   chạy local, test, schema trip.json, cách thêm ngày/điểm
```

`.hero-bg` và `.thumb` là `<img srcset>` sinh từ JSON (mục 9.1), không còn base64 hay `background-image`.

## 5. Schema `data/trip.json`

```json
{
  "timezone": "+07:00",
  "hero": {
    "eyebrow": "✦ Travel plan · Đà Lạt",
    "title": "Đà Lạt",
    "subtitle": "Đà Lạt {days} ngày {nights} đêm — Let's go",
    "chips": ["🌿 Nature", "☕ Chill", "📸 Check-in"],
    "image": { "src": "assets/img/hero-{w}.jpg", "widths": [800, 1600, 2560] },
    "thumbs": [
      { "src": "assets/img/thumb-a-{w}.jpg", "widths": [240, 480] },
      { "src": "assets/img/thumb-b-{w}.jpg", "widths": [240, 480] }
    ]
  },
  "days": [
    {
      "date": "2026-10-16",
      "icon": "🌿",
      "note": "Sáng → Trưa → Chiều → Tối",
      "items": [
        { "start": "07:00", "end": "09:00", "icon": "🍃", "title": "Đồi chè Cầu Đất", "tag": "Nature", "map": "Đồi chè Cầu Đất Đà Lạt" },
        { "start": "19:30", "end": "21:00", "icon": "🍜", "title": "Ăn tối — Chưa chọn", "empty": true }
      ]
    }
  ],
  "footer": {
    "title": "Đà Lạt Trip Plan · {days} Days · ✦",
    "note": "Công ty TNHH Du lịch & Sự kiện Lần Này 4 Đứa (10/2026)"
  }
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `timezone` | có | Offset dạng `+07:00`, áp cho mọi giờ trong file |
| `hero.image`, `hero.thumbs[]` | không | `{ src, widths }`: `src` chứa `{w}`, mỗi số trong `widths` là một file có sẵn (vd. `hero-1600.jpg`). Model sinh `srcset` |
| `days[].date` | có | `YYYY-MM-DD` |
| `days[].icon`, `note` | không | `note` nối vào cuối dòng ngày |
| `items[].start`, `end` | có | `HH:MM`, `end > start`, cùng ngày |
| `items[].title` | có | |
| `items[].icon` | không | Ghép trước title |
| `items[].tag` | không | Chữ nhỏ ở footer card |
| `items[].map` | không | Chuỗi tìm kiếm Google Maps; có thì hiện link `📍 Maps` |
| `items[].empty` | không | `true` = khung trống (card nét đứt, không tính là điểm) |
| `{days}`, `{nights}` | — | Placeholder dùng được trong `hero.subtitle`, `footer.title` |

Khi build model, `items` được sắp theo `start`, `days` theo `date`.

## 6. Model (`js/model/`)

### `buildTrip(raw) → Trip`

Hàm thuần. Kiểm tra dữ liệu, ném `Error` có thông điệp chỉ rõ vị trí sai (vd. `days[1].items[0].end: phải sau start`).

```
Trip {
  timezone, hero, footer            (placeholder đã thay)
  hero.image: ImageSet | null       ImageSet { src (file lớn nhất), srcset "…-800.jpg 800w, …" }
  hero.thumbs: ImageSet[]
  dayCount, nightCount              nightCount = max(dayCount - 1, 0)
  placeCount                        số item không empty
  start, end                        Date: start item đầu, end item cuối
  items: Item[]                     phẳng, theo thứ tự thời gian
  days: Day[]
}
Day  { index (1-based), id "day-1", date, label "Day 1", icon,
       dateText "Th 6, 16/10", rangeText "07:00 → 21:00", note,
       placeCount, emptyCount, countText "7 điểm · 1 khung trống", items }
Item { id "day-1-item-3", dayId, order (0-based trong ngày),
       start/end (Date), startText, endText,
       period, icon, title, tag, mapUrl | null, empty }
```

- `countText`: bỏ vế bằng 0 (`"1 điểm"`, `"2 khung trống"`); cả hai bằng 0 → `"Chưa có lịch"`.
- `mapUrl` = `https://www.google.com/maps/search/?api=1&query=` + `encodeURIComponent(map)`.

### `lib/time.js`

- `toDate(date, hhmm, timezone)` → `new Date(\`${date}T${hhmm}:00${timezone}\`)`.
- `weekdayText(date)` → bảng cố định `CN, Th 2 … Th 7` (không phụ thuộc `Intl` của trình duyệt), thứ lấy từ `new Date(Date.UTC(y, m - 1, d)).getUTCDay()` nên không phụ thuộc múi giờ máy xem.
- `derivePeriod(start, end)` — theo giờ địa phương của chuyến đi (chuỗi `HH:MM`):
  - Buổi: sáng `< 11:00`, trưa `11:00–12:59`, chiều `13:00–17:59`, tối `≥ 18:00`.
  - Xét buổi của `start` và của `end − 1 phút`. Giống nhau → `"Buổi sáng"`; khác → `"Trưa → chiều"`.
  - Thay đổi so với nhãn gõ tay hiện tại (chấp nhận): `14:15–16:00` → Buổi chiều, `16:30–17:45` → Buổi chiều, `18:00–19:00` → Buổi tối.
- `fillTemplate(str, vars)` thay `{key}`.

### `getStatus(trip, now) → Status`

Hàm thuần, thay cho nhánh `if` trong `update()` cũ.

```
Status {
  phase: "soon" | "live" | "done"
  current: Item | null          item có start ≤ now < end
  next: Item | null             item đầu tiên có now < start
  pastPlaces: number            số item không empty có end ≤ now
  remainingMs: number           chỉ dùng khi soon
  pastIds: Set<string>          item có end ≤ now
}
```

Giữ nguyên nội dung hiển thị cũ, chỉ thay phần viết cứng:

| phase | Nhãn | Hàng chính | Ghi chú |
|---|---|---|---|
| soon | Đếm ngược khởi hành | ô ngày/giờ/phút/giây (bỏ đơn vị 0 ở đầu, giữ tối thiểu 2) | `Đà Lạt đang chờ · bắt đầu {startText} · {dateText ngày 1}` |
| live, có current | Đang diễn ra | title current | `Đến {endText} · đã qua {pastPlaces}/{placeCount} điểm` |
| live, không current | Đang di chuyển | title next, hoặc `Nghỉ giữa chặng` | `Tiếp theo lúc {startText} · đã qua …` |
| done | Hành trình đã khép lại | `Hẹn gặp lại Đà Lạt ✦` | `Đã đi qua {placeCount} điểm trong {dayCount} ngày` |

"Đà Lạt" trong câu soon/done lấy từ `hero.title`.

## 7. View (`js/views/`)

- Mọi view là hàm `render*(data) → HTMLElement`, dùng `h()`; text từ data luôn gán qua `textContent`. Không dùng `innerHTML` với dữ liệu.
- Markup và class giữ như bản cũ để CSS tái sử dụng, trừ các phần bị bỏ (`.day-radio`, `.visit*`).
- `renderDay(day)` → `<section class="panel" id="panel-day-1" role="tabpanel" aria-labelledby="tab-day-1">` bọc `<article class="day">`. Mỗi `.item` có `data-id` và `style="--i: {order}"`.
- **Ràng buộc markup mà CSS animation dựa vào** (không được phá khi sửa view):
  - `.day-head` đứng **ngay trước** `.timeline` (lớp B dùng `.day-head.in + .timeline::before`).
  - `.item` là **con trực tiếp** của `.timeline`, không có phần tử khác xen giữa (`:nth-child(odd/even)` quyết định hướng bay).
- Link Maps có `target="_blank" rel="noopener noreferrer"`.
- `renderHero` dựng `<img class="hero-bg">` và `<img class="thumb">` theo mục 9.1 (ảnh trang trí nên `alt=""`).
- `createCountdown() → { element, update(description, phase) }`: dựng panel một lần (hourglass SVG giữ nguyên); `update` chỉ thay label/clock/note. Chữ hiển thị do `describeStatus(trip, status)` trong `model/status.js` tính (thuần, có test).
- Bỏ trạng thái tĩnh ban đầu của panel (`Lịch khởi hành` + ô `3 ngày / 2 đêm / 13 điểm`): trước đây chỉ để hiện khi không có JS, có JS thì luôn bị ghi đè ngay.
- `renderError(message)` → hộp thông báo `Không tải được lịch trình` trong `<main>`.

## 8. Controller (`js/controllers/`)

### Tabs

- `<div role="tablist">` gồm `Tất cả` + mỗi ngày một `<button role="tab" id="tab-day-N" aria-selected>`.
- Chọn tab: đặt `aria-selected`, `tabindex` (roving), bật `hidden` cho panel không thuộc tab. `Tất cả` hiện mọi panel.
- Phím ← → Home End di chuyển giữa các tab.
- API: `createTabs(tablist, panels, { onChange }) → { select(id) }`, mặc định `all`.
- Khi người dùng chọn tab: đưa ngày được chọn lên ngay dưới thanh tab nếu đang cuộn quá nó, rồi `onChange(panelsĐangHiện)` để chạy lại reveal (mục 10.5).

### Status

- `startStatus({ trip, root, countdown, tabs, clock })` — `root` chứa các `.item`, `countdown` là panel đếm ngược, `clock()` trả thời điểm hiện tại (ms).
- Mỗi tick: `getStatus(trip, clock())` → toggle `.is-now` / `.is-past` trên `.item[data-id]`, thêm/bỏ `.now-tag`, cập nhật countdown, toggle class `soon` / `live` trên panel.
- Tick 1s khi `phase === "soon"`, ngược lại 15s (như cũ).
- Lần đầu, nếu `phase === "live"`: `tabs.select(dayId của current ?? next)`, sau 400ms `scrollIntoView({ behavior: "smooth", block: "center" })`.

### Reveal và Scroll FX

Xem mục 10.5.

## 9. CSS và responsive

- Tách theo bảng ở mục 4, nạp bằng nhiều `<link>` (không `@import`) theo thứ tự: `tokens → base → hero → tabs → timeline → countdown → motion/keyframes → motion/load → motion/scroll-timeline → motion/reveal`. Thứ tự này có ý nghĩa: rule lớp A đứng sau `load.css` nên ghi đè `animation` trên phần tử dùng chung.
- Bỏ: `.day-radio`, mọi selector `#day-N:checked`, `.visit-toggle`, `.visit`, `.card-footer .visit:last-child`, 12 rule `.item:nth-child(N)` delay, keyframes `rise-left`, `dot-in`, `line-in`.
- Panel ẩn bằng thuộc tính `hidden`.
- `.day { overflow: hidden; overflow: clip }` — `clip` để không tạo scroll container, `hidden` là fallback (xem lỗi 6 và 13, mục 10.7).
- `.is-past` dùng lại đúng style của trạng thái "đã tick" cũ: card nền `#f3f9f4`, viền `#c9e1d0`, `h3` màu `#74897c`, `.clock` opacity `.55`, `.dot` màu `--primary`.
- Thêm token `--accent-rgb: 82, 121, 111` (= `--accent`), thay mọi `rgba(106, 153, 78, a)` (kể cả trong keyframes) bằng `rgba(var(--accent-rgb), a)`.
- Xóa comment nói về "không JavaScript / Quick Look" vì không còn đúng.

### 9.1 Mobile-first

Điện thoại là môi trường xem chính (≈ 390px, DPR 3). Desktop giữ giao diện hiện tại.

- **CSS mobile-first:** style gốc viết cho điện thoại; phần desktop nằm trong `@media (min-width: 761px)`, thay cho các khối `max-width: 760px` hiện tại. Cùng điểm gãy nên desktop không đổi.
- **Ảnh nét, đúng cỡ:**
  - Hero: `<img class="hero-bg" srcset sizes="130vw" alt="" fetchpriority="high" decoding="async">` + `object-fit: cover`. `130vw` đã tính hệ số zoom 1.3 của parallax: iPhone 390 × DPR 3 × 1.3 ≈ 1521px → tải `hero-1600`; desktop 1440 × DPR 2 → `hero-2560`.
  - Thumb: `<img class="thumb" srcset sizes="92px" alt="" loading="lazy" decoding="async">`. `.hero-thumbs` ẩn trên điện thoại nên ảnh lazy không bao giờ được tải.
  - Chất lượng: hero q=85, thumb q=90 (crop 4:3).
- **Vùng chạm ≥ 44px:** `.tab` có `min-height: 44px`; link `📍 Maps` nới vùng chạm bằng padding + margin âm, không đổi bố cục.
- **Hover chỉ trên thiết bị có chuột:** `.card:hover`, `.empty:hover`, `.tab:hover`, `.map-btn:hover` nằm trong `@media (hover: hover)`, tránh hiệu ứng "dính" sau khi chạm trên iOS.
- **Tabs co giãn theo số ngày:** `grid-auto-flow: column; grid-auto-columns: minmax(64px, 1fr); overflow-x: auto` (ẩn thanh cuộn). Nhiều ngày thì vuốt ngang; khi **người dùng** chọn tab (click/phím), gọi `scrollIntoView({ block: 'nearest', inline: 'nearest' })` cho tab đó. Không gọi lúc khởi tạo.
- `<meta name="theme-color" content="#2d4a3e">` cho thanh trình duyệt. Không chặn zoom (không dùng `maximum-scale`).
- Không cuộn ngang ở mọi độ rộng: `scrollWidth === clientWidth` tại 360px, 390px, 430px, 1440px.

## 10. Animation

### 10.1 Ba cơ chế

| Cơ chế | Phần tử | Kỹ thuật | Trình duyệt |
|---|---|---|---|
| **Vào trang** | chữ + chip hero, thanh tab, panel khi đổi tab | keyframes theo thời gian (mục 10.4) | mọi trình duyệt |
| **Reveal** | tiêu đề ngày, mốc, chấm, đường dọc | IntersectionObserver gắn `.in` → keyframes theo thời gian, chạy lại khi đổi tab (mục 10.5) | mọi trình duyệt |
| **Theo cuộn** | ảnh hero, lớp phủ, chữ hero, thumbnail, bóng tabbar, thanh tiến trình | lớp A: `animation-timeline: scroll()` (mục 10.3); lớp B: rAF + `scrollFx()` (mục 10.5) | A: Chrome/Edge 115+, Safari 26+ · B: còn lại |

Nội dung ngày **không** gắn theo cuộn. Animation gắn vị trí cuộn không có thời lượng: vuốt nhanh là lướt qua, đổi tab thì mốc đã nằm sẵn trong khung nhìn nên không có hiệu ứng, còn kéo dài range thì kẹt ở cuối trang (lỗi 14–15). Hero, thanh tiến trình và bóng tabbar vẫn gắn theo cuộn vì chúng mô tả chính vị trí cuộn.

Chọn lớp A/B cho hiệu ứng theo cuộn bằng script inline đặt **cuối `<head>`**, chạy trước lần paint đầu:

```html
<script>
  if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'))) {
    document.documentElement.classList.add('no-scroll-timeline');
  }
</script>
```

- Hỗ trợ → không có class → lớp A (CSS trong `@supports`) tự chạy.
- Không hỗ trợ → `html.no-scroll-timeline` → `startScrollFx` chạy lớp B.
- Tên class `no-scroll-timeline` thay cho `js` của bản mô tả gốc: mọi người xem đều có JS nên `js` gây hiểu nhầm. Module đọc class qua `hasScrollTimeline()` trong `lib/motion.js`, không dùng biến global.
- Phải nằm trong `<head>`: đặt cuối `<body>` thì CSS kịp paint vài frame với lựa chọn sai rồi mới đổi, thấy như một cú giật.

### 10.2 Keyframes (`motion/keyframes.css`)

```css
/* ---------- ENTRANCE (reveal.css) ---------- */
/* Played on a fixed duration when day content reaches the viewport. */

/* Odd and even entries swing in from opposite sides, with 3D depth. */
@keyframes swing-left {
  from { opacity: 0; transform: translate3d(-46px, 34px, -90px) rotateY(14deg) rotateZ(-2deg); }
  to { opacity: 1; transform: none; }
}

@keyframes swing-right {
  from { opacity: 0; transform: translate3d(46px, 34px, -90px) rotateY(-14deg) rotateZ(2deg); }
  to { opacity: 1; transform: none; }
}

@keyframes head-in {
  from { opacity: 0; transform: translateY(26px) scale(.94); }
  to { opacity: 1; transform: none; }
}

/* Overshoots, settles, and throws a ring of light. `to` has no box-shadow on
   purpose: the last keyframe lands on the dot's own shadow, so the .is-now /
   .is-past rings never jump when the pop ends. */
@keyframes pop {
  from { opacity: 0; transform: scale(0); box-shadow: 0 0 0 14px rgba(var(--accent-rgb), 0); }
  60% { opacity: 1; transform: scale(1.45); box-shadow: 0 0 0 7px rgba(var(--accent-rgb), .28); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes draw {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* ---------- SCROLL-LINKED (scroll-timeline.css) ---------- */

/* Zoom out and drift down. No edge is uncovered while
   scale × |translateY| ≤ (scale − 1) / 2: start 1.3 × 5% = 6.5% ≤ 15%,
   end 1.12 × 5% = 5.6% ≤ 6%. Mirrored by heroParallax() in js/lib/motion.js. */
@keyframes hero-parallax {
  from { transform: scale(1.3) translateY(-5%); }
  to { transform: scale(1.12) translateY(5%); }
}

/* Opacity above 1 is clamped, so darkening starts lighter instead. */
@keyframes hero-darken {
  from { opacity: .85; }
  to { opacity: 1; }
}

@keyframes hero-lift {
  from { opacity: 1; transform: none; filter: blur(0); }
  to { opacity: 0; transform: translateY(-48px) scale(.92); filter: blur(5px); }
}

@keyframes thumbs-out {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translate3d(60px, -20px, 0) rotate(7deg); }
}

@keyframes bar-settle {
  from { box-shadow: 0 0 0 rgba(0, 0, 0, 0); }
  to { box-shadow: 0 6px 18px rgba(16, 30, 25, .12); }
}

@keyframes progress-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* ---------- LOAD (load.css) ---------- */
/* `from` only, used with fill-mode backwards: the end state is the
   element's normal style, so nothing can get stuck hidden. */

@keyframes rise { from { opacity: 0; transform: translateY(26px); } }
@keyframes rise-right { from { opacity: 0; transform: translate3d(34px, 20px, 0); } }
@keyframes bg-in { from { opacity: 0; transform: scale(1.22); } }
@keyframes fade { from { opacity: 0; transform: translateY(6px); } }
```

So với bản mô tả gốc: màu trong `pop` dùng token, `pop` bỏ `box-shadow` ở `to`, `hero-parallax` kết thúc ở `translateY(5%)` thay vì `6%`. `swing-*`, `head-in`, `pop`, `draw` nay chạy theo thời gian (reveal) thay vì theo cuộn.

### 10.3 Lớp A — `motion/scroll-timeline.css`

Mọi trạng thái ẩn đều nằm trong `@supports`. Trình duyệt không hiểu `animation-timeline` bỏ qua cả khối, nội dung không bao giờ kẹt ở `opacity: 0`.

```css
/* Layer A: effects that describe the scroll position itself - hero, tab bar
   shadow, reading progress. Every hidden starting state lives inside
   @supports, so a browser without animation-timeline skips the whole block;
   scroll-fx.js plays the same numbers there (scrollFx() in js/lib/motion.js).
   Day content does not scrub with scroll - it would flash past on a quick
   swipe and never play on a tab switch. See reveal.css. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    /* Resting style = each animation's starting frame. A page too short to
       scroll (a short tab on a tall screen) has an inactive scroll timeline
       and the animations stop applying; without these two lines the hero
       would drop to its base zoom and overlay on that tab only. */
    .hero-bg { transform: scale(1.3) translateY(-5%); }
    .hero-overlay { opacity: .85; }

    .progress {
      animation: progress-grow linear both;
      animation-timeline: scroll(root block);
    }

    .hero-bg {
      animation: hero-parallax linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 480px;
    }

    .hero-overlay {
      animation: hero-darken linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 420px;
    }

    .hero-inner {
      animation: hero-lift linear both;
      animation-timeline: scroll(root block);
      animation-range: 40px 360px;
    }

    .hero-thumbs {
      animation: thumbs-out linear both;
      animation-timeline: scroll(root block);
      animation-range: 0 300px;
    }

    .tabbar {
      animation: bar-settle linear both;
      animation-timeline: scroll(root block);
      animation-range: 120px 220px;
    }
  }
}
```

| Phần tử | Timeline | Range | Hiệu ứng |
|---|---|---|---|
| `.progress` | scroll root | toàn trang | scaleX 0 → 1 |
| `.hero-bg` | scroll root | 0 → 480px | zoom 1.3 → 1.12, trôi xuống |
| `.hero-overlay` | scroll root | 0 → 420px | tối dần |
| `.hero-inner` | scroll root | 40 → 360px | bay lên + blur 5px |
| `.hero-thumbs` | scroll root | 0 → 300px | văng chéo + xoay 7° |
| `.tabbar` | scroll root | 120 → 220px | hiện bóng đổ |

Cuộn ngược thì các hiệu ứng này chạy ngược.

### 10.4 Animation vào trang — `motion/load.css`

Chạy ở mọi trình duyệt.

```css
/* Entrance when the page opens, in every browser. Rules in
   scroll-timeline.css load later and take over .hero-bg and .hero-thumbs
   where scroll-driven animation is supported. */
@media (prefers-reduced-motion: no-preference) {
  .hero-bg { animation: bg-in 1.1s var(--ease-out) backwards; }

  .eyebrow,
  h1,
  .subtitle,
  .chips {
    animation: rise .75s var(--ease-out) backwards;
  }

  .eyebrow { animation-delay: .04s; }
  h1 { animation-delay: .09s; }
  .subtitle { animation-delay: .14s; }
  .chips { animation-delay: .19s; }

  .hero-thumbs { animation: rise-right .8s var(--ease-out) .24s backwards; }

  .tabs { animation: rise .6s var(--ease-out) .28s backwards; }

  /* A panel coming out of [hidden] replays this on every tab switch; its
     entries then play their own entrance (reveal.css). */
  .panel { animation: fade .35s var(--ease-out) backwards; }
}
```

- Ở lớp A, rule trong `scroll-timeline.css` nạp sau nên thay `animation` của `.hero-bg` và `.hero-thumbs` bằng bản theo cuộn; hai phần tử này không có hiệu ứng vào trang ở lớp A (chấp nhận).
- `.eyebrow`, `h1`, `.subtitle`, `.chips` là con của `.hero-inner` nên chạy chồng được với `hero-lift`.
- Mọi keyframe ở đây chỉ khai báo `from` + `backwards`: trạng thái cuối chính là style bình thường.

### 10.5 Reveal và lớp B theo cuộn

#### Reveal — `motion/reveal.css` (mọi trình duyệt)

```css
/* Entrance of each day's content, in every browser. startReveal() marks
   targets .reveal and adds .in once they reach the viewport - and again
   after a tab switch - so every entrance runs for a fixed duration however
   fast the page is scrolled. Without .reveal (no JS) or with reduced motion,
   nothing is hidden. Hidden states use opacity only; offsets live in the
   keyframes, so no specificity fight can leave an entry off to the side. */
@media (prefers-reduced-motion: no-preference) {
  .timeline { perspective: 900px; }

  /* Entries that reach the viewport together cascade (see startReveal). */
  .reveal { --reveal-delay: calc(min(var(--reveal-order, 0), 8) * var(--reveal-stagger)); }

  .reveal:not(.in) { opacity: 0; }

  .day-head.reveal.in {
    animation: head-in var(--reveal-duration) var(--ease-out) var(--reveal-delay) backwards;
  }

  .item.reveal.in {
    animation: swing-left var(--reveal-duration) var(--ease-out) var(--reveal-delay) backwards;
  }

  .item.reveal.in:nth-child(even) { animation-name: swing-right; }

  /* The dot pops a beat after its card lands. */
  .item.reveal:not(.in) .dot { transform: scale(0); }

  .item.reveal.in .dot {
    animation: pop .6s var(--ease-out) calc(var(--reveal-delay) + 250ms) backwards;
  }

  /* The rail draws once the day title above it is in. The rail is the
     title's sibling, not its child, so it cannot inherit --reveal-delay. */
  .day-head.reveal + .timeline::before { transform-origin: top center; }
  .day-head.reveal:not(.in) + .timeline::before { transform: scaleY(0); }

  .day-head.reveal.in + .timeline::before {
    animation: draw 1.4s var(--ease-out) 100ms backwards;
  }
}
```

| Phần tử | Keyframes | Thời lượng | Delay |
|---|---|---|---|
| `.day-head` | `head-in` | `--reveal-duration` (0.8s) | thứ tự trong đợt × `--reveal-stagger` (90ms), tối đa 8 bậc |
| `.item` lẻ / chẵn | `swing-left` / `swing-right` (3D, `perspective: 900px` trên `.timeline`) | 0.8s | như trên |
| `.dot` | `pop` | 0.6s | delay của mốc + 250ms |
| `.timeline::before` | `draw` | 1.4s | 100ms sau khi tiêu đề ngày có `.in` |

- Token `--reveal-duration` và `--reveal-stagger` nằm trong `tokens.css`; chỉnh tốc độ ở một chỗ.
- Trạng thái ẩn chỉ dùng `opacity` (và `scale(0)` cho chấm, `scaleY(0)` cho đường dọc); độ lệch, độ xoay nằm trong keyframes. Nhờ vậy không còn tranh chấp specificity kiểu lỗi 5.
- Keyframes chạy với `backwards`: khi xong, phần tử trở về style thật (vòng sáng `.is-now` không bị che).

#### Reveal — `controllers/reveal.js`

```
startReveal(root) → { replay(scope) }
```

- Gắn `.reveal` cho mọi `.day-head, .item` trong `root`. **Gọi đồng bộ ngay sau render**, cùng task, trước paint (lỗi 12).
- `IntersectionObserver` với `{ rootMargin: '0px 0px -10% 0px', threshold: 0.1 }`. Mỗi callback: lấy các phần tử đang giao, sắp theo thứ tự DOM, gán `--reveal-order` = vị trí trong đợt, thêm `.in`, `unobserve`. Nhiều phần tử lọt vào cùng lúc (lúc tải, lúc đổi tab) thì so le; phần tử lọt vào lẻ khi đang cuộn thì chạy ngay.
- Không có `IntersectionObserver`: thêm `.in` cho tất cả ngay, `replay` không làm gì.
- `replay(scope)`: gỡ `.in` của các mục trong `scope` rồi observe lại → lần giao kế tiếp chạy lại hiệu ứng.
- Panel ẩn bằng `hidden` không bao giờ giao với khung nhìn, nên mốc của tab chưa mở chờ tới khi tab được chọn.

#### Đổi tab — `controllers/tabs.js`

- `createTabs(tablist, panels, { onChange })`. Chỉ khi **người dùng** chọn tab (click, phím): cuộn ngang tab vào tầm nhìn; nếu trang đang cuộn quá đầu ngày đầu tiên được hiện thì nhảy tức thì (`behavior: 'instant'`) để ngày đó bắt đầu cách thanh tab 12px; rồi gọi `onChange(panelsĐangHiện)`.
- `main.js` nối `onChange` với `reveal.replay` cho từng panel đang hiện.
- Chọn tab do chương trình (khởi tạo, tự nhảy tới ngày đang đi) không cuộn và không replay.

#### Lớp B theo cuộn — `controllers/scroll-fx.js` + `lib/motion.js`

```
startScrollFx({ bar, bg, inner, thumbs }) → void
scrollFx(y, viewportHeight, scrollHeight) → { bar, bg, inner, thumbs }   // thuần, có test
```

- Thoát ngay nếu `hasScrollTimeline()` **hoặc** `prefersReducedMotion()`. Inline style do JS gán không bị `@media (prefers-reduced-motion)` chặn, nên JS phải tự kiểm tra (lỗi 11).
- Nghe `scroll` (`passive: true`) và `resize`; gom về tối đa 1 `requestAnimationFrame` mỗi frame; gọi 1 lần lúc khởi động.
- `scrollFx` dùng **cùng range và cùng số** với lớp A. Với `clamp01(x) = min(1, max(0, x))`:

| Đầu ra | Tiến trình | Style |
|---|---|---|
| `bar` | `p = clamp01(y / max(1, scrollHeight − viewportHeight))` | `transform: scaleX(p)` |
| `bg` | `d = clamp01(y / 480)` | `transform: scale(1.3 − .18d) translateY((−5 + 10d)%)` |
| `inner` | `l = clamp01((y − 40) / 320)` | `opacity: 1 − l`, `transform: translateY(−48l px) scale(1 − .08l)` (bỏ blur cho máy yếu) |
| `thumbs` | `t = clamp01(y / 300)` | `opacity: 1 − t`, `transform: translate3d(60t px, −20t px, 0) rotate(7t deg)` |

- Lớp B không làm `hero-overlay` tối dần và bóng đổ `.tabbar`.
- Bỏ qua phần tử `null` (vd. không có `thumbs` trong JSON).

### 10.6 `.progress`

- Phần tử tĩnh trong `index.html`, **con trực tiếp của `<body>`**, đứng trước mọi thứ.
- `position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); transform-origin: 0 50%; transform: scaleX(0); z-index: 30; pointer-events: none`.
- Không đặt bên trong `main`, `.hero-inner` hay phần tử nào có `perspective`, `transform`, `filter`: các thuộc tính đó biến tổ tiên thành containing block của `position: fixed`, thanh sẽ trôi theo nội dung (lỗi 10).
- Mặc định `scaleX(0)` là ngoại lệ có chủ đích với nguyên tắc "trạng thái ẩn phải có điều kiện": đây là trang trí, không phải nội dung.

### 10.7 Các lỗi đã biết — không được lặp lại

Lỗi 1–6 đã gặp khi dựng thật trên bản một file. Lỗi 7–12 phát hiện khi rà soát bản mô tả để đưa vào kiến trúc mới. Lỗi 13–15 phát hiện khi chạy kiểm thử Chrome headless và dùng thử. Lỗi 5, 7, 9, 14 thuộc cách làm cũ (reveal gắn theo cuộn / lớp B chỉ cho trình duyệt cũ), giữ lại để không lặp lại.

1. **`opacity` > 1 không có tác dụng.** Giá trị bị kẹp về 1. Muốn tối dần: `from { opacity: .85 } to { opacity: 1 }`.
2. **Animate `letter-spacing` gây reflow mỗi frame.** Với scroll-driven là reflow theo từng pixel cuộn, giật rõ trên điện thoại. Chỉ animate `transform`, `opacity`, `filter`, `box-shadow`.
3. **`view()` phản tác dụng với phần tử cao hơn khung nhìn.** Cho cả `.day` (~2000px) fade vào thì lúc load tiến trình mới ~14%, card hiện ở opacity .65 như lỗi render. Không animate `.day`; để các mốc con gánh chuyển động.
4. **Parallax hở mép nếu không tính.** `translateY(%)` trong `scale() translateY()` bị nhân hệ số scale. `scale(1.14) translateY(14%)` chỉ tràn 7% mỗi cạnh mà dịch 16% → hở dải ở mép trên. Điều kiện: `scale × |translateY| ≤ (scale − 1) / 2`.
5. **Specificity nuốt trạng thái kết thúc.** `.item.reveal:nth-child(odd)` (0,4,0) thắng `.reveal.in` (0,3,0), mốc lẻ kẹt lệch 38px. Viết selector `.in` dài ra cho thắng.
6. **Offset ngang tạo thanh cuộn ngang lúc load.** Mốc chẵn bắt đầu lố 38px ra mép phải, trang rộng thêm, iPhone chớp thanh cuộn ngang. Cắt tràn ở `.day` (dùng `overflow: clip`, xem lỗi 13); kiểm tra bằng `scrollWidth === clientWidth`.
7. **`fill-mode: both` giữ box-shadow cuối của `pop` mãi mãi.** Animation thắng mọi rule thường trong cascade, nên `to { box-shadow: … }` sẽ che vòng sáng của `.item.is-now .dot` và `.is-past .dot`. Bỏ `box-shadow` khỏi `to`.
8. **Bản mô tả gốc vẫn hở mép ở cuối parallax.** `scale(1.12) translateY(6%)`: tràn 6% mỗi cạnh nhưng dịch 1.12 × 6% = 6.72% → hở ~0.7% chiều cao hero (~2px) ở mép trên khi cuộn quá 480px. Lớp B gốc (`scale(1.12)`, `translateY(6%)` khi `drift = 1`) cũng vậy. Sửa: kết thúc ở `translateY(5%)` → 5.6% ≤ 6%.
9. **Khối `prefers-reduced-motion: reduce` ghi đè ở lớp B gốc có 2 lỗi.** (a) `.js .timeline::before { opacity: 1 }` làm đường dọc đậm hẳn (style gốc là `.28`). (b) `.js .reveal { transform: none }` (0,2,0) thua `.item.reveal:nth-child(odd)` (0,4,0), mốc vẫn lệch 38px tới khi giao viewport. Sửa: bọc toàn bộ lớp B trong `no-preference`, không viết khối ghi đè.
10. **`position: fixed` bên trong phần tử có `perspective` / `transform` / `filter` không còn fixed.** Lớp A đặt `perspective` lên `main` và `filter` lên `.hero-inner`. `.progress` phải là con trực tiếp của `<body>`.
11. **JS parallax bỏ qua reduced motion.** Inline style không bị media query chặn. `startScrollFx` phải tự kiểm tra `prefersReducedMotion()`.
12. **Nội dung do JS render: khởi tạo reveal trễ sẽ chớp.** Gắn `.reveal` trong cùng task với render, trước paint.
13. **`overflow: hidden` làm `view()` bám nhầm vào thẻ `.day`.** `view()` dùng scroll container gần nhất, và `overflow: hidden` vẫn là scroll container (cuộn được bằng JS). Tiến trình của mốc bị tính theo vị trí trong thẻ `.day` — vốn không bao giờ cuộn — nên các mốc cuối mỗi ngày kẹt giữa chừng animation, nghiêng và mờ vĩnh viễn. Sửa: `overflow: clip` (cắt tràn nhưng không tạo scroll container), đặt sau `overflow: hidden` làm fallback cho trình duyệt cũ (vốn chạy lớp B). Quy tắc chung: không đặt `overflow: hidden/auto/scroll` trên tổ tiên của phần tử dùng `view()`.
14. **Range kết thúc bằng `cover …` không chạy hết ở cuối trang.** Các range gốc (`entry 5% cover 24%`, `entry 15% cover 32%`, `entry 25% cover 65%`) cần phần tử còn cuộn lên được khá xa sau khi đã lọt vào màn hình. Ngày cuối nằm sát cuối trang, hoặc cả trang ngắn khi chọn tab một ngày, không có quãng cuộn đó: đo trên Chrome ở mọi tab, thanh dọc ngày cuối chỉ vẽ 41–50%, chấm cuối kẹt ở 67–78% keyframe `pop` (đang phóng to), mốc cuối dừng ở 87–97%. Sửa: mọi range theo `view()` kết thúc ở `entry 100%`; chấm (cao 10px) dùng timeline có tên của `.item` (`view-timeline-name: --item`) với `entry 40% entry 100%` để vẫn nảy trễ một nhịp. Đánh đổi: cú swing ngắn hơn (≈ chiều cao thẻ thay vì ≈ 24% chiều cao màn hình).
15. **Reveal gắn theo cuộn lướt qua quá nhanh và không chạy khi đổi tab.** Sau khi sửa lỗi 14, cú swing chỉ gói trong ≈ 105px cuộn: vuốt nhanh là gần như không thấy. Đổi tab thì mốc của ngày vừa mở đã nằm trong khung nhìn, tiến trình = 1, không có hiệu ứng nào ngoài một cú fade 0.22s. Không thể kéo dài range vì lỗi 14. Sửa: nội dung ngày dùng reveal theo thời gian ở mọi trình duyệt (IntersectionObserver gắn `.in` → keyframes 0.8s, so le 90ms theo đợt), chạy lại khi người dùng đổi tab; chỉ hero, bóng tabbar, thanh tiến trình còn gắn theo cuộn.
16. **Tab ngắn trên màn hình cao làm banner đổi hình.** Tab `Day 3` chỉ cao 923px (desktop) / 932px (điện thoại 430px). Màn hình cao hơn thế thì trang không cuộn được, `scroll()` timeline chuyển inactive (`currentTime = null`) và animation theo cuộn **ngừng áp dụng hẳn** — `fill-mode` không cứu được. Hero rơi về style gốc: ảnh `scale(1.04)` thay vì `scale(1.3) translateY(-5%)`, lớp phủ `opacity: 1` thay vì `.85`, nên chỉ tab đó có banner khác. Đo bằng Chrome headless 1440×1000 và 430×932. Sửa: trong khối lớp A, style gốc của mọi phần tử theo cuộn phải bằng khung đầu của animation (`.hero-bg`, `.hero-overlay` được đặt lại; `.hero-inner`, `.hero-thumbs`, `.tabbar`, `.progress` vốn đã trùng).

### 10.8 Nguyên tắc giữ xuyên suốt

- Mọi trạng thái ẩn đều nằm sau một điều kiện: `.reveal:not(.in)` (class do JS gắn) hoặc `@supports (animation-timeline: view())`. Thiếu JS thì không gì bị ẩn.
- Trạng thái ẩn của reveal chỉ dùng `opacity` / scale về 0; độ lệch và độ xoay nằm trong keyframes.
- Keyframes chạy theo thời gian dùng `animation-fill-mode: backwards`: trạng thái cuối là style bình thường.
- Chỉ animate `transform`, `opacity`, `filter`, `box-shadow`.
- Mọi animation CSS nằm trong `@media (prefers-reduced-motion: no-preference)`; JS tự kiểm tra `prefersReducedMotion()` trước khi gán inline style.
- Nội dung ngày không gắn theo cuộn (lỗi 15); không đặt `overflow: hidden/auto/scroll` lên tổ tiên của phần tử dùng `view()` (lỗi 13).
- Số liệu lớp A (mục 10.3) và `scrollFx` (mục 10.5) phải khớp nhau; sửa một bên thì sửa bên kia.
- Lớp A: style gốc của phần tử theo cuộn = khung đầu của animation, vì trang không cuộn được thì timeline inactive và animation không áp dụng (lỗi 16).
- Tốc độ reveal chỉnh qua token `--reveal-duration`, `--reveal-stagger`.

### 10.9 Hỗ trợ trình duyệt

| Môi trường | Theo cuộn | Vào trang + reveal |
|---|---|---|
| Chrome / Edge 115+ (desktop, Android) | A | Đầy đủ |
| Safari / iOS 26+ | A | Đầy đủ |
| Safari / iOS 15–18 | B | Đầy đủ |
| Mở link trong trình duyệt in-app Zalo | A hoặc B (tự phát hiện theo WebView) | Đầy đủ |
| Firefox | B (tự chuyển A khi hỗ trợ) | Đầy đủ |
| iOS Quick Look / mở file đính kèm / `file://` | — | Không render (cần JS + HTTP). Gửi link GitHub Pages |

## 11. Luồng khởi động

1. `<head>`: script chọn lớp animation (mục 10.1).
2. `main.js`: `fetch('data/trip.json')` (đường dẫn tương đối, chạy được dưới `/dalat/`).
3. `buildTrip(raw)`.
4. Render hero, tabs, countdown, các panel ngày, footer vào vùng mount của `index.html`.
5. Cùng task: `const reveal = startReveal(main)`, `startScrollFx({...})`, `createTabs(..., { onChange: panels → reveal.replay })`, `startStatus(...)`.
6. Lỗi ở bước 2–3 → `console.error(err)` + `renderError`.

`index.html` có `<noscript>` báo cần bật JavaScript và mở bằng link.

**Giả lập thời gian:** nếu URL có `?now=<ISO 8601>` (vd. `?now=2026-10-16T12:00:00%2B07:00`), `clock()` trả mốc đó cộng thời gian đã trôi từ lúc mở trang; không có hoặc không parse được thì dùng `Date.now()`. Giữ vĩnh viễn để kiểm tra, không ảnh hưởng người xem thường.

## 12. Kiểm thử

**Tự động** — `npm test` (= `node --test tests/`, Node ≥ 18):

- `time.test.js`: `toDate` với timezone; `weekdayText` cho 16/17/18-10-2026 → `Th 6`, `Th 7`, `CN`; `derivePeriod` cho toàn bộ 13 khung giờ hiện có; `fillTemplate`.
- `trip.test.js`: `srcset` sinh từ `{ src, widths }` và lỗi khi thiếu `{w}`; số liệu với dữ liệu thật (3 ngày, 2 đêm, 9 điểm; ngày 1 → `7 điểm · 1 khung trống`, ngày 2 → `1 điểm · 2 khung trống`, ngày 3 → `1 điểm · 1 khung trống`); `rangeText`; `order`; `mapUrl` được encode; sắp xếp; lỗi validate (thiếu `title`, `end ≤ start`, sai định dạng giờ).
- `status.test.js`: các mốc trước chuyến đi, trong 1 khung, giữa 2 khung, đúng biên `start`/`end`, sau chuyến đi; `pastPlaces` không đếm khung trống.
- `motion.test.js`: `scrollFx` tại `y = 0, 40, 200, 300, 360, 480, 5000` khớp bảng mục 10.5; clamp 0..1; `scrollHeight ≤ viewportHeight` không chia cho 0; **bất biến không hở mép**: với `d` từ 0 đến 1 bước .01, `scale × |translateY| ≤ (scale − 1) / 2 × 100`.

**Thủ công** — `npm run dev` (`npx serve .`) hoặc `python3 -m http.server`:

- So với bản cũ trên https://huucao.github.io/dalat/: hero, 4 tab, panel đếm ngược, mobile ≤ 760px.
- Giả lập thời gian `?now=2026-10-16T12:00:00%2B07:00`: trạng thái live, `.is-now` (vòng sáng quanh chấm vẫn hiện sau `pop`), `.is-past`, tự nhảy tab; `?now=2026-10-19T00:00:00%2B07:00`: trạng thái done.
- **Lớp A** (Chrome): cuộn chậm qua hero — parallax, chữ bay lên + blur, thumbs văng ra, bóng tabbar, progress; cuộn tới 480px+ không hở dải ở mép trên hero.
- **Reveal** (cả hai lớp): mốc bay vào trong 0.8s khi cuộn tới, các mốc cùng lúc so le 90ms, chấm nảy sau thẻ (0.6s), đường dọc vẽ sau tiêu đề (1.4s).
- **Đổi tab** (cả hai lớp): đang cuộn sâu mà chọn ngày khác thì ngày đó bắt đầu ngay dưới thanh tab và mốc chạy lại hiệu ứng.
- **Không còn gì ẩn** (iPhone và desktop, từng tab `Tất cả` / `Day 1…3`): cuộn hết trang rồi chờ, mọi `.reveal` có `.in` và opacity 1, mọi đường dọc vẽ đủ.
- **Lớp B**: Chrome với `CSS.supports` giả lập trả `false` và `scroll-timeline.css` bị chặn — parallax + progress chạy bằng inline style, hero không hở mép.
- DevTools → Rendering → `prefers-reduced-motion: reduce`, cả lớp A và B: không có animation, không có nội dung bị ẩn, đường dọc giữ độ mờ `.28`, hero không parallax.
- **Mobile-first** — Chrome headless điều khiển qua DevTools Protocol (script tạm trong scratchpad, không commit), giả lập iPhone 390×844 DPR 3 và desktop 1440×900 DPR 2:
  - `.hero-bg.currentSrc` lần lượt kết thúc bằng `hero-1600.jpg` / `hero-2560.jpg`.
  - Trên iPhone không có request nào tới `thumb-*`.
  - `scrollWidth === clientWidth` tại 360, 390, 430, 1440px, lúc load và sau khi cuộn hết trang.
  - `.tab` cao ≥ 44px trên iPhone.
  - Chụp màn hình cả hai cỡ để so với bản cũ.
- Máy thật (nếu có): mở link trên iPhone — chạm thẻ không bị "dính" hover, tab bấm dễ.
- Đổi `data/trip.json` sai cú pháp → hiện thông báo lỗi.
- Thêm thử 1 ngày thứ 4 trong JSON → tab, panel và animation tự áp dụng.

## 13. Triển khai

- Làm trên nhánh riêng; merge vào `main` khi người dùng duyệt (push `main` = deploy GitHub Pages).
- Nội dung chữ trong `trip.json` chép nguyên từ `index.html` hiện tại.
- Ảnh (Unsplash License, ghi nguồn trong README): hero — Pete Walls `Fl3bY0hWXv4`; thumb A — Pete Walls `RTSpODtSxTw`; thumb B — Điệp Zader `i29Z07meKds`.
