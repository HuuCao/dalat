# Đà Lạt Trip Plan

Lịch trình chuyến Đà Lạt: https://huucao.github.io/dalat/

## Chạy local

Trang dùng ES modules và `fetch`, nên phải chạy qua HTTP server (double-click file sẽ không chạy):

```bash
npm run dev              # npx serve .
# hoặc
python3 -m http.server
```

Xem trước một thời điểm bất kỳ: thêm `?now=2026-10-16T12:00:00%2B07:00` vào URL.

## Test

```bash
npm test
```

Cần Node ≥ 18, không phải cài package nào.

## Sửa lịch trình

Chỉ sửa `data/trip.json`. Thêm ngày = thêm một object vào `days`; thêm điểm = thêm một object vào `items`. Tab, số điểm, khung trống, thứ/ngày, buổi và đếm ngược tự tính lại.

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `timezone` | có | `+07:00` |
| `hero.title` | có | |
| `hero.subtitle`, `footer.title` | không | Dùng được `{days}`, `{nights}` |
| `hero.image`, `hero.thumbs[]` | không | `{ "src": "assets/img/hero-{w}.jpg", "widths": [800, 1600, 2560] }` — mỗi width là một file có sẵn |
| `days[].date` | có | `YYYY-MM-DD` |
| `days[].icon`, `days[].note` | không | |
| `items[].start`, `items[].end` | có | `HH:MM`, `end` sau `start` |
| `items[].title` | có | |
| `items[].icon`, `items[].tag` | không | |
| `items[].map` | không | Từ khóa tìm trên Google Maps |
| `items[].empty` | không | `true` = khung trống, không tính là điểm |

Dữ liệu sai sẽ hiện thông báo lỗi kèm vị trí, ví dụ `days[1].items[0].end: phải sau start`.

## Cấu trúc

```
data/trip.json      nội dung
js/lib/             tiện ích thuần (giờ, animation fallback, đồng hồ, tạo DOM)
js/model/           dữ liệu → model, trạng thái chuyến đi (thuần, có test)
js/views/           model → DOM
js/controllers/     tabs, đồng hồ, animation fallback
css/                theo component, mobile-first
css/motion/         keyframes, animation lúc tải, lớp A, lớp B
tests/              node --test
```

## Animation

Hai lớp, chọn bằng script cuối `<head>`:

- **A** — CSS scroll-driven (`animation-timeline`), Chrome 115+, Safari 26+.
- **B** — IntersectionObserver + `requestAnimationFrame`, cho trình duyệt còn lại (`html.no-scroll-timeline`).

Chi tiết và các lỗi đã gặp: [docs/specs/2026-09-11-dynamic-render-design.md](docs/specs/2026-09-11-dynamic-render-design.md), mục 10.

## Nguồn ảnh

Ảnh theo [Unsplash License](https://unsplash.com/license):

- Hero — Pete Walls: https://unsplash.com/photos/Fl3bY0hWXv4
- Thumb A — Pete Walls: https://unsplash.com/photos/RTSpODtSxTw
- Thumb B — Điệp Zader: https://unsplash.com/photos/i29Z07meKds
