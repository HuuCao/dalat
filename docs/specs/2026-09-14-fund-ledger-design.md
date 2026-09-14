# Đà Lạt Trip Plan — Quỹ chung & minh bạch chi phí

- **Ngày:** 2026-09-14
- **Trạng thái:** Chờ duyệt
- **Phạm vi:** Thêm chi phí dự kiến cho từng khung giờ và chi phí chung vào `data/trip.json`; nhóm 4 người ghi thực chi qua Google Form → Google Sheet; trang đọc CSV đã publish, đối chiếu dự kiến / thực chi theo từng địa điểm, từng ngày, cả chuyến, và quyết toán quỹ cho từng người.

## 1. Bối cảnh

Nhóm 4 người (Hữu, MiMi, Khanh, Trâm) đóng quỹ chung cho chuyến Đà Lạt 16–18/10/2026. Cần:

1. Biết mỗi địa điểm **dự kiến** tốn bao nhiêu và **thực tế** đã chi bao nhiêu.
2. Ghi được các khoản **phát sinh** ngoài plan (áo mưa, gửi xe, taxi…).
3. Tính vào quỹ cả **khách sạn, vé xe, xe máy** — thường chi trước chuyến, thường do một người trả trước.
4. Cuối chuyến biết chính xác mỗi người được hoàn / phải nộp thêm bao nhiêu.

Trang là site tĩnh trên GitHub Pages — không ghi dữ liệu được. Đã cân nhắc 3 hướng:

| Hướng | Kết luận |
|---|---|
| A. Google Form → Sheet, trang đọc CSV publish | **Chọn.** Cả 4 người nhập bằng điện thoại, không backend, Sheet có version history |
| B. Thủ quỹ commit `expenses` vào repo | Loại: chỉ 1 người ghi, không real-time, sửa file trên điện thoại dễ sai |
| C. Backend (Firebase/Supabase) | Loại: cần auth, phá nguyên tắc 0 dependency |

**Đánh đổi đã chấp nhận:** link CSV publish là công khai — ai có link (kể cả người đọc source trang) đọc được tên và số tiền, không sửa được.

## 2. Mục tiêu

1. Mỗi card khung giờ hiện dự kiến vs thực chi, bấm mở được danh sách từng khoản.
2. Mỗi ngày hiện tổng thực chi / dự kiến và khối phát sinh ngoài plan.
3. Tab `💰 Quỹ`: tổng quan, theo ngày, chi phí chung, quyết toán từng người, sổ góp, sổ chi.
4. Nhập chi tiêu trong ~10 giây trên điện thoại; nút nhập từ card / panel trạng thái **chọn sẵn địa điểm**.
5. Không khoản tiền nào biến mất khỏi sổ vì lỗi nhập liệu: dòng lỗi vẫn tính (khi còn đọc được số tiền) và hiện cảnh báo.
6. Lịch trình không bao giờ bị ảnh hưởng khi phần quỹ lỗi hoặc mất mạng.

## 3. Ngoài phạm vi

- Ảnh hóa đơn (Form upload file bắt buộc đăng nhập Google).
- Thêm / sửa / xóa khoản chi ngay trên trang — sửa trực tiếp trong Sheet.
- Đăng nhập, phân quyền trên trang.
- Chuyển tiền trực tiếp giữa các thành viên, thuật toán tối thiểu số giao dịch — quỹ là trung gian (mục 6.5).
- Nhiều loại tiền tệ.
- Vai trò "thủ quỹ" trong dữ liệu — `Quỹ` là một bên trả tiền, ai giữ tiền quỹ là việc của nhóm.

## 4. Dữ liệu

### 4.1. `data/trip.json`

**Khung giờ** thêm `budget` (VND, số nguyên ≥ 0, không bắt buộc):

```json
{ "start": "09:15", "end": "10:30", "icon": "☕", "title": "Hidden Land", "tag": "Coffee", "map": "Hidden Land coffee Đà Lạt", "budget": 200000 }
{ "start": "16:30", "end": "17:45", "icon": "🌫️", "title": "Dốc Sương Nguyệt Ánh", "tag": "Sunset", "map": "Dốc Sương Nguyệt Ánh Đà Lạt", "budget": 0 }
```

- `budget: 0` → `Miễn phí`.
- Không có `budget` → không có số dự kiến (vẫn nhận thực chi).
- Dự kiến mỗi người (`50k/người`) = `budget / members.length`, không lưu.
- Khung trống (`empty: true`) nhận `budget` như khung thường.

**Khối `fund`** ở cấp gốc (không bắt buộc — thiếu thì trang chạy như hiện tại, không có mọi phần quỹ):

```json
"fund": {
  "members": ["Hữu", "MiMi", "Khanh", "Trâm"],
  "csv": {
    "expenses": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
    "contributions": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
  },
  "form": { "url": "https://docs.google.com/forms/d/e/…/viewform", "placeField": "entry.1234567" },
  "sheet": "https://docs.google.com/spreadsheets/d/…/edit",
  "shared": [
    { "title": "Vé xe 2 chiều", "icon": "🚌", "budget": 2800000, "note": "700k/người" },
    { "title": "Khách sạn",     "icon": "🏨", "budget": 1080000, "note": "270k/đêm/phòng" },
    { "title": "Xe máy",        "icon": "🛵", "budget": 400000,  "note": "100k/xe/ngày" }
  ]
}
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `fund.members` | có | ≥ 1 tên, không trùng (so sánh sau chuẩn hóa, mục 6.1) |
| `fund.csv.expenses`, `fund.csv.contributions` | có | Link CSV publish, phải bắt đầu `https://docs.google.com/` |
| `fund.form.url` | không | Có thì hiện các nút `➕ Nhập…`. Phải bắt đầu `https://docs.google.com/forms/` |
| `fund.form.placeField` | không | Dạng `entry.<số>`; có thì nút nhập chọn sẵn địa điểm |
| `fund.sheet` | không | Có thì hiện nút `📄 Mở Google Sheet`. Phải bắt đầu `https://docs.google.com/` |
| `fund.shared[].title` | có | Không trùng nhau, không được là `Phát sinh` |
| `fund.shared[].icon`, `.note` | không | |
| `fund.shared[].budget` | không | Số nguyên ≥ 0 |

`csv`, `form`, `sheet` điền sau khi tạo Form/Sheet (hướng dẫn từng bước sẽ thêm vào README — xem mục 9).

### 4.2. Budget ban đầu

Theo bảng dự kiến của nhóm (Floating Town đã chốt 440k).

| Nhóm | Khoản | Dự kiến |
|---|---|---|
| Chung | Vé xe 2 chiều | 2.800.000 |
| | Khách sạn | 1.080.000 |
| | Xe máy | 400.000 |
| **Chung** | | **4.280.000** |
| Day 1 | Đồi chè Cầu Đất | 280.000 |
| | Hidden Land | 200.000 |
| | Gà nướng + Cơm lam | 400.000 |
| | Trại Mèo Mướp | 440.000 |
| | Phong Miên quán | 200.000 |
| | Dốc Sương Nguyệt Ánh | 0 |
| | Tháp Vinaphone Đà Lạt | 0 |
| | Ăn tối — Đồ nướng | 1.200.000 |
| | Ăn vặt chợ Đà Lạt | 400.000 |
| **Day 1** | | **3.120.000** |
| Day 2 | Ăn sáng — Bánh căn | 240.000 |
| | Floating Town | 440.000 |
| | Cà phê — Tự do | 280.000 |
| | Ăn trưa — Tự do | 400.000 |
| | Cà phê Chênh Vênh | 400.000 |
| | Mountain Chill | 280.000 |
| | Ăn tối — Lẩu | 800.000 |
| | Ăn vặt chợ Đà Lạt | 200.000 |
| **Day 2** | | **3.040.000** |
| Day 3 | Ăn sáng — Tự do | 240.000 |
| | Cà phê — Tự do | 280.000 |
| | Ăn trưa — Tự do | 400.000 |
| | Go Home | *(không có budget — đã tính trong vé xe)* |
| **Day 3** | | **920.000** |
| **Tổng** | | **11.360.000 · 2.840.000/người** |

### 4.3. Nhãn địa điểm (dropdown Form)

Mỗi nơi tiền có thể được chi có **một nhãn duy nhất**, dùng làm lựa chọn trong Form và làm khóa ghép dòng CSV:

| Loại | Nhãn |
|---|---|
| Chi phí chung | `Chung · {shared.title}` |
| Phát sinh chung (trước/sau chuyến, không thuộc ngày) | `Chung · Phát sinh` |
| Khung giờ | `Day {N} · {item.title}` |
| Phát sinh trong ngày | `Day {N} · Phát sinh` |

Thứ tự: các nhãn `Chung · …` (theo thứ tự `shared`, `Phát sinh` cuối) → từng ngày (khung theo giờ bắt đầu, `Phát sinh` cuối ngày). Dùng `title` đầy đủ (vd. `Day 2 · Cà phê — Tự do`) để người nhập phân biệt được.

`buildTrip` gắn `formLabel` cho mỗi item. Kiểm tra: trong cùng một ngày không có hai `title` trùng nhau và không có `title` là `Phát sinh`.

`npm run form-options` in danh sách nhãn, mỗi dòng một nhãn — paste vào lựa chọn đầu tiên của câu hỏi dropdown, Google Form tự tách thành từng lựa chọn. Với dữ liệu hiện tại là 28 nhãn.

### 4.4. Google Sheet

Sheet đặt **Locale = Việt Nam** (File → Settings).

**Tab `ChiTieu`** — Form tự đổ vào. Trang tìm cột theo **tên** (bỏ khoảng trắng thừa, không phân biệt hoa thường, chuẩn hóa NFC), không theo vị trí.

| Cột | Câu hỏi Form | Bắt buộc có cột | Giá trị |
|---|---|---|---|
| `Dấu thời gian` hoặc `Timestamp` | Form tự thêm | không | Chỉ để sắp xếp / hiển thị |
| `Người nhập` | Dropdown, bắt buộc | không | Tên trong `members` |
| `Địa điểm` | Dropdown, bắt buộc | có | Nhãn mục 4.3 |
| `Số tiền` | Trả lời ngắn, xác thực số > 0 | có | `260000` |
| `Ai trả` | Trắc nghiệm, bắt buộc | có | `Quỹ` hoặc tên thành viên |
| `Chia cho` | Checkbox, không bắt buộc | có | Rỗng = chia đều cả nhóm; nhiều tên nối bằng `, ` |
| `Ghi chú` | Trả lời ngắn | không | |

**Tab `GopQuy`** — thủ quỹ nhập tay.

| Cột | Bắt buộc có cột | Giá trị |
|---|---|---|
| `Ngày` | không | Văn bản, hiển thị nguyên dạng |
| `Người góp` | có | Tên trong `members` |
| `Số tiền` | có | |
| `Ghi chú` | không | |

Mỗi tab publish riêng dạng CSV (File → Share → Publish to web).

## 5. Luồng dữ liệu

```
trip.json ─► buildTrip ─► render lịch trình (ngay, không chờ quỹ)
                             │
                             └─► fund controller ─► fetch 2 CSV song song ─► parseCsv
                                                   ─► buildLedger(trip, rows, now) ─► cập nhật DOM quỹ
```

- `model/fund.js` và `lib/csv.js` là **hàm thuần**, không DOM, không fetch — có unit test.
- View dựng sẵn các vùng giữ chỗ (`[data-money="<nhãn>"]`, tab Quỹ rỗng); controller điền / thay nội dung khi có sổ quỹ — cùng cách `controllers/status.js` cập nhật `.item[data-id]`.

## 6. Cách tính

### 6.1. Chuẩn hóa

- **Tên / nhãn / tên cột:** `trim` → gộp khoảng trắng → `normalize('NFC')` → `toLocaleLowerCase('vi')` khi so sánh. Hiển thị dùng tên gốc trong `members`. (Bàn phím điện thoại có thể gõ `Trâm` dạng NFD — nhìn giống nhưng khác mã.)
- **Số tiền:** bỏ mọi ký tự không phải chữ số (`260.000`, `260,000đ`, `260000` → `260000`). Kết quả rỗng hoặc 0 → dòng không hợp lệ.
- **Ai trả:** `Quỹ` (so sánh chuẩn hóa) → quỹ trả; tên thành viên → người đó ứng.
- **Chia cho:** tách theo `,`; rỗng → toàn bộ `members`.

### 6.2. Xử lý dòng lỗi

Số dòng trong cảnh báo = số dòng trên Sheet (dòng tiêu đề là 1).

| Lỗi | Tính vào tổng chi | Tính vào quyết toán | Cảnh báo |
|---|---|---|---|
| Số tiền rỗng / 0 / không có chữ số | không | không | `Dòng 7 · Số tiền "abc" không hợp lệ` |
| Địa điểm không khớp nhãn | có (nhóm "Không khớp") | có | `Dòng 7 · Địa điểm "Day 1 · Hiden Land" không khớp` |
| Ai trả không phải `Quỹ` / thành viên | có | **không** | `Dòng 9 · Ai trả "Tram" không phải thành viên` |
| Chia cho có tên lạ | có | **không** | `Dòng 9 · Chia cho "Tram" không phải thành viên` |
| Góp quỹ: tên lạ | không | không | `GopQuy dòng 3 · Người góp "Tram" không phải thành viên` |
| Góp quỹ: số tiền lỗi | không | không | `GopQuy dòng 3 · Số tiền … không hợp lệ` |

Có ít nhất một dòng bị loại khỏi quyết toán hoặc bị bỏ vì số tiền / người góp không hợp lệ → bảng quyết toán hiện `⚠️ Có N dòng cần sửa — số liệu chưa chốt`. Dòng có địa điểm không khớp hiện trong tab Quỹ dưới mục `⚠️ Không khớp địa điểm` với số tiền.

### 6.3. Chia tiền lẻ

Chia theo đồng nguyên: `phần = floor(số tiền / số người)`, phần dư `r` đồng cộng 1đ cho `r` người đầu tiên theo thứ tự `members`. Tổng các phần luôn bằng số tiền.

### 6.4. Số liệu

| Cấp | Số liệu |
|---|---|
| Nhãn (khung giờ / chi phí chung / phát sinh) | `budget` (có thể không có), `actual`, `diff = actual − budget`, danh sách khoản |
| Ngày | `budget` = tổng budget các khung; `actual` = khung + phát sinh ngày; `extra` = phát sinh ngày |
| Chung | như ngày, cho `shared` + `Chung · Phát sinh` |
| Cả chuyến | `budget` (11.360k), `actual` (mọi khoản hợp lệ, gồm không khớp), `extra` (mọi phát sinh), `contributed` (tổng góp), `fundPaid` (khoản `Quỹ` trả), `fundLeft = contributed − fundPaid`, `reserve = contributed − budget` |
| Thành viên | `contributed`, `advanced` (khoản người đó ứng), `share` (tổng phần chia), `balance = contributed + advanced − share` |

Chỉ các dòng không bị loại khỏi quyết toán mới vào `fundPaid`, `advanced`, `share`. **Bất biến:** `Σ balance = fundLeft` (luôn đúng, vì dòng bị loại không vào cả hai vế). Khi có dòng bị loại, `fundLeft` có thể lệch tiền mặt thực tế trong quỹ — cờ "chưa chốt" (mục 6.2) báo điều này.

`reserve < 0` → hiện `Chưa góp đủ · thiếu X` thay cho `Dự phòng`.

### 6.5. Quyết toán

Mỗi thành viên chỉ giao dịch với quỹ:

- `balance > 0` → `Quỹ hoàn {tên} {balance}`
- `balance < 0` → `{tên} nộp thêm vào quỹ {|balance|}`
- `balance = 0` → không có dòng

Trước `trip.end` (theo đồng hồ trang, hỗ trợ `?now=`): tiêu đề `Quyết toán · tạm tính`, chỉ hiện bảng, **không** hiện dòng chuyển tiền. Từ `trip.end`: bỏ "tạm tính", hiện mục `Chốt quỹ` với các dòng chuyển tiền, sắp theo số tiền giảm dần.

Ví dụ — mỗi người góp 3.000k, Hữu quẹt thẻ khách sạn 1.080k, chuyến hết đúng dự kiến 11.360k:

| | Hữu | MiMi | Khanh | Trâm |
|---|---|---|---|---|
| Góp | 3.000k | 3.000k | 3.000k | 3.000k |
| Ứng | 1.080k | 0 | 0 | 0 |
| Chịu | 2.840k | 2.840k | 2.840k | 2.840k |
| **Còn lại** | **+1.240k** | **+160k** | **+160k** | **+160k** |

Quỹ còn 1.720k = 1.240 + 160 × 3.

## 7. Giao diện

Mockup dùng tình huống: mỗi người góp 3.000k; Quỹ trả vé xe 2.800k; Hữu ứng khách sạn 1.080k; Day 1: Cầu Đất 300k, Hidden Land 260k, Trại Mèo 440k, phát sinh áo mưa 120k (Quỹ trả), Khanh ứng gà nướng 540k; đang chiều Day 1.

### 7.1. Định dạng tiền (`lib/money.js`)

- **Gọn** (`short`): nghìn đồng, dấu chấm phân cách, tối đa 1 chữ số thập phân dấu phẩy, bỏ `,0`: `1660000 → 1.660k`, `33333 → 33,3k`, `0 → 0`.
- **Đủ** (`full`): `260000 → 260.000đ`.
- Chênh lệch có dấu: `▲ 60k` (vượt), `▼ 20k` (dưới), `✓` (bằng). Số dư: `+2.695k` / `−200k`.
- Tổng, bảng, chip dùng gọn; chi tiết từng khoản dùng đủ.

### 7.2. Card khung giờ

Khi có `fund`, mọi card (kể cả khung trống) có dòng 💰 ở cuối card, là `<details>`:

```
╭──────────────────────────────────
│ ☕ Hidden Land
│ ● COFFEE                   📍 Maps
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
│ 💰 260k / 200k          ▲ 60k   ▾
╰──────────────────────────────────
```

| Trạng thái | Nội dung `<summary>` | Màu |
|---|---|---|
| Chưa tải xong | `💰 …` | xám |
| Có budget > 0, chưa chi | `💰 Dự kiến 200k · 50k/người` | xám |
| Có chi, dưới dự kiến | `💰 180k / 200k   ▼ 20k` | xanh lá |
| Có chi, bằng dự kiến | `💰 440k / 440k   ✓` | xanh lá |
| Có chi, vượt dự kiến | `💰 260k / 200k   ▲ 60k` | cam đỏ |
| budget 0, chưa chi | `🆓 Miễn phí` | xám |
| budget 0, có chi | `💰 20k · ngoài dự kiến` | cam đỏ |
| Không budget, chưa chi | `💰 Chưa chi` | xám |
| Không budget, có chi | `💰 540k` | mặc định |

Mở ra:

```
│ 💰 260k / 200k          ▲ 60k   ▴
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
│ 260.000đ                   Quỹ trả
│ 4 nước + bánh · chia 4
│ MiMi nhập · 16/10 09:40
│
│                 [ ➕ Nhập chi ở đây ]
```

- Mỗi khoản: số tiền đủ · `Quỹ trả` / `{tên} ứng` · ghi chú · `chia 4` hoặc `chia Hữu, MiMi` · người nhập · thời gian. Khoản mới nhất trên cùng.
- Chưa có khoản: `Chưa có khoản chi`.
- `➕ Nhập chi ở đây` chỉ hiện khi có `fund.form.url`; chọn sẵn nhãn khi có `placeField` (mục 7.8).

### 7.3. Thẻ ngày

Dưới dòng ngày tháng thêm dòng tổng và thanh tiến độ (`actual / budget`, tối đa 100%, vượt thì thanh đầy màu cam đỏ):

```
│ 🌿 Day 1                    9 điểm
│ Th 6, 16/10 · 07:00 → 22:00 · …
│ 💰 1.660k / 3.120k · phát sinh 120k
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░
```

Phát sinh 0 thì bỏ vế `· phát sinh …`.

**Khối phát sinh** — đặt **sau** `.timeline` trong `article.day` (animation CSS phụ thuộc `.day-head` ngay trước `.timeline` và `.item` là con trực tiếp của `.timeline` — không được chèn gì vào giữa):

```
  ⚡ PHÁT SINH NGOÀI PLAN · 120k
  ╭────────────────────────────────
  │ 120.000đ               Quỹ trả
  │ Áo mưa x4 · chia 4
  │ Trâm nhập · 16/10 13:10
  ╰────────────────────────────────
                [ ➕ Nhập phát sinh ]
```

Không có khoản → `⚡ Phát sinh · 0` và nút nhập. Nút chọn sẵn `Day N · Phát sinh`.

### 7.4. Panel trạng thái

Thêm một phần tử riêng trong `.status` (ngay sau panel đếm ngược, **không** nằm trong `countdown.element` để vòng tick của status không ghi đè):

```
│ 💰 Quỹ còn 8.080k    [ ➕ Nhập chi ]
```

- Nút `➕ Nhập chi` (khi có `form.url`): trong chuyến và đang ở một khung giờ → chọn sẵn nhãn khung đó; giữa hai khung → khung kế tiếp trong ngày; trước / sau chuyến → Form trống. Link tính **lúc bấm** bằng `getStatus(trip, clock())`.
- Chưa tải xong: `💰 Quỹ …`. Lỗi không có dữ liệu cũ: `💰 Không tải được quỹ`.

### 7.5. Thanh tab

```
[ Tất cả ][ Day 1 ][ Day 2 ][ Day 3 ][ 💰 Quỹ ]
```

- Tab id `fund`, panel `#panel-fund` với `data-day="fund"`.
- `Tất cả` hiện mọi panel **trừ** panel quỹ; `aria-controls` của `Tất cả` không gồm `panel-fund`.
- Phím `←` `→` `Home` `End` bao gồm tab Quỹ.
- `reveal.replay(panel)` không làm gì với panel quỹ — panel chỉ mờ dần vào như animation đổi tab hiện có.

### 7.6. Tab 💰 Quỹ

Thứ tự khối:

1. **Đầu:** `💰 QUỸ CHUYẾN ĐI` · `Cập nhật 14:05` · nút `↻`. Offline dùng dữ liệu cũ: `Dữ liệu lúc 14:05 · đang offline`.
2. **Cảnh báo** (chỉ khi có): danh sách mục 6.2.
3. **Tổng quan** — lưới 2×2: `Đã góp` · `Đã chi` · `Quỹ còn` · `Dự phòng` (hoặc `Chưa góp đủ`); dưới là thanh `Thực chi / dự kiến` (`5.540k / 11.360k`).
4. **Theo ngày** — bảng `Dự kiến · Thực chi · Phát sinh` cho `Chung`, `Day 1…N`, dòng `Tổng`. (Không có cột chênh lệch: ngày đang diễn ra so với cả ngày dự kiến gây hiểu nhầm.)
5. **Chi phí chung** — mỗi `shared` và `Phát sinh chung` là một `<details>` giống card (mục 7.2): `🚌 Vé xe 2 chiều   2.800k / 2.800k  ✓  ▾`.
6. **Không khớp địa điểm** (chỉ khi có) — `<details>` liệt kê khoản.
7. **Quyết toán** — bảng `Góp · Ứng · Chịu · Còn lại` mỗi thành viên, dòng cuối `Quỹ còn X`; mục 6.5 cho tạm tính / chốt quỹ.
8. **Sổ góp quỹ** — `<details>`: `▸ Sổ góp quỹ · 4 khoản · 12.000k`, mở ra từng dòng `Ngày · Người góp · Số tiền · Ghi chú`.
9. **Sổ chi** — `<details>`: `▸ Sổ chi · 7 khoản · 5.540k`, mở ra mọi khoản hợp lệ, mới nhất trên cùng: `16/10 13:10 · Day 1 · Phát sinh · 120.000đ` / `Áo mưa x4 · Quỹ trả · chia 4 · Trâm`.
10. **Nút:** `➕ Nhập chi tiêu` (Form trống, khi có `form.url`) · `📄 Mở Google Sheet` (khi có `sheet`).

Bảng quyết toán 5 cột phải vừa 360px không cuộn ngang trang: số dùng `font-variant-numeric: tabular-nums`, cỡ chữ nhỏ hơn thân bài; nếu vẫn tràn thì bảng cuộn ngang trong khung riêng `overflow-x: auto`.

### 7.7. Màu & chuyển động

- Token mới trong `css/tokens.css`: `--money-over` (cam đỏ), `--money-under` (xanh lá, dùng lại xanh hiện có nếu hợp), `--money-muted` (xám).
- Không animation mới. `prefers-reduced-motion` giữ nguyên hành vi hiện có.
- Mọi nút `➕` / `📄` mở tab mới, `rel="noopener noreferrer"`, vùng chạm ≥ 44px.

### 7.8. Link Form chọn sẵn

```js
const url = new URL(fund.form.url);
url.searchParams.set('usp', 'pp_url');
url.searchParams.set(fund.form.placeField, label);
```

Không có `placeField` → dùng `fund.form.url` nguyên dạng.

## 8. Tải dữ liệu & xử lý lỗi

### 8.1. Tải

- Fetch `expenses` và `contributions` song song, thêm tham số chống cache trình duyệt `&_={timestamp}`. (Google vẫn có độ trễ publish phía server ~5 phút — ghi rõ trong README.)
- Kiểm tra phản hồi: `!response.ok` → lỗi HTTP; nội dung bắt đầu bằng `<` (sau khi bỏ BOM/khoảng trắng) → `Sheet chưa publish dạng CSV`.
- **Tự tải lại:** mỗi 5 phút khi `document.visibilityState === 'visible'`; ngay khi trang chuyển sang visible nếu lần tải cuối > 1 phút; khi bấm `↻`. Không chồng request: đang tải thì bỏ qua lần kích hoạt mới.
- **Cập nhật tại chỗ:** thay nội dung vùng giữ chỗ, giữ trạng thái mở của mọi `<details>` (khóa theo nhãn / id khối), không chạy lại reveal.
- **Offline:** lưu `{ fetchedAt, expensesText, contributionsText }` vào `localStorage` khóa `fund-cache:v1` sau mỗi lần tải thành công. Tải lỗi mà có cache → dùng cache, hiện `Dữ liệu lúc HH:MM · đang offline`. Mọi truy cập `localStorage` bọc `try/catch`.

### 8.2. Lỗi

| Tình huống | Kết quả |
|---|---|
| Không có `fund` | Không có phần quỹ nào |
| `fund` hoặc `budget` sai (mục 4.1, 4.3) | `buildTrip` ném lỗi đúng vị trí, trang hiện hộp lỗi như hiện tại. Vd. `days[0].items[1].budget: phải là số nguyên ≥ 0`, `fund.members[2]: trùng tên "Hữu"`, `fund.csv.expenses: phải là link https://docs.google.com/`, `days[1].items[4].title: trùng nhãn "Day 2 · Cà phê — Tự do"` |
| Mất mạng / HTTP lỗi / chưa publish, **có** cache | Dùng cache + dòng offline |
| Như trên, **không** cache | Chỉ phần quỹ báo: tab Quỹ `Không tải được sổ quỹ` + chi tiết + nút `Thử lại`; chip `💰 —`; panel `💰 Không tải được quỹ`. Lịch trình không đổi |
| CSV thiếu cột bắt buộc | Như lỗi tải: `ChiTieu: thiếu cột "Số tiền"` / `GopQuy: thiếu cột "Người góp"` |
| Dòng lỗi | Mục 6.2 |

### 8.3. An toàn

- Nội dung từ CSV chỉ chèn bằng `textContent` (qua `h()`), không bao giờ HTML.
- Link Form / Sheet / CSV phải bắt đầu đúng tiền tố `https://docs.google.com/…` (kiểm tra trong `buildTrip`) — chặn `javascript:` và domain lạ.
- Link chọn sẵn dựng bằng `URL` + `searchParams`.

## 9. File

| File | Thay đổi |
|---|---|
| `js/lib/csv.js` | **Mới.** `parseCsv(text) → string[][]`: ô trong nháy kép, `""` thoát nháy, dấu phẩy và xuống dòng trong ô, CRLF, BOM, bỏ dòng rỗng cuối |
| `js/lib/money.js` | **Mới.** `formatShort`, `formatFull`, `formatDiff`, `formatBalance` |
| `js/model/trip.js` | Kiểm tra `budget`, `fund`; gắn `formLabel`; trả `trip.fund` đã chuẩn hóa (members, shared kèm `formLabel`, danh sách nhãn theo thứ tự mục 4.3) |
| `js/model/fund.js` | **Mới.** `buildLedger(trip, { expenses, contributions }, now)` → sổ quỹ (mục 6); `readTable(rows, name, required)` tìm cột theo tên; `prefillUrl(fund, label)` |
| `js/controllers/fund.js` | **Mới.** Tải, tự tải lại, cache, gọi view cập nhật, xử lý lỗi (mục 8) |
| `js/views/fund.js` | **Mới.** Tab Quỹ; `renderMoney(details, entry)` dùng chung cho card và chi phí chung; khối phát sinh; dòng quỹ ở panel trạng thái |
| `js/views/day.js` | Vùng giữ chỗ dòng 💰 trong card, dòng tổng ngày, khối phát sinh sau `.timeline` (chỉ khi có `fund`) |
| `js/views/tabs.js` | Thêm tab Quỹ khi có `fund`; `aria-controls` của `Tất cả` chỉ gồm ngày |
| `js/controllers/tabs.js` | `Tất cả` ẩn panel quỹ |
| `js/controllers/reveal.js` | Bỏ qua panel quỹ khi replay |
| `js/main.js` | Dựng panel quỹ + dòng quỹ trong `.status`, khởi động `startFund` |
| `css/fund.css` | **Mới.** Dòng 💰, chi tiết khoản, thanh tiến độ, khối phát sinh, tab Quỹ, bảng |
| `css/tokens.css` | Token màu tiền |
| `index.html` | `<link>` tới `css/fund.css` |
| `scripts/form-options.js` | **Mới.** Đọc `data/trip.json`, `buildTrip`, in nhãn mỗi dòng |
| `package.json` | Script `"form-options": "node scripts/form-options.js"` |
| `data/trip.json` | Budget mục 4.2 + khối `fund` (link điền sau khi tạo Form/Sheet) |
| `README.md` | Mục tính năng Quỹ; schema mới; **hướng dẫn từng bước** tạo Form, liên kết Sheet, đổi tên tab, đặt Locale, publish CSV, lấy `placeField`, chạy `form-options`; lưu ý link công khai và độ trễ ~5 phút |
| `tests/csv.test.js`, `tests/money.test.js`, `tests/fund.test.js` | **Mới** |
| `tests/trip.test.js` | Thêm ca `budget`, `fund`, `formLabel`, lỗi trùng nhãn |

## 10. Kiểm thử

### 10.1. Spike trước khi code (chặn tiến độ)

Tạo Sheet thử, publish 1 tab CSV, fetch từ `https://huucao.github.io` (hoặc origin local) để xác nhận:

1. CORS cho phép đọc (qua redirect sang `googleusercontent.com`).
2. Tham số `&_=` không làm hỏng link.
3. Định dạng thực tế với Locale Việt Nam: tên cột timestamp, số tiền từ Form (có dấu chấm phân cách không), checkbox nhiều lựa chọn (dấu phân cách), ô có dấu phẩy được bọc nháy.

Kết quả khác mục 4.4 / 8.1 → cập nhật spec trước khi làm tiếp. CORS bị chặn → dừng, báo lại để chọn hướng khác.

### 10.2. Unit test (`npm test`)

| File | Ca kiểm tra |
|---|---|
| `csv.test.js` | Ô thường; nháy kép; `""`; dấu phẩy trong ô (`"Hữu, MiMi"`); xuống dòng trong ô; CRLF; BOM; dòng rỗng cuối |
| `money.test.js` | `0`, `33333 → 33,3k`, `1660000 → 1.660k`, `260000 → 260.000đ`, dấu ▲▼✓, số dư âm |
| `fund.test.js` | Tìm cột theo tên (thứ tự đảo, hoa thường, NFD); thiếu cột bắt buộc; số tiền `260.000` / `260,000đ` / rỗng / `abc`; tên NFD khớp NFC; `Quỹ` / thành viên / tên lạ; chia cho rỗng = cả nhóm; chia lẻ 100.000 / 3 tổng đúng; địa điểm không khớp vẫn tính; dòng bị loại khỏi quyết toán + cờ chưa chốt; tổng khung / ngày / chung / phát sinh / cả chuyến; `reserve` âm; **bất biến `Σ balance = fundLeft`**; tạm tính trước `trip.end`, chốt quỹ từ `trip.end`; `prefillUrl` có / không `placeField`, nhãn có ký tự đặc biệt |
| `trip.test.js` | `budget` hợp lệ / âm / thập phân / chuỗi; không `fund` → không lỗi; `members` rỗng / trùng (NFC); link sai tiền tố; `shared` trùng / tên `Phát sinh`; nhãn trùng trong ngày; thứ tự danh sách nhãn (28 nhãn với dữ liệu thật) |

### 10.3. Trình duyệt

Chrome headless, iPhone (390px, 360px) và máy tính (1440px), dùng CSV mẫu phục vụ local:

- Không cuộn ngang ở 360px, kể cả tab Quỹ và bảng quyết toán.
- Chip đủ các trạng thái mục 7.2; mở `<details>` rồi tải lại → vẫn mở.
- `Tất cả` không hiện panel quỹ; phím mũi tên tới tab Quỹ.
- Nút nhập chọn sẵn đúng nhãn (card, phát sinh, panel trạng thái với `?now=` giữa Day 1).
- `?now=2026-10-19T00:00:00%2B07:00` → hiện `Chốt quỹ`.
- CSV 404 không cache → chỉ phần quỹ báo lỗi; có cache → dòng offline.
- Trả HTML thay CSV → `Sheet chưa publish dạng CSV`.
- Không có `fund` → trang giống hệt bản hiện tại.
- `prefers-reduced-motion` → không animation.

## 11. Điều chỉnh khi lập kế hoạch

Các điểm dưới đây thay thế nội dung tương ứng ở trên.

1. **`fund.csv` không bắt buộc.** Có `fund` mà chưa có `csv` → trang hiện dự kiến (chip `Dự kiến …`, tổng ngày, tab Quỹ với dòng `Chưa kết nối Google Sheet`, panel `💰 Dự kiến 11.360k`), không tải gì. Nhờ vậy budget lên trang được trước khi tạo Form/Sheet. Có `csv` thì phải đủ cả `expenses` và `contributions`.
2. **Nút `➕ Nhập chi` ở panel trạng thái** chọn sẵn khung **đang diễn ra**, nếu đang giữa hai khung thì chọn khung **vừa kết thúc** (thay vì khung kế tiếp) — người ta thường trả tiền rồi mới rời đi. Trước / sau chuyến → Form trống.
3. **Dòng quỹ ở panel trạng thái** là một thẻ sáng riêng ngay dưới panel tối, không nằm trong panel tối.
4. **Dòng thời gian tab Quỹ:** `Cập nhật HH:MM` (vừa tải), `Dữ liệu lúc HH:MM · đang tải bản mới` (đang dùng bản lưu lúc mở trang), `Dữ liệu lúc HH:MM · chưa tải được bản mới` (tải lỗi, dùng bản lưu), `Chưa kết nối Google Sheet`.
5. **`js/controllers/reveal.js` không cần sửa:** panel quỹ không chứa `.item` / `.day-head` nên `replay()` tự không làm gì.
6. **Thêm `js/lib/text.js`** với `keyOf()` — chuẩn hóa dùng chung cho tên, nhãn, tên cột (mục 6.1).
7. **`Quỹ` là tên dành riêng**, không được dùng trong `fund.members`.
8. **Kiểm tra trùng tên khung trong ngày chỉ chạy khi có `fund`.** Thông báo: `days[1].items[4].title: trùng tên "Cà phê — Tự do" trong cùng ngày`, `…title: "Phát sinh" là tên dành riêng`.
9. **Spike (mục 10.1) chuyển thành task cuối** — cần Form/Sheet thật của nhóm. Code đọc CSV được viết chịu lỗi định dạng (tìm cột theo tên, lọc chữ số) và kiểm bằng CSV mẫu; task cuối đối chiếu với CSV thật, lệch thì sửa parser trước khi gắn link.
