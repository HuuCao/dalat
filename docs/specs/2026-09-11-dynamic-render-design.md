# Đà Lạt Trip Plan — Render động từ dữ liệu

- **Ngày:** 2026-09-11
- **Trạng thái:** Chờ duyệt
- **Phạm vi:** Tái cấu trúc `index.html` (1 file, ~309KB) thành trang tách file, render toàn bộ từ `data/trip.json`, kèm hệ animation theo scroll 2 lớp.

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
5. Animation phản ứng theo scroll: CSS scroll-driven khi trình duyệt hỗ trợ, IntersectionObserver + rAF khi không (mục 10).
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
    scroll-timeline.css     lớp A — @supports (animation-timeline: view())
    reveal-fallback.css     lớp B — .no-scroll-timeline
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
  controllers/reveal.js     lớp B: IntersectionObserver reveal
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
- API: `createTabs(tablist, panels) → { select(id) }`, mặc định `all`.

### Status

- `startStatus({ trip, root, countdown, tabs, clock })` — `root` chứa các `.item`, `countdown` là panel đếm ngược, `clock()` trả thời điểm hiện tại (ms).
- Mỗi tick: `getStatus(trip, clock())` → toggle `.is-now` / `.is-past` trên `.item[data-id]`, thêm/bỏ `.now-tag`, cập nhật countdown, toggle class `soon` / `live` trên panel.
- Tick 1s khi `phase === "soon"`, ngược lại 15s (như cũ).
- Lần đầu, nếu `phase === "live"`: `tabs.select(dayId của current ?? next)`, sau 400ms `scrollIntoView({ behavior: "smooth", block: "center" })`.

### Reveal và Scroll FX

Xem mục 10.5.

## 9. CSS và responsive

- Tách theo bảng ở mục 4, nạp bằng nhiều `<link>` (không `@import`) theo thứ tự: `tokens → base → hero → tabs → timeline → countdown → motion/keyframes → motion/load → motion/scroll-timeline → motion/reveal-fallback`. Thứ tự này có ý nghĩa: rule lớp A đứng sau `load.css` nên ghi đè `animation` trên phần tử dùng chung.
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

### 10.1 Hai lớp và quy tắc chọn

| Lớp | Kỹ thuật | Dành cho |
|---|---|---|
| **A** | CSS scroll-driven: `animation-timeline: scroll()` / `view()`. Chạy trên compositor, nội suy theo vị trí cuộn | Chrome/Edge 115+, Safari/iOS 26+ |
| **B** | IntersectionObserver (reveal một chiều) + rAF (parallax, progress) | Trình duyệt không hỗ trợ lớp A: Safari 15–18, Firefox, WebView cũ |

Script inline đặt **cuối `<head>`**, chạy trước lần paint đầu:

```html
<script>
  if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'))) {
    document.documentElement.classList.add('no-scroll-timeline');
  }
</script>
```

- Hỗ trợ → không có class → lớp A (CSS trong `@supports`) tự chạy.
- Không hỗ trợ → `html.no-scroll-timeline` → bật lớp B.
- Đổi tên class từ `js` (bản mô tả gốc) sang `no-scroll-timeline`: ở kiến trúc mới mọi người xem đều có JS, tên `js` gây hiểu nhầm. Không dùng biến global `window.__hasTimeline`; module đọc class qua `hasScrollTimeline()` trong `lib/motion.js`.
- Phải nằm trong `<head>`: đặt cuối `<body>` thì CSS kịp paint vài frame với lựa chọn sai rồi mới đổi, thấy như một cú giật.

### 10.2 Keyframes (`motion/keyframes.css`)

```css
/* mốc lẻ và chẵn bay vào từ hai phía, có chiều sâu 3D */
@keyframes swing-left {
  from { opacity: 0; transform: translate3d(-46px, 34px, -90px) rotateY(14deg) rotateZ(-2deg); }
  to   { opacity: 1; transform: none; }
}
@keyframes swing-right {
  from { opacity: 0; transform: translate3d(46px, 34px, -90px) rotateY(-14deg) rotateZ(2deg); }
  to   { opacity: 1; transform: none; }
}

/* tiêu đề ngày */
@keyframes head-in {
  from { opacity: 0; transform: translateY(26px) scale(.94); }
  to   { opacity: 1; transform: none; }
}

/* chấm timeline: nảy quá đà rồi co lại, kèm vòng sáng lan ra.
   `to` KHÔNG khai báo box-shadow: keyframe cuối tự nội suy về box-shadow
   thật của phần tử, nên vòng sáng của .is-now / .is-past vẫn hiện (lỗi 7). */
@keyframes pop {
  from { opacity: 0; transform: scale(0);    box-shadow: 0 0 0 14px rgba(var(--accent-rgb), 0); }
  60%  { opacity: 1; transform: scale(1.45); box-shadow: 0 0 0 7px  rgba(var(--accent-rgb), .28); }
  to   { opacity: 1; transform: scale(1); }
}

/* đường kẻ dọc tự vẽ từ trên xuống */
@keyframes draw {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}

/* hero: zoom ra dần + trôi xuống.
   Điều kiện không hở mép: scale × |translateY| ≤ (scale − 1) / 2.
   Đầu: 1.3 × 5% = 6.5% ≤ 15%. Cuối: 1.12 × 5% = 5.6% ≤ 6% (lỗi 8). */
@keyframes hero-parallax {
  from { transform: scale(1.3)  translateY(-5%); }
  to   { transform: scale(1.12) translateY(5%); }
}

/* lớp phủ tối dần. Không dùng opacity > 1 — bị kẹp về 1 (lỗi 1). */
@keyframes hero-darken {
  from { opacity: .85; }
  to   { opacity: 1; }
}

/* chữ trên hero bay lên, thu nhỏ và nhoè dần */
@keyframes hero-lift {
  from { opacity: 1; transform: none; filter: blur(0); }
  to   { opacity: 0; transform: translateY(-48px) scale(.92); filter: blur(5px); }
}

/* 2 ảnh thumbnail văng chéo ra */
@keyframes thumbs-out {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: translate3d(60px, -20px, 0) rotate(7deg); }
}

/* thanh tab dính: đổ bóng khi trang bắt đầu cuộn */
@keyframes bar-settle {
  from { box-shadow: 0 0 0 rgba(0, 0, 0, 0); }
  to   { box-shadow: 0 6px 18px rgba(16, 30, 25, .12); }
}

/* thanh tiến trình đọc */
@keyframes progress-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* vào trang (mục 10.4) — chỉ `from`, fill-mode backwards */
@keyframes rise       { from { opacity: 0; transform: translateY(26px); } }
@keyframes rise-right { from { opacity: 0; transform: translate3d(34px, 20px, 0); } }
@keyframes bg-in      { from { opacity: 0; transform: scale(1.22); } }
```

So với bản mô tả gốc, chỉ đổi 3 chỗ: màu trong `pop` dùng token, `pop` bỏ `box-shadow` ở `to`, `hero-parallax` kết thúc ở `translateY(5%)` thay vì `6%`.

### 10.3 Lớp A — `motion/scroll-timeline.css`

Mọi trạng thái ẩn đều nằm trong `@supports`. Trình duyệt không hiểu `animation-timeline` bỏ qua cả khối, nội dung không bao giờ kẹt ở `opacity: 0`.

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {

    /* --- theo tiến trình cuộn của cả trang --- */
    .progress     { animation: progress-grow linear both; animation-timeline: scroll(root block); }
    .hero-bg      { animation: hero-parallax linear both; animation-timeline: scroll(root block); animation-range: 0 480px; }
    .hero-overlay { animation: hero-darken   linear both; animation-timeline: scroll(root block); animation-range: 0 420px; }
    .hero-inner   { animation: hero-lift     linear both; animation-timeline: scroll(root block); animation-range: 40px 360px; }
    .hero-thumbs  { animation: thumbs-out    linear both; animation-timeline: scroll(root block); animation-range: 0 300px; }
    .tabbar       { animation: bar-settle    linear both; animation-timeline: scroll(root block); animation-range: 120px 220px; }

    /* --- theo vị trí phần tử trong khung nhìn --- */
    main      { perspective: 1100px; }
    .timeline { perspective: 900px; }

    /* mọi range kết thúc ở `entry 100%` — mốc luôn tới được (lỗi 14) */
    .day-head             { animation: head-in     linear both; animation-timeline: view(); animation-range: entry 10% entry 100%; }
    .item                 { view-timeline-name: --item; }
    .item:nth-child(odd)  { animation: swing-left  linear both; animation-timeline: view(); animation-range: entry 5% entry 100%; }
    .item:nth-child(even) { animation: swing-right linear both; animation-timeline: view(); animation-range: entry 5% entry 100%; }
    /* chấm cao 10px nên dùng timeline của .item, bắt đầu muộn hơn để nảy trễ một nhịp */
    .dot                  { animation: pop         linear both; animation-timeline: --item; animation-range: entry 40% entry 100%; }
    .timeline::before {
      transform-origin: top center;
      animation: draw linear both;
      animation-timeline: view();
      animation-range: entry 10% entry 100%;
    }
  }
}
```

**Đọc `animation-range`:** với `view()`, hành trình của phần tử qua khung nhìn gồm các pha `entry` (đang đi vào), `contain`, `exit`, và `cover` (toàn bộ hành trình). `entry 5% entry 100%` = bắt đầu khi vừa nhú 5% của pha vào, kết thúc khi phần tử vừa lọt hẳn vào khung nhìn (phần tử cao hơn khung nhìn: khi mép trên chạm đỉnh). Mốc kết thúc luôn tới được, kể cả với ngày cuối nằm sát cuối trang; kết thúc bằng `cover …` thì không (lỗi 14).

| Phần tử | Timeline | Range | Hiệu ứng |
|---|---|---|---|
| `.progress` | scroll root | toàn trang | scaleX 0 → 1 |
| `.hero-bg` | scroll root | 0 → 480px | zoom 1.3 → 1.12, trôi xuống |
| `.hero-overlay` | scroll root | 0 → 420px | tối dần |
| `.hero-inner` | scroll root | 40 → 360px | bay lên + blur 5px |
| `.hero-thumbs` | scroll root | 0 → 300px | văng chéo + xoay 7° |
| `.tabbar` | scroll root | 120 → 220px | hiện bóng đổ |
| `.day-head` | view | entry 10% → entry 100% | trượt lên + scale |
| `.item` lẻ/chẵn | view | entry 5% → entry 100% | swing 3D trái/phải |
| `.dot` | `--item` (timeline của `.item` chứa nó) | entry 40% → entry 100% | nảy + vòng sáng, trễ hơn thẻ một nhịp |
| `.timeline::before` | view | entry 10% → entry 100% | vẽ đường dọc |

**Tab:** chuyển tab không phát lại animation. Timeline `view()` tự tính theo vị trí mới của phần tử trong panel vừa mở.

### 10.4 Animation vào trang — `motion/load.css`

Thay cho lớp C cũ, chỉ giữ phần hero + tabs để trang không đứng im lúc mở. Chạy ở cả lớp A và B.

```css
@media (prefers-reduced-motion: no-preference) {
  .hero-bg     { animation: bg-in 1.1s cubic-bezier(.22, .9, .3, 1) backwards; }
  .eyebrow, h1, .subtitle, .chips { animation: rise .75s cubic-bezier(.22, .9, .3, 1) backwards; }
  .eyebrow     { animation-delay: .04s; }
  h1           { animation-delay: .09s; }
  .subtitle    { animation-delay: .14s; }
  .chips       { animation-delay: .19s; }
  .hero-thumbs { animation: rise-right .8s cubic-bezier(.22, .9, .3, 1) .24s backwards; }
  .tabs        { animation: rise .6s cubic-bezier(.22, .9, .3, 1) .28s backwards; }
}
```

- Ở lớp A, rule trong `scroll-timeline.css` nạp sau nên thay `animation` của `.hero-bg` và `.hero-thumbs` bằng bản theo scroll. Hai phần tử này không có hiệu ứng vào trang ở lớp A (chấp nhận).
- `.eyebrow`, `h1`, `.subtitle`, `.chips` là con của `.hero-inner` nên chạy chồng được với `hero-lift`.
- Mọi keyframe ở đây chỉ khai báo `from` + `backwards`: trạng thái cuối chính là style bình thường.

### 10.5 Lớp B — IntersectionObserver + rAF

#### CSS — `motion/reveal-fallback.css`

Cả khối nằm trong `@media (prefers-reduced-motion: no-preference)`, **không** dùng khối `reduce` ghi đè như bản gốc (lỗi 9).

```css
@media (prefers-reduced-motion: no-preference) {
  .no-scroll-timeline .reveal {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity .65s cubic-bezier(.22, .9, .3, 1),
                transform .65s cubic-bezier(.22, .9, .3, 1);
  }

  .no-scroll-timeline .item.reveal:nth-child(odd)  { transform: translate3d(-38px, 22px, 0); }
  .no-scroll-timeline .item.reveal:nth-child(even) { transform: translate3d(38px, 22px, 0); }

  /* so le 40ms theo thứ tự trong ngày, tối đa .2s — thay 5 rule nth-child cứng */
  .no-scroll-timeline .item.reveal { transition-delay: calc(min(var(--i, 0), 5) * 40ms); }

  /* phải thắng specificity (0,4,0) của 2 rule :nth-child ở trên (lỗi 5) */
  .no-scroll-timeline .reveal.in,
  .no-scroll-timeline .item.reveal.in:nth-child(odd),
  .no-scroll-timeline .item.reveal.in:nth-child(even) {
    opacity: 1;
    transform: none;
  }

  /* chấm nảy trễ hơn thân mốc một nhịp */
  .no-scroll-timeline .item.reveal .dot {
    transform: scale(0);
    transition: transform .5s cubic-bezier(.34, 1.56, .64, 1) .12s;
  }
  .no-scroll-timeline .item.reveal.in .dot { transform: none; }

  /* đường dọc vẽ khi tiêu đề ngày phía trên đã hiện — sibling selector,
     không cần observe thêm phần tử */
  .no-scroll-timeline .timeline::before {
    transform: scaleY(0);
    transform-origin: top center;
    transition: transform 1.3s cubic-bezier(.22, .9, .3, 1) .1s;
  }
  .no-scroll-timeline .day-head.reveal.in + .timeline::before { transform: scaleY(1); }
}
```

#### JS — `controllers/reveal.js`

```
startReveal(root) → void
```

- Thoát ngay nếu `hasScrollTimeline()`.
- Gắn `.reveal` cho mọi `.day-head, .item` trong `root`.
- Có `IntersectionObserver`: observe với `{ rootMargin: '0px 0px -10% 0px', threshold: 0.1 }`; phần tử giao nhau → thêm `.in` rồi `unobserve` (một chiều, không reveal lại).
- Không có `IntersectionObserver`: thêm `.in` cho tất cả ngay.
- **Phải gọi đồng bộ ngay sau khi render**, cùng một task, trước lần paint kế tiếp. Nếu gọi trễ, nội dung hiện ra rồi mới bị ẩn (lỗi 12).
- Tab: panel ẩn bằng `hidden` (`display: none`) thì không bao giờ giao với viewport, nên mốc trong panel chưa mở tự reveal đúng lúc bấm sang tab đó. Không cần xử lý thêm.

#### JS — `controllers/scroll-fx.js` + `lib/motion.js`

```
startScrollFx({ bar, bg, inner, thumbs }) → void
scrollFx(y, viewportHeight, scrollHeight) → { bar, bg, inner, thumbs }   // thuần, có test
```

- Thoát ngay nếu `hasScrollTimeline()` **hoặc** `prefersReducedMotion()`. Inline style do JS gán không bị `@media (prefers-reduced-motion)` chặn, nên JS phải tự kiểm tra (lỗi 11).
- Nghe `scroll` (`passive: true`) và `resize`; gom về tối đa 1 `requestAnimationFrame` mỗi frame; gọi 1 lần lúc khởi động.
- `scrollFx` dùng **cùng range và cùng số** với lớp A để hai lớp nhìn giống nhau. Với `clamp01(x) = min(1, max(0, x))`:

| Đầu ra | Tiến trình | Style |
|---|---|---|
| `bar` | `p = clamp01(y / max(1, scrollHeight − viewportHeight))` | `transform: scaleX(p)` |
| `bg` | `d = clamp01(y / 480)` | `transform: scale(1.3 − .18d) translateY((−5 + 10d)%)` |
| `inner` | `l = clamp01((y − 40) / 320)` | `opacity: 1 − l`, `transform: translateY(−48l px) scale(1 − .08l)` (bỏ blur cho máy yếu) |
| `thumbs` | `t = clamp01(y / 300)` | `opacity: 1 − t`, `transform: translate3d(60t px, −20t px, 0) rotate(7t deg)` |

- Lớp B không làm `hero-overlay` tối dần và bóng đổ `.tabbar` (giữ như bản mô tả gốc).
- Bỏ qua phần tử `null` (vd. không có `thumbs` trong JSON).

### 10.6 `.progress`

- Phần tử tĩnh trong `index.html`, **con trực tiếp của `<body>`**, đứng trước mọi thứ.
- `position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); transform-origin: 0 50%; transform: scaleX(0); z-index: 30; pointer-events: none`.
- Không đặt bên trong `main`, `.hero-inner` hay phần tử nào có `perspective`, `transform`, `filter`: các thuộc tính đó biến tổ tiên thành containing block của `position: fixed`, thanh sẽ trôi theo nội dung (lỗi 10).
- Mặc định `scaleX(0)` là ngoại lệ có chủ đích với nguyên tắc "trạng thái ẩn phải có điều kiện": đây là trang trí, không phải nội dung.

### 10.7 Các lỗi đã biết — không được lặp lại

Lỗi 1–6 đã gặp khi dựng thật trên bản một file. Lỗi 7–12 phát hiện khi rà soát bản mô tả để đưa vào kiến trúc mới. Lỗi 13–14 phát hiện khi chạy kiểm thử Chrome headless.

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

### 10.8 Nguyên tắc giữ xuyên suốt

- Mọi trạng thái ẩn đều nằm sau một điều kiện: `@supports (animation-timeline: view())`, hoặc `.no-scroll-timeline .reveal` (class do JS gắn). Không điều kiện nào đúng thì trang hiện đầy đủ.
- Keyframe vào trang chỉ khai báo `from` + `animation-fill-mode: backwards`.
- Chỉ animate `transform`, `opacity`, `filter`, `box-shadow`.
- Mọi animation CSS bọc trong `@media (prefers-reduced-motion: no-preference)`; JS tự kiểm tra `prefersReducedMotion()`.
- Số liệu hiệu ứng của lớp A (mục 10.3) và `scrollFx` (mục 10.5) phải khớp nhau; sửa một bên thì sửa bên kia.

### 10.9 Hỗ trợ trình duyệt

| Môi trường | Lớp | Kết quả |
|---|---|---|
| Chrome / Edge 115+ (desktop, Android) | A | Đầy đủ, nội suy theo vị trí cuộn |
| Safari / iOS 26+ | A | Đầy đủ |
| Safari / iOS 15–18 | B | Reveal theo scroll + parallax, progress bằng rAF |
| Mở link trong trình duyệt in-app Zalo | A hoặc B | Tùy phiên bản WebView (iOS dùng engine Safari của máy, Android dùng Chrome WebView); tự phát hiện |
| Firefox | B | Reveal theo scroll; tự chuyển sang A khi Firefox hỗ trợ `animation-timeline` |
| iOS Quick Look / mở file đính kèm / `file://` | — | Không render (cần JS + HTTP). Gửi link GitHub Pages |

## 11. Luồng khởi động

1. `<head>`: script chọn lớp animation (mục 10.1).
2. `main.js`: `fetch('data/trip.json')` (đường dẫn tương đối, chạy được dưới `/dalat/`).
3. `buildTrip(raw)`.
4. Render hero, tabs, countdown, các panel ngày, footer vào vùng mount của `index.html`.
5. Cùng task: `startReveal(main)`, `startScrollFx({...})`, `createTabs(...)`, `startStatus(...)`.
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
- **Lớp A** (Chrome): cuộn chậm qua hero — parallax, chữ bay lên + blur, thumbs văng ra, bóng tabbar, progress; cuộn tới 480px+ không hở dải ở mép trên hero; từng mốc swing vào theo vị trí cuộn, cuộn ngược thì chạy ngược.
- **Không kẹt ở cuối trang** (lớp A, iPhone và desktop, từng tab `Tất cả` / `Day 1…3`): cuộn tới cuối, mọi animation theo `view()` có `getComputedTiming().progress = 1`.
- **Lớp B**: Firefox, hoặc Chrome với `CSS.supports` giả lập bằng cách tạm thêm class `no-scroll-timeline` ở `<head>` script. Mốc reveal một lần khi cuộn tới; mốc lẻ/chẵn về đúng vị trí (không kẹt 38px); đường dọc vẽ sau tiêu đề ngày; chuyển tab thì mốc của ngày mới reveal; parallax + progress chạy.
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
