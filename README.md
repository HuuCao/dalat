# Đà Lạt Trip Plan

Trang lịch trình chuyến Đà Lạt 3 ngày 2 đêm, tối ưu cho điện thoại, hiển thị tốt trên máy tính.

**Xem trực tiếp:** https://huucao.github.io/dalat/

Toàn bộ nội dung nằm trong một file dữ liệu `data/trip.json`. Trang tự dựng giao diện, tự tính số liệu và tự cập nhật theo thời gian thực. Không có build step, không có dependency.

---

## Mục lục

- [Tính năng](#tính-năng)
  - [Hero](#1-hero)
  - [Tab chọn ngày](#2-tab-chọn-ngày)
  - [Lịch trình từng ngày](#3-lịch-trình-từng-ngày)
  - [Trạng thái chuyến đi](#4-trạng-thái-chuyến-đi)
  - [Theo dõi thời gian thực](#5-theo-dõi-thời-gian-thực)
  - [Animation](#6-animation)
  - [Tối ưu cho điện thoại](#7-tối-ưu-cho-điện-thoại)
  - [Dữ liệu và xử lý lỗi](#8-dữ-liệu-và-xử-lý-lỗi)
  - [Truy cập và an toàn](#9-truy-cập-và-an-toàn)
- [Hỗ trợ trình duyệt](#hỗ-trợ-trình-duyệt)
- [Chạy local](#chạy-local)
- [Kiểm thử](#kiểm-thử)
- [Sửa lịch trình](#sửa-lịch-trình)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Deploy](#deploy)
- [Tài liệu](#tài-liệu)
- [Nguồn ảnh](#nguồn-ảnh)

---

## Tính năng

### 1. Hero

- Ảnh nền toàn chiều ngang, phủ lớp gradient tối để chữ luôn dễ đọc.
- Dòng nhỏ phía trên (`✦ Travel plan · Đà Lạt`) và tiêu đề lớn (`Đà Lạt`).
- Phụ đề tự điền khoảng ngày và số ngày/đêm từ dữ liệu (`16 – 18/10 · 3 ngày 2 đêm — Let's go`).
- Các chip chủ đề: `🌿 Nature`, `☕ Chill`, `📸 Check-in`.
- Hai ảnh thumbnail ở góc phải — chỉ hiện trên máy tính.

### 2. Tab chọn ngày

- Tab `Tất cả` và `Day 1…N` sinh tự động theo số ngày trong dữ liệu. Thêm ngày thứ 4 thì tab thứ 4 tự xuất hiện.
- Thanh tab dính ở đầu màn hình khi cuộn, nền mờ kính.
- Chọn tab hiện đúng ngày đó, `Tất cả` hiện toàn bộ; mỗi lần đổi tab, ngày vừa mở mờ dần vào và các khung giờ bay vào lại. Đang cuộn sâu thì ngày được chọn tự đưa lên ngay dưới thanh tab.
- Điều khiển bằng bàn phím: `←` `→` chuyển tab, `Home` / `End` về tab đầu / cuối.
- Nhiều ngày không đủ chỗ thì hàng tab vuốt ngang được, tab vừa chọn tự cuộn vào tầm nhìn.

### 3. Lịch trình từng ngày

Mỗi ngày là một thẻ gồm:

- **Tiêu đề:** icon + `Day N`.
- **Dòng thông tin tự tính:** thứ/ngày, giờ bắt đầu → kết thúc, ghi chú — ví dụ `Th 6, 16/10 · 07:00 → 22:00 · Sáng → Trưa → Chiều → Tối`.
- **Bộ đếm tự tính:** `6 điểm · 2 khung trống` (bỏ vế bằng 0; ngày chưa có gì hiện `Chưa có lịch`).
- **Đường timeline dọc** nối các khung giờ, mỗi khung có một chấm tròn.

Mỗi khung giờ gồm:

- **Giờ** (`07:00 – 09:00`) và **buổi tự suy ra**: `Buổi sáng`, `Buổi trưa`, `Buổi chiều`, `Buổi tối`, hoặc khung vắt qua hai buổi như `Trưa → chiều`.
  - Sáng trước 11:00 · Trưa 11:00–12:59 · Chiều 13:00–17:59 · Tối từ 18:00.
- **Giờ nổi bật:** giờ bắt đầu in đậm cỡ lớn, giờ kết thúc nhỏ bên cạnh.
- **Chấm màu theo loại** cạnh nhãn: ăn uống (`Breakfast`, `Lunch`, `Dinner`, `Street food`) cam · `Coffee` nâu · `Nature` xanh lá · `Sunset` cam hồng · `Check-in`, `Cute spot` xanh dương. Nhãn khác hiện chấm xám; thêm màu mới trong `css/timeline.css` (`.tag[data-tag="…"]`).
- **Thẻ địa điểm:** icon trong ô màu, tên địa điểm in đậm cỡ lớn, nhãn phân loại (`NATURE`, `COFFEE`, `SUNSET`…). Phần sau dấu ` — ` trong `title` hiện thành dòng mô tả nhỏ bên dưới tên (vd. `Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê`).
- **Link `📍 Maps`:** mở Google Maps tìm đúng địa điểm trong tab mới.
- **Khung trống:** thẻ viền nét đứt (`🍚 Ăn trưa — Tự do`), không tính vào số điểm.

### 4. Trạng thái chuyến đi

Panel tối màu nổi đè lên mép dưới banner, nằm trên thanh tab — vì nó thuộc về cả chuyến đi chứ không riêng ngày nào. Nội dung tự đổi theo thời điểm:

| Thời điểm | Nhãn | Nội dung |
|---|---|---|
| **Trước chuyến đi** | `Đếm ngược khởi hành` | Ô đếm ngược `ngày · giờ · phút · giây` (bỏ đơn vị 0 ở đầu, luôn giữ ít nhất 2 ô), đồng hồ cát lật cát chảy, ghi chú `Đà Lạt đang chờ · bắt đầu 07:00 · Th 6, 16/10` |
| **Đang ở một khung giờ** | `Đang diễn ra` | Tên điểm hiện tại, ghi chú `Đến 12:15 · đã qua 2/16 điểm`, chấm xanh nhấp nháy |
| **Giữa hai khung giờ** | `Đang di chuyển` | Tên điểm kế tiếp, ghi chú `Tiếp theo lúc 09:15 · đã qua 1/16 điểm` |
| **Sau chuyến đi** | `Hành trình đã khép lại` | `Hẹn gặp lại Đà Lạt ✦`, ghi chú `Đã đi qua 16 điểm trong 3 ngày` |

- Đếm ngược cập nhật mỗi giây; các trạng thái còn lại cập nhật mỗi 15 giây.
- Tiến độ chỉ đếm địa điểm thật, không đếm khung trống.
- Có hiệu ứng vệt sáng quét chậm qua panel.

### 5. Theo dõi thời gian thực

Trong thời gian chuyến đi, trang tự phản ánh "bây giờ":

- **Khung đang diễn ra** được làm nổi: viền và giờ đổi màu nhấn, chấm có vòng sáng, thêm nhãn `ĐANG DIỄN RA`.
- **Khung đã qua** tự mờ đi: thẻ chuyển nền xanh nhạt, chữ nhạt, giờ mờ, chấm đổi màu đậm — không cần bấm gì.
- **Tự mở đúng ngày:** mở trang trong lúc đang đi, tab tự chuyển sang ngày hiện tại và cuộn tới khung đang diễn ra.
- Giờ trong dữ liệu tính theo múi giờ chuyến đi (`+07:00`), nên xem từ máy ở múi giờ khác vẫn đúng.

**Xem trước một thời điểm bất kỳ** bằng tham số `?now=` (dùng để kiểm tra, không ảnh hưởng người xem thường):

```
https://huucao.github.io/dalat/?now=2026-10-16T12:00:00%2B07:00   # đang giữa ngày 1
https://huucao.github.io/dalat/?now=2026-10-19T00:00:00%2B07:00   # đã kết thúc
```

Đồng hồ bắt đầu từ mốc đó rồi chạy tiếp như bình thường.

### 6. Animation

**Khi mở trang:** dòng nhỏ, tiêu đề, phụ đề, chip lần lượt trượt lên; thanh tab trượt lên. Ở lớp B còn thêm ảnh hero thu nhỏ hiện dần và thumbnail bay vào từ bên phải — ở lớp A hai phần này chuyển sang hiệu ứng theo cuộn bên dưới.

**Nội dung từng ngày hiện ra khi cuộn tới** — chạy theo thời lượng cố định, nên vuốt nhanh hay chậm đều thấy rõ; giống nhau trên mọi trình duyệt:

| Phần tử | Hiệu ứng | Thời lượng |
|---|---|---|
| Tiêu đề ngày | trượt lên, phóng nhẹ | 0.8s |
| Khung giờ lẻ / chẵn | bay vào từ trái / phải, nghiêng 3D | 0.8s; các khung xuất hiện cùng lúc so le 90ms |
| Chấm timeline | nảy quá đà rồi co lại, kèm vòng sáng | 0.6s, sau thẻ 0.25s |
| Đường timeline | tự vẽ từ trên xuống | 1.4s, sau tiêu đề ngày |

- **Đổi tab thì chạy lại** cho ngày vừa mở; panel ngày mờ dần vào (0.35s).
- Đang cuộn sâu mà đổi tab, trang tự đưa ngày được chọn lên ngay dưới thanh tab để thấy trọn hiệu ứng.
- Chỉnh tốc độ ở một chỗ: token `--reveal-duration` và `--reveal-stagger` trong `css/tokens.css`.

**Gắn theo vị trí cuộn** — trang tự chọn lớp bằng một script nhỏ cuối `<head>`, chạy trước lần vẽ đầu tiên:

| Hiệu ứng | Lớp A — CSS scroll-driven | Lớp B — dự phòng |
|---|---|---|
| Ảnh hero zoom ra và trôi xuống (parallax) | ✓ | ✓ bằng `requestAnimationFrame` |
| Chữ hero bay lên, thu nhỏ, nhoè dần | ✓ (có blur) | ✓ (bỏ blur cho máy yếu) |
| Thumbnail văng chéo ra | ✓ | ✓ |
| Lớp phủ hero tối dần | ✓ | — |
| Thanh tab hiện bóng đổ khi bắt đầu cuộn | ✓ | — |
| Thanh tiến trình đọc ở mép trên màn hình | ✓ | ✓ |

- Lớp A chạy trên compositor, cuộn ngược thì hiệu ứng chạy ngược.
- Người dùng bật **"Giảm chuyển động"** (`prefers-reduced-motion`) sẽ không thấy animation nào, nội dung hiện đầy đủ ngay.
- Nội dung chỉ bị ẩn khi JavaScript đã gắn class `.reveal` — thiếu điều kiện đó thì không gì bị ẩn, nội dung không bao giờ kẹt ở trạng thái vô hình.

### 7. Tối ưu cho điện thoại

- **Mobile-first:** giao diện gốc viết cho điện thoại, máy tính (từ 761px) được bổ sung thêm.
- **Ảnh nét mà không tải thừa:** mỗi ảnh có nhiều kích thước, trình duyệt tự chọn theo màn hình.
  - Hero 800 / 1600 / 2560px — iPhone tải bản 1600, máy tính retina tải bản 2560 (đã tính cả hệ số zoom của parallax).
  - Thumbnail 240 / 480px, tải lười — điện thoại không hiện thumbnail nên **không tải** hai ảnh này.
  - Ảnh hero được ưu tiên tải trước.
- **Dễ bấm:** tab cao tối thiểu 44px; link `📍 Maps` có vùng chạm 44px dù chữ nhỏ.
- **Không "dính" hover** sau khi chạm trên iPhone — hiệu ứng hover chỉ bật trên thiết bị có chuột.
- **Không cuộn ngang** ở mọi độ rộng (đã kiểm tra 360, 390, 430, 1440px).
- Panel đếm ngược tự xuống dòng các ô số trên màn hình hẹp.
- Thanh địa chỉ trình duyệt đổi màu xanh theo trang (`theme-color`); không chặn zoom.

### 8. Dữ liệu và xử lý lỗi

- **Chỉ sửa một file** (`data/trip.json`) để thay đổi toàn bộ lịch trình — xem [Sửa lịch trình](#sửa-lịch-trình).
- **Tự sắp xếp:** ngày theo ngày tháng, khung giờ theo giờ bắt đầu — nhập theo thứ tự nào cũng được.
- **Kiểm tra dữ liệu** trước khi hiển thị, báo lỗi chỉ đúng vị trí:
  - `days[1].items[0].end: phải sau start`
  - `days[0].items[2].start: phải có dạng HH:MM`
  - `hero.image.src: phải chứa {w}`
- **Lỗi tải hoặc sai cú pháp JSON:** trang hiện hộp thông báo `Không tải được lịch trình` kèm chi tiết, thay vì trang trắng.
- **Tắt JavaScript:** hiện hướng dẫn mở bằng link trong trình duyệt.

### 9. Truy cập và an toàn

- Tab dùng đúng vai trò ARIA (`tablist` / `tab` / `tabpanel`, `aria-selected`, `aria-controls`), thao tác được bằng bàn phím, có viền focus rõ.
- Ảnh trang trí có `alt=""`, SVG trang trí có `aria-hidden`.
- Nội dung từ dữ liệu luôn được chèn dạng văn bản (`textContent`), không bao giờ dạng HTML.
- Link ngoài mở tab mới với `rel="noopener noreferrer"`.

---

## Hỗ trợ trình duyệt

| Môi trường | Hiệu ứng theo cuộn | Kết quả |
|---|---|---|
| Chrome / Edge 115+ (máy tính, Android) | A | Đầy đủ |
| Safari / iOS 26+ | A | Đầy đủ |
| Safari / iOS 15–18 | B | Đầy đủ tính năng, animation dự phòng |
| Mở link trong trình duyệt của Zalo | A hoặc B | Tự nhận theo phiên bản WebView |
| Firefox | B | Tự chuyển sang A khi Firefox hỗ trợ |
| Bấm thẳng file đính kèm (iOS Quick Look), mở `file://` | — | Không chạy — hãy gửi link |

---

## Chạy local

Trang dùng ES modules và `fetch`, nên phải chạy qua HTTP server (double-click file sẽ không chạy):

```bash
npm run dev              # npx serve .
# hoặc
python3 -m http.server
```

Mở địa chỉ server in ra, thêm `?now=…` nếu muốn xem một thời điểm cụ thể.

## Kiểm thử

```bash
npm test
```

Cần Node ≥ 18, không phải cài package nào. Unit test phủ phần logic thuần:

| File | Kiểm tra |
|---|---|
| `tests/time.test.js` | Định dạng giờ/ngày, thứ trong tuần, suy ra buổi cho mọi khung giờ, điền `{days}`/`{nights}` |
| `tests/trip.test.js` | Số ngày/đêm/điểm/khung trống, `srcset`, link Maps, sắp xếp, thông báo lỗi dữ liệu |
| `tests/status.test.js` | Trạng thái trước / trong / giữa / sau chuyến đi, biên đầu–cuối khung giờ, ô đếm ngược |
| `tests/motion.test.js` | Parallax dự phòng khớp CSS, giới hạn giá trị, ảnh hero không bao giờ hở mép |
| `tests/clock.test.js` | Tham số `?now=` |

Phần giao diện được kiểm tra trên Chrome headless (iPhone và máy tính): chọn đúng ảnh, không cuộn ngang, trạng thái thời gian thực, cả hai lớp animation, giảm chuyển động, dữ liệu lỗi, thêm ngày mới.

## Sửa lịch trình

Chỉ sửa `data/trip.json`. Thêm ngày = thêm một object vào `days`; thêm điểm = thêm một object vào `items`. Tab, số điểm, khung trống, thứ/ngày, buổi và đếm ngược tự tính lại.

```json
{
  "date": "2026-10-19",
  "icon": "🧳",
  "note": "Ngày thêm",
  "items": [
    { "start": "09:00", "end": "10:30", "icon": "☕", "title": "Cà phê sáng", "tag": "Coffee", "map": "cà phê view đồi Đà Lạt" },
    { "start": "11:00", "end": "12:00", "icon": "🍜", "title": "Ăn trưa — Chưa chọn", "empty": true }
  ]
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `timezone` | có | Múi giờ chuyến đi, dạng `+07:00` |
| `hero.title` | có | |
| `hero.eyebrow`, `hero.chips[]` | không | |
| `hero.subtitle`, `footer.title` | không | Dùng được `{days}`, `{nights}`, `{dates}` (vd. `16 – 18/10`) |
| `hero.image`, `hero.thumbs[]` | không | `{ "src": "assets/img/hero-{w}.jpg", "widths": [800, 1600, 2560] }` — mỗi width là một file có sẵn |
| `footer.note` | không | |
| `days[].date` | có | `YYYY-MM-DD` |
| `days[].icon`, `days[].note` | không | |
| `items[].start`, `items[].end` | có | `HH:MM`, cùng ngày, `end` sau `start` |
| `items[].title` | có | |
| `items[].icon`, `items[].tag` | không | |
| `items[].map` | không | Từ khóa tìm trên Google Maps; có thì hiện link `📍 Maps` |
| `items[].empty` | không | `true` = khung trống, không tính là điểm |

## Cấu trúc thư mục

```
index.html              khung trang + script chọn lớp animation
data/trip.json          toàn bộ nội dung
assets/img/             ảnh nhiều kích thước
css/
  tokens.css            màu, bo góc, bóng, easing
  base.css              nền tảng, footer, thanh tiến trình, thông báo lỗi
  hero.css · tabs.css · timeline.css · countdown.css
  motion/
    keyframes.css       toàn bộ keyframes
    load.css            animation lúc mở trang
    scroll-timeline.css hiệu ứng theo cuộn (lớp A)
    reveal.css          nội dung ngày hiện ra khi cuộn tới / đổi tab
js/
  main.js               tải dữ liệu → dựng trang → khởi động
  lib/                  giờ, đồng hồ, tính toán animation, tạo DOM
  model/                dữ liệu → model, trạng thái chuyến đi (thuần, có test)
  views/                hero, tabs, ngày, panel trạng thái, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, reveal, parallax dự phòng
tests/                  node --test
docs/                   spec và plan
```

Luồng dữ liệu một chiều: `trip.json` → `model` (kiểm tra, tính số liệu) → `views` (dựng DOM) → `controllers` (tương tác, thời gian thực, animation).

## Deploy

GitHub Pages phục vụ nhánh `main`, thư mục gốc. Push lên `main` là trang tự cập nhật sau 1–2 phút; nếu không thấy thay đổi, tải lại bằng `Cmd + Shift + R`.

## Tài liệu

- [Thiết kế](docs/specs/2026-09-11-dynamic-render-design.md) — kiến trúc, schema, animation chi tiết và 16 lỗi đã gặp cần tránh.
- [Kế hoạch triển khai](docs/plans/2026-09-11-dynamic-render.md).

## Nguồn ảnh

Ảnh theo [Unsplash License](https://unsplash.com/license):

- Hero — Pete Walls: https://unsplash.com/photos/Fl3bY0hWXv4
- Thumbnail A — Pete Walls: https://unsplash.com/photos/RTSpODtSxTw
- Thumbnail B — Điệp Zader: https://unsplash.com/photos/i29Z07meKds
