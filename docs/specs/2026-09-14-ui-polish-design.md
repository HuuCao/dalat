# Đà Lạt Trip Plan — Tinh gọn giao diện

- **Ngày:** 2026-09-14
- **Trạng thái:** Chờ duyệt
- **Phạm vi:** Nén card khung giờ, làm rõ trạng thái "bây giờ" (panel, nút nhập chi nổi, tab có ngày), làm tab Quỹ dễ hiểu, đổi cách viết tiền. Không đổi cách tính, cách đọc Sheet, nhãn Form, animation.

## 1. Bối cảnh

Chụp trang thật trên iPhone 390px (trước chuyến, 12:00 ngày 1, tab Quỹ) và desktop 1440px. Vấn đề:

1. Mỗi khung giờ cao ~200px trên mobile; ngày 1 dài ~1.800px, tab `Tất cả` ~5.000px.
2. Dòng 💰 chiếm một hàng 44px riêng, lặp `Dự kiến 400k · 100k/người` ở mọi card; mũi tên ▾ 11px xám, trên desktop cách chữ ~780px.
3. Panel trạng thái đảo thứ bậc: nhãn 9.5px → ghi chú → rồi mới tên điểm. Thiếu "còn bao lâu" và "tiếp theo là gì".
4. Ba hộp chồng nhau trước lịch trình (panel, hàng quỹ, tab); nút `Nhập chi` cuộn mất.
5. Chữ quá nhỏ: nhãn panel 9.5px, đơn vị đếm ngược 8px, `ĐANG DIỄN RA` 10px, buổi 10.5px, tag 11px.
6. Khung đã qua nền xanh lá — đọc như "đang/đạt", không phải "đã xong"; vẫn cao nguyên card.
7. Tab `Day 1/2/3` không có ngày, không biết hôm nay là tab nào.
8. Tab Quỹ: `Ứng`, `Chịu`, `Dự phòng`, `+3.065k` không nói ai trả ai; `12.000k` khó đọc.

## 2. Mục tiêu

1. Card thường ~130px trên mobile (−35%), khung đã qua một hàng.
2. Nhìn panel là biết: đang ở đâu, còn bao lâu, tiếp theo đi đâu, mở Maps ngay.
3. `Nhập chi` luôn trong tầm ngón cái trên mobile.
4. Chữ nhỏ nhất 10px (đơn vị đếm ngược), nhãn 11–12px, thông tin đọc 13px.
5. Tab Quỹ đọc được không cần giải thích: ai được hoàn, ai nộp thêm, bao nhiêu.
6. Không mất dữ liệu cũ: nhãn Form/Sheet giữ nguyên `Day N · …`.

## 3. Ngoài phạm vi

- Desktop 2 cột, dark mode, đổi màu thương hiệu.
- Đổi animation (reveal, scroll-driven, load) — cấu trúc DOM mà animation dựa vào giữ nguyên: `.day-head` ngay trước `.timeline`, mỗi `.item` là con trực tiếp của `.timeline`.
- Gom khung giờ theo buổi (đã cân nhắc, chọn "giữ bố cục, chỉ nén").
- Đổi chữ hero, footer, tag, `📍 Maps` — giữ tiếng Anh như hiện tại.
- Đổi cách tính quỹ, đọc CSV, nhãn Form.

## 4. Ngôn ngữ

| Chỗ | Hiện tại | Mới |
|---|---|---|
| Tab, tiêu đề ngày, bảng Theo ngày | `Day 1` | `Ngày 1` |
| Nhãn buổi | `Buổi sáng`, `Trưa → chiều` | `Sáng`, `Trưa → chiều` |
| Hero, footer, tag, `📍 Maps` | | giữ nguyên |
| Nhãn Form / Sheet / sổ quỹ | `Day 1 · Hidden Land` | **giữ nguyên** |

`buildDay` thêm `title: 'Ngày N'` (hiển thị) và `shortDate: 'T6 16/10'`; `label: 'Day N'` giữ cho `formLabel`, `extraLabel`. `buildLedger` thêm `title` vào mỗi phần tử `ledger.days`.

`data/trip.json`: bỏ `note` của ngày 1 (`Sáng → Trưa → Chiều → Tối` trùng nhãn buổi). Ngày 2, 3 giữ.

## 5. Định dạng tiền (`lib/money.js`)

`formatShort`:

- Làm tròn tới trăm đồng như hiện tại. Kết quả < 1.000.000 → giữ dạng `k`: `640k`, `33,3k`, `0,3k`.
- ≥ 1.000.000 → làm tròn tới nghìn, viết `<triệu>tr<nghìn 3 chữ số>`; nghìn = 0 thì bỏ:

| Số | Hiện tại | Mới |
|---|---|---|
| 12.000.000 | `12.000k` | `12tr` |
| 11.760.000 | `11.760k` | `11tr760` |
| 3.065.000 | `3.065k` | `3tr065` |
| 2.800.000 | `2.800k` | `2tr800` |
| 1.660.500 | `1.660,5k` | `1tr661` |
| 999.960 | `1.000k` | `1tr` |
| 1.200.000.000 | | `1.200tr` |
| −1.200.000 | `−1.200k` | `−1tr200` |

Áp dụng mọi chỗ dùng `formatShort` (card, ngày, panel, tab Quỹ, `formatDiff`). `formatFull` không đổi. `formatBalance` bỏ (thay bằng mục 8.3).

## 6. Card khung giờ

### 6.1. Dòng giờ (trên card, giữ vị trí)

- `07:00 – 09:00` + nhãn buổi `SÁNG` (12px, CSS uppercase).
- Nhãn trạng thái sau nhãn buổi, 12px: `ĐANG DIỄN RA` (lime đậm) hoặc `ĐÃ QUA` (xám). `controllers/status.js` bật/tắt cùng lúc với `.is-now` / `.is-past` (tổng quát hóa `toggleNowTag`).

### 6.2. Card thường

```
│ 🐈  Trại Mèo Mướp                     │
│     Mô tả sau " — " (nếu có)          │
│     ● CUTE SPOT · 💰 Dự kiến 440k ▾   │
│                             📍 Maps   │  ← chỉ khi không đủ chỗ
```

DOM `renderCard`: `.card-icon`, `.card-body` > `.card-title`, `.card-detail?`, `.card-meta?`. `.card-meta` (thay `.card-footer`) chứa theo thứ tự: `.tag?`, money slot `details.money?`, `.map-btn?`. Có `.card-meta` khi có tag, map hoặc fund.

- `.card-meta`: flex, wrap, gap 4px 10px, căn giữa dọc. `.map-btn` `margin-left: auto`, giữ vùng chạm 44px bằng padding + margin âm.
- Money slot: bỏ `border-top` gạch đứt, bỏ `min-height` hiển thị; `summary` inline, vùng chạm 44px bằng padding + margin âm dọc. Chevron ngay sau chữ, 12px, màu `--link`.
- `details.money[open]`: `flex-basis: 100%; order: 3` → tag + Maps ở hàng trên, phần mở ra chiếm cả hàng dưới.
- Mobile: `.card-icon` 40 → 34px, font 21 → 18px. Desktop giữ 44px.
- Cỡ chữ: `.tag` 11 → 12px, money 12.5 → 13px, `.map-btn` 11.5 → 13px, `.day-date` 12.5 → 13px, `.time .period` 10.5 → 12px, `.now-tag` 10 → 12px.

### 6.3. Dòng 💰 (`describeBucket`)

| Tình huống | Summary | Phần mở ra thêm |
|---|---|---|
| Chưa chi, có dự kiến | `💰 Dự kiến 440k` (muted) | `Mỗi người ~110k` |
| Chưa chi, `budget: 0` | `🆓 Miễn phí` | |
| Chưa chi, không dự kiến | `💰 Chưa chi` | |
| Đã chi | `💰 400k / 280k ▲ 120k` | |
| Đã chi, `budget: 0` | `💰 50k · ngoài dự kiến` | |

`describeBucket` trả thêm `perPerson` (chuỗi hoặc `null`); `fillMoney` in `Mỗi người ~110k` đầu phần mở ra, sau `note` của chi phí chung nếu có. Hàng chi phí chung trong tab Quỹ dùng cùng quy tắc.

### 6.4. Khung đã qua (`.item.is-past`, chỉ CSS)

```
│ 🍃 Đồi chè Cầu Đất      400k / 280k ▲ 120k ▾ │
```

- Ẩn `.card-detail`, `.tag`, `.map-btn`.
- `.card-body` thành một hàng: tên co giãn, money summary bên phải; mở money → xuống hàng dưới.
- `.card-icon` 28px, `opacity: .6`. Nền `#f4f5f4`, viền `var(--line)`, tên `var(--text-sub)`. Bỏ nền xanh `#f3f9f4`.
- Khung trống đã qua cùng kiểu, giữ viền nét đứt.

## 7. "Bây giờ"

### 7.1. Panel trạng thái

```
● ĐANG DIỄN RA                  2/16 điểm
🍗 Gà nướng + Cơm lam            📍 Maps
Còn 15 phút · đến 12:15
─────────────────────────────────────────
Tiếp theo 12:45 · 🐈 Trại Mèo Mướp
─────────────────────────────────────────
💰 Quỹ còn 11tr760                         ← hàng quỹ, dính liền
```

`describeStatus` trả `{ label, tiles, headline, note, progress, next, mapUrl }`:

| Pha | label | headline | note | progress | next | mapUrl |
|---|---|---|---|---|---|---|
| Trước chuyến | `Đếm ngược khởi hành` | — (tiles) | như hiện tại | `null` | `null` | `null` |
| Đang ở khung | `Đang diễn ra` | `current.heading` | `Còn 15 phút · đến 12:15` | `2/16 điểm` | khung sau `current` | Maps của `current` |
| Giữa hai khung | `Đang di chuyển` | `status.next.heading` (khung sắp tới) | `Bắt đầu 12:45 · còn 30 phút` | `2/16 điểm` | khung sau khung sắp tới | Maps của khung sắp tới |
| Sau chuyến | `Hành trình đã khép lại` | như hiện tại | như hiện tại | `null` | `null` | `null` |

- `next`: `Tiếp theo 12:45 · 🐈 Trại Mèo Mướp`; khác ngày thì thêm thứ: `Tiếp theo T7 07:00 · 🥞 Ăn sáng`. Không còn khung → `null`, ẩn dòng.
- Thời lượng còn lại (`durationText`, `lib/time.js`): làm tròn lên phút. `< 1 phút`, `15 phút`, `2 giờ`, `1 giờ 20 phút`.
- `mapUrl` `null` (khung trống không có `map`) → ẩn nút.
- DOM `createCountdown`: `.cd-body` > `.cd-label` (pulse + nhãn + `.cd-progress` bên phải), `.cd-headline-row` (headline + `a.cd-map`), `.cd-note`; `.cd-next`; `.cd-clock` chỉ chứa tiles. Phần tử tạo một lần, `update` chỉ đổi text, `href`, `hidden`.
- Cỡ chữ: `.cd-label` 9.5 → 11px, `.cd-unit i` 8 → 10px, headline 16px, note 13px, `.cd-next` 13px.
- `.cd-map`: nền `rgba(255,255,255,.1)`, chữ trắng, vùng chạm 44px.

### 7.2. Hàng quỹ dính liền panel

- `.status` giữ hai con: `.countdown` và `.fund-status` (tách để panel tick không vẽ lại phần quỹ).
- Không dùng `:has` (Safari iOS 15 chưa hỗ trợ): `mount()` thêm class `has-fund` cho `.status` khi có quỹ. `.status.has-fund .countdown` chỉ bo góc trên; `.fund-status` nền `#16241d`, chữ `#e9f1eb`, viền trên `rgba(255,255,255,.1)`, bo góc dưới, `margin-top: 0`, không viền/bóng sáng.
- Nút `Nhập chi` trong hàng quỹ: ẩn < 761px (nút nổi thay thế); ≥ 761px hiện, kiểu sáng trên nền tối.

### 7.3. Nút nổi `➕ Nhập chi` (mobile)

- `createFundView` trả thêm `fab`: `a.fab` cùng `href` và cùng bộ lắng nghe `pointerdown`/`focus`/`click` chọn sẵn địa điểm như `statusLink`. Không có `fund.form` → `fab` là `null`.
- `mount()` gắn `fab` làm con trực tiếp của `#app`, sau `<main>` — không nằm trong phần tử có `transform`/animation (`.panel` có animation `fade`), nếu không `position: fixed` hỏng.
- CSS: `position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 25`; cao 52px, bo 99px, nền `--primary`, chữ trắng 14px đậm, bóng `var(--shadow-md)`. `display: none` ≥ 761px.
- `index.html`: viewport thêm `viewport-fit=cover`.
- `main.has-fab` (mobile): `padding-bottom: 88px`.
- Hiện ở mọi pha và mọi tab.

### 7.4. Tab có ngày

```
[ Tất cả ][ Ngày 1  ][ Ngày 2  ][ Ngày 3  ][ 💰 Quỹ ]
          [ T6 16/10 ][ T7 17/10 ][ CN 18/10 ]
```

- `renderTabs`: tab ngày gồm `span.tab-name` (`day.title`) + `span.tab-date` (`day.shortDate`, 11px). Tab cao tối thiểu 52px, `Tất cả` và `Quỹ` căn giữa dọc.
- Hôm nay: `createTabs` thêm `markToday(dayId | null)` đặt `data-today` lên tab; CSS vẽ chấm lime 6px dưới chữ. `controllers/status.js` gọi mỗi tick với ngày có `date` trùng ngày theo múi giờ chuyến đi (`localDateOf(now, timezone)`, `lib/time.js`).
- `aria-label` tab ngày: `Ngày 1, Th 6 16/10` (thêm `, hôm nay` khi đúng).

## 8. Tab Quỹ

### 8.1. Thứ tự

1. Đầu: `💰 Quỹ chuyến đi` · `Cập nhật 14:03 ↻`
2. Cảnh báo (`⚠️ N cảnh báo cần sửa`) và `Không khớp địa điểm` — gom lên đầu vì cần sửa.
3. Tổng quan (8.2)
4. Quyết toán (8.3)
5. Theo ngày
6. Chi phí chung
7. Sổ sách
8. Nút `➕ Nhập chi tiêu`, `📄 Mở Google Sheet`

### 8.2. Tổng quan

```
┌ Quỹ còn ─────────────── 11tr760 ┐     ← ô lớn, 24px
[Đã góp 12tr] [Đã chi 640k] [Dư so với dự kiến 640k]
Thực chi / dự kiến  ▓░░░░░  640k / 11tr360
```

- Ô `Quỹ còn` chiếm cả hàng; ba ô nhỏ 3 cột ở mọi độ rộng.
- `reserve ≥ 0` → `Dư so với dự kiến`; `< 0` → `Thiếu so với dự kiến` + số dương, màu `--money-over`.
- Nhãn ô 11 → 12px.

### 8.3. Quyết toán

```
Kết quả = Đã góp + Trả hộ − Phần chịu

         Đã góp  Trả hộ  Phần chịu     Kết quả
Hữu        3tr    300k     235k   Hoàn 3tr065
Khanh      3tr       0    3tr845     Nộp 845k
Trâm       3tr       0       3tr          Đủ
                                  Quỹ còn 11tr760
```

- Cột: `Đã góp · Trả hộ · Phần chịu · Kết quả`. Dòng công thức 12px `--text-sub` trên bảng.
- `describeBalance(balance)` (`model/fund.js`): `> 0` → `{ text: 'Hoàn 3tr065', tone: 'under' }`; `< 0` → `{ text: 'Nộp 845k', tone: 'over' }`; `0` → `{ text: 'Đủ', tone: null }` (xám).
- Tiêu đề giữ `Quyết toán · tạm tính` / `Quyết toán`.
- Chốt quỹ ghi đủ đồng (`formatFull`): `→ Quỹ hoàn Hữu 2.695.000đ`, `→ Khanh nộp thêm vào quỹ 845.000đ`.

### 8.4. Dòng chi (`describeEntry`)

| | Hiện tại | Mới |
|---|---|---|
| Thành viên trả | `Hữu ứng` | `Hữu trả hộ` |
| Quỹ trả | `Quỹ trả` | giữ |
| Không phải thành viên | `Tram trả ⚠️` | giữ |
| Chia cả nhóm | `chia 4` | `chia đều 4 người` |
| Chia một phần | `chia Hữu, MiMi` | giữ |
| Không ai hợp lệ | `chia ?` | giữ |

## 9. File

| File | Thay đổi |
|---|---|
| `index.html` | `viewport-fit=cover` |
| `data/trip.json` | bỏ `note` ngày 1 |
| `js/lib/money.js` | `formatShort` dạng `tr`; bỏ `formatBalance` |
| `js/lib/time.js` | `derivePeriod` bỏ `Buổi`; thêm `shortDateText`, `durationText`, `localDateOf` |
| `js/model/trip.js` | `day.title`, `day.shortDate` |
| `js/model/status.js` | `describeStatus` thêm `progress`, `next`, `mapUrl`; note mới |
| `js/model/fund.js` | `ledger.days[].title`; `describeBucket.perPerson`; `describeEntry` chữ mới; `describeBalance`; chốt quỹ `formatFull` |
| `js/views/day.js` | `.card-meta`; tiêu đề `day.title` |
| `js/views/tabs.js` | tab 2 dòng, `aria-label` |
| `js/views/countdown.js` | DOM panel mới |
| `js/views/fund.js` | `fab`; `perPerson`; thứ tự tab Quỹ; tổng quan; quyết toán; `day.title` |
| `js/controllers/tabs.js` | `markToday` |
| `js/controllers/status.js` | nhãn `Đã qua`; gọi `markToday` |
| `js/main.js` | gắn `fab`, class `has-fund` / `has-fab` |
| `css/timeline.css` | card nén, khung đã qua, cỡ chữ |
| `css/fund.css` | money inline, hàng quỹ tối, `.fab`, tổng quan, quyết toán |
| `css/countdown.css` | panel mới, cỡ chữ |
| `css/tabs.css` | tab 2 dòng, chấm hôm nay |
| `tests/*.test.js` | xem mục 10.1 |
| `README.md` | mục 2, 3, 4, 7, 10 và ví dụ số tiền |

## 10. Kiểm thử

### 10.1. Unit test (`npm test`)

| File | Thêm / sửa |
|---|---|
| `money.test.js` | bảng mục 5 (kể cả biên `999.960`, âm, tỷ); bỏ test `formatBalance`; `formatDiff` dạng `tr` |
| `time.test.js` | `derivePeriod` không `Buổi`; `shortDateText` (`T6 16/10`, `CN 18/10`); `durationText` (`< 1 phút`, `59 phút`, `2 giờ`, `1 giờ 20 phút`, làm tròn lên); `localDateOf` quanh nửa đêm ở múi giờ khác |
| `trip.test.js` | `title`, `shortDate`; `label` và `fund.labels` **không đổi** |
| `status.test.js` | mọi pha: `progress`, `next` (cùng ngày, sang ngày, hết khung), `mapUrl` (có / khung trống), note mới |
| `fund.test.js` | `ledger.days[].title`; `perPerson`; `describeEntry`; `describeBalance` 3 nhánh; chốt quỹ `formatFull`; nhãn Sheet cũ `Day 1 · …` vẫn khớp |

### 10.2. Trình duyệt

Chrome headless qua CDP (giả lập thiết bị, `prefers-reduced-motion` bật và tắt), 360 / 390 / 430 / 1440px:

1. Không cuộn ngang ở mọi độ rộng.
2. `?now=` trước chuyến, `2026-10-16T12:00` (đang ở khung), `2026-10-16T12:30` (giữa hai khung), `2026-10-16T21:50` (tiếp theo sang ngày 2), `2026-10-19` (sau chuyến).
3. Card thường ≤ ~140px, khung đã qua ≤ 60px ở 390px; mở money trong card thường và card đã qua.
4. Nút nổi không che nút `Nhập phát sinh` cuối ngày và footer; ẩn ở 1440px; `href` đổi theo `?now=`.
5. Chấm hôm nay đúng tab; không có chấm trước / sau chuyến.
6. Tab Quỹ: thứ tự, `Hoàn` / `Nộp` / `Đủ`, dạng `tr`.
7. Vùng chạm ≥ 44px: tab, Maps (card + panel), summary money, nút nổi.
8. Animation reveal vẫn chạy khi đổi tab (không giảm chuyển động).
9. Sheet lỗi / chưa kết nối: lịch trình, panel, nút nổi vẫn đúng.
