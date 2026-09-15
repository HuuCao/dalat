# Đà Lạt Trip Plan — Lịch trình từ Google Sheet

- **Ngày:** 2026-09-15
- **Trạng thái:** Chờ duyệt
- **Phạm vi:** Lịch trình (các ngày, khung giờ) và chi phí chung chuyển từ `data/trip.json` sang 3 tab của Google Sheet quỹ đang dùng; trang đọc CSV đã publish, lưu bản gần nhất trên máy, bỏ dòng lỗi kèm cảnh báo. Một Apps Script trong Sheet tự đồng bộ dropdown `Địa điểm` của Google Form. Không đổi giao diện lịch trình, cách tính quỹ, animation.

## 1. Bối cảnh

Plan Đà Lạt chưa chốt, đổi liên tục. Hiện mỗi lần đổi phải:

1. Sửa `data/trip.json`, push `main` → GitHub Pages deploy lại.
2. Chạy `npm run form-options`, dán lại danh sách vào câu hỏi `Địa điểm` của Form. Quên bước này → khoản chi mới nhập cho khung đổi tên rơi vào `Không khớp địa điểm`.

Cả nhóm đã quen sửa Google Sheet (ChiTieu, GopQuy). Đã cân nhắc:

| Hướng | Kết luận |
|---|---|
| A. Tab CSV publish → adapter đổi thành raw trip, `buildTrip` giữ nguyên | **Chọn.** Ít đổi code nhất, test cũ còn nguyên, cùng cơ chế với quỹ |
| B. Viết lại `buildTrip` đọc thẳng dòng Sheet | Loại: đổi nhiều, không thêm gì |
| C. Apps Script Web App trả JSON | Loại: cold start 1–3s, mỗi lần sửa script phải deploy version, logic ngoài repo không test được |
| D. File Excel trên OneDrive / trong repo | Loại: OneDrive vướng CORS, không nối được Form; trong repo vẫn phải push |

**Đánh đổi đã chấp nhận:** CSV publish công khai (như quỹ). Google cần ~5 phút sau khi sửa mới công bố CSV mới.

## 2. Mục tiêu

1. Sửa lịch trình / chi phí chung trong Sheet trên điện thoại → trang tự cập nhật, không đụng code.
2. Dropdown `Địa điểm` của Form tự khớp lịch trình vài giây sau khi sửa Sheet.
3. Mở trang nhanh như hiện tại khi đã từng mở; mất sóng vẫn xem được bản gần nhất.
4. Sửa dở / nhập sai một dòng không làm sập trang: dòng đó bị bỏ, có cảnh báo chỉ đúng dòng.
5. Nhãn Form giữ nguyên dạng `Day N · Tên`, `Chung · Tên` → khoản chi đã nhập vẫn khớp.

## 3. Ngoài phạm vi

- Thành viên, hero, ảnh, footer, link Form/CSV — vẫn ở `trip.json` (hầu như không đổi).
- Đồng bộ các câu hỏi `Người nhập` / `Ai trả` / `Chia cho` của Form.
- Tự đổi tên dòng cũ trong ChiTieu khi đổi tên địa điểm.
- Tự dựng lại trang tại chỗ (không reload): controllers không có teardown (timer, listener window/document, IntersectionObserver), refactor không đáng.
- Tự tải lại lịch trình định kỳ khi đang mở trang.
- Sửa lịch trình ngay trên trang.

## 4. Dữ liệu

### 4.1. Tab `LichTrinh` — mỗi khung giờ một dòng

| Cột | Bắt buộc | Nhận | Ghi chú |
|---|---|---|---|
| `Ngày` | có | `16/10/2026`, `2026-10-16` | `D/M/YYYY` theo khu vực Việt Nam |
| `Bắt đầu`, `Kết thúc` | có | `07:00`, `7:00`, `7:00:00` | Chuẩn hóa về `HH:MM`; `Kết thúc` > `Bắt đầu` |
| `Tên` | có | | `Nơi — hoạt động` như hiện tại |
| `Icon` | không | | |
| `Tag` | không | | |
| `Maps` | không | | Từ khóa Google Maps |
| `Dự kiến` | không | `280000`, `280.000`, `280,000đ` | Trống = không có dự kiến; `0` = Miễn phí |
| `Trống` | không | `TRUE`, `x`, `có` (không phân biệt hoa thường) | Checkbox Sheet publish ra `TRUE` / `FALSE` |

- Cột tìm theo tên (`keyOf`, như quỹ) → thứ tự cột, dòng tùy ý. Trang tự sắp theo ngày rồi giờ.
- Dòng 1 là tiêu đề; số dòng trong cảnh báo = số dòng thấy trong Sheet.

### 4.2. Tab `Ngay` — không bắt buộc có dòng

| Cột | Bắt buộc | Ghi chú |
|---|---|---|
| `Ngày` | có | Như 4.1 |
| `Icon` | không | Icon tab ngày |
| `Ghi chú` | không | `note` của ngày |

Danh sách ngày = hợp các ngày có trong `LichTrinh` và `Ngay`. Ngày chỉ có ở `Ngay` hiện `Chưa có lịch`.

### 4.3. Tab `ChiChung`

| Cột | Bắt buộc | Ghi chú |
|---|---|---|
| `Tên` | có | Không trùng, không là `Phát sinh` |
| `Icon` | không | |
| `Dự kiến` | không | Như 4.1 |
| `Ghi chú` | không | vd. `700k/người` |

### 4.4. `data/trip.json`

Thêm khối `plan` ở cấp gốc:

```json
"plan": {
  "items": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
  "days": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
  "shared": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
}
```

- `items` = tab `LichTrinh`, `days` = `Ngay`, `shared` = `ChiChung`. Cả 3 bắt buộc khi có `plan`, phải bắt đầu bằng `https://docs.google.com/`.
- **Có `plan`:** `days` và `fund.shared` lấy từ Sheet; nếu JSON vẫn còn hai trường này thì bị bỏ qua.
- **Không có `plan`:** chạy như hiện tại (dùng `days`, `fund.shared` trong JSON). Giữ đường này cho test và chạy local offline.
- Có `plan` mà thiếu `fund` → chỉ dùng `items` + `days`, bỏ qua `shared`.

### 4.5. `readPlan` — `js/model/plan.js`

Hàm thuần:

```js
readPlan({ items, days, shared }) // text CSV của 3 tab
// → { days: [{ date, icon?, note?, items: [{ start, end, title, icon?, tag?, map?, budget?, empty? }] }],
//     shared: [{ title, icon?, budget?, note? }],
//     warnings: ['LichTrinh dòng 7 · …'] }
```

Kết quả ghép vào raw trip (`{ ...json, days, fund: { ...json.fund, shared } }`) rồi đưa vào `buildTrip` như cũ. Trường rỗng không được ghi vào object (để `buildTrip` thấy `undefined` như JSON cũ).

Dùng `readTable` (chuyển sang `js/lib/table.js`) để tìm cột; tab thiếu cột bắt buộc → `readTable` ném lỗi `LichTrinh: thiếu cột "Bắt đầu"` → cả bản bị coi là không dựng được (mục 5.3).

## 5. Tải dữ liệu

### 5.1. Luồng (`js/controllers/plan.js` + `main.js`)

1. Tải `data/trip.json`. Không có `plan` → dựng trang như cũ, dừng.
2. Đọc `plan-cache:v1` trong localStorage: `{ urls: { items, days, shared }, fetchedAt, items, days, shared }` (3 trường cuối là text CSV). `urls` khác link hiện tại, bản lưu hỏng, hoặc bản lưu không còn dựng được (5.3 — vd. code mới đổi quy tắc) → coi như không có.
3. **Có bản lưu** → dựng trang từ bản lưu ngay; ghi lại mốc `openedAt`; tải ngầm 3 CSV song song.
4. **Không có bản lưu** → chờ tải 3 CSV → dựng trang → ghi bản lưu. Tải lỗi hoặc không dựng được → trang lỗi hiện có (`renderError`, `Không tải được lịch trình` + lý do).
5. Tải CSV dùng `fetchCsv` chung với quỹ (chuyển sang `js/lib/csv.js`): thêm `_=<timestamp>`, `cache: 'no-store'`, timeout 15s, `assertCsv` bắt trang đăng nhập Google.
6. Ba tab là một khối: một tab lỗi → cả lần tải lỗi. Không ghép tab mới với tab cũ.

### 5.2. Quyết định sau khi tải ngầm — `decide()`

Hàm thuần, test được:

```js
decide({ cached, fresh, buildable, elapsedMs, lastReloadAt, now })
// → 'none' | 'touch' | 'save' | 'reload' | 'toast'
```

| Tình huống | Kết quả | Hành động |
|---|---|---|
| Tải lỗi | `none` | Giữ bản lưu, `console.error`, không hiện gì |
| Nội dung giống hệt bản lưu | `touch` | Chỉ cập nhật `fetchedAt` + dòng footer |
| Khác, nhưng không dựng được (5.3) | `none` | Không ghi đè, `console.error` |
| Khác, dựng được, `lastReloadAt` trong 60s | `save` | Ghi bản lưu, không reload (lần mở sau thấy) |
| Khác, dựng được, `elapsedMs` ≤ 4000 | `reload` | Ghi bản lưu, ghi `plan-reloaded-at` vào sessionStorage, `location.reload()` |
| Khác, dựng được, `elapsedMs` > 4000 | `toast` | Ghi bản lưu, hiện toast `🔄 Lịch trình vừa thay đổi · Tải lại` |

- `elapsedMs` tính từ `openedAt` tới lúc tải xong.
- Chặn 60s tránh lặp khi edge cache của Google trả xen kẽ bản cũ / mới. sessionStorage không đọc/ghi được → không có cách chặn lặp qua reload → dùng `toast` thay cho `reload`.
- localStorage bị chặn → luôn đi đường "không có bản lưu", không bao giờ reload/toast.

### 5.3. "Dựng được"

Một bản dựng được khi: `readPlan` không ném (đủ cột bắt buộc) **và** `buildTrip` trên raw đã ghép không ném (còn ≥ 1 khung giờ hợp lệ, v.v.). Chỉ bản dựng được mới được ghi vào bản lưu.

### 5.4. Dòng lỗi

`readPlan` bỏ dòng lỗi, ghi cảnh báo, không bao giờ ném vì một dòng:

| Lỗi | Xử lý | Cảnh báo (ví dụ) |
|---|---|---|
| Dòng trắng hoàn toàn | Bỏ, không báo | — |
| `Ngày` sai dạng | Bỏ | `LichTrinh dòng 5 · Ngày "32/10/2026" không hợp lệ` |
| `Bắt đầu` / `Kết thúc` sai dạng | Bỏ | `LichTrinh dòng 6 · Bắt đầu "7h" không hợp lệ` |
| `Kết thúc` ≤ `Bắt đầu` | Bỏ | `LichTrinh dòng 7 · Kết thúc "09:00" phải sau Bắt đầu "10:00"` |
| Thiếu `Tên` | Bỏ | `LichTrinh dòng 8 · thiếu Tên` |
| `Tên` là `Phát sinh` | Bỏ | `LichTrinh dòng 9 · "Phát sinh" là tên dành riêng` |
| Trùng `Tên` trong cùng ngày | Bỏ dòng sau, giữ dòng đầu | `LichTrinh dòng 12 · trùng tên "Hidden Land" với dòng 4` |
| `Dự kiến` không đọc được | Giữ dòng, không có dự kiến | `LichTrinh dòng 10 · Dự kiến "hai trăm" không hợp lệ` |
| `Ngay`: ngày sai / trùng | Bỏ dòng / bỏ dòng sau | `Ngay dòng 3 · trùng ngày 16/10/2026 với dòng 2` |
| `ChiChung`: thiếu tên / `Phát sinh` / trùng | Bỏ | `ChiChung dòng 4 · trùng tên "Khách sạn" với dòng 3` |

- So trùng tên dùng `keyOf` (như `validateFormTitles`). Trùng tên luôn bị bỏ, kể cả khi không có `fund` — đơn giản, vô hại.
- "Dòng đầu" / "dòng sau" theo thứ tự trong Sheet, trước khi sắp xếp.

## 6. Giao diện

### 6.1. Banner cảnh báo — `js/views/plan-warnings.js`

- Chỉ hiện khi `warnings.length > 0`, đầu `<main>` trước các panel, hiện ở mọi tab.
- `<details>`: summary `⚠️ Lịch trình có N dòng lỗi`; mở ra là danh sách cảnh báo và link `Mở Sheet` (`fund.sheet`, có thì hiện; mở tab mới, `rel="noopener noreferrer"`).
- Chữ luôn chèn bằng `textContent`.
- Dùng lại style cảnh báo của tab Quỹ: chuyển rule từ `css/fund.css` sang `css/base.css` dưới tên class chung, tab Quỹ đổi sang class đó.
- Đếm "dòng lỗi" = số cảnh báo (mỗi cảnh báo một dòng Sheet; `Dự kiến` sai vẫn tính là cảnh báo).

### 6.2. Toast — `js/views/update-toast.js`

- Cố định đáy màn hình, giữa, trên nút nổi `+ Nhập chi` (không che nó); nằm ngoài `<main>` như `now-hint`.
- Chữ `🔄 Lịch trình vừa thay đổi` + nút `Tải lại` (`location.reload()`) + nút đóng `✕`.
- `role="status"`; hiện một lần, không tự ẩn. Giảm chuyển động → hiện không animation.

### 6.3. Footer

Thêm dòng nhỏ `Lịch trình cập nhật HH:MM` (giờ theo máy, từ `fetchedAt`) khi có `plan`. `touch` cập nhật dòng này tại chỗ.

## 7. Apps Script — `scripts/apps-script/form-sync.js`

JS thuần, không `import`/`export` (Apps Script không hỗ trợ module). Người dùng dán vào Sheet → Tiện ích mở rộng → Apps Script.

### 7.1. Hàm

| Hàm | Làm gì |
|---|---|
| `setup()` | Chạy tay 1 lần trong editor. Xin quyền; xóa trigger `syncForm` cũ (nếu có) rồi tạo trigger cài đặt `onChange` cho spreadsheet → `syncForm` |
| `syncForm()` | Tính nhãn → cập nhật câu `Địa điểm` nếu khác. Trả về `{ changed, count }` |
| `onOpen()` | Trigger đơn giản: thêm menu `🔄 Đồng bộ Form` → `syncFromMenu()` |
| `syncFromMenu()` | Gọi `syncForm`, toast `Đã cập nhật 26 địa điểm` / `Form đã khớp (26 địa điểm)`; lỗi → `ui.alert` |

### 7.2. `syncForm`

1. `LockService.getScriptLock().waitLock(30000)`: các lần chạy nối tiếp nhau, mỗi lần đọc Sheet sau khi có khóa → lần sửa cuối luôn được đồng bộ. Hết 30s chưa có khóa → ném lỗi (Google email).
2. Form: `FormApp.openByUrl(SpreadsheetApp.getActive().getFormUrl())`. Không có form liên kết → ném `Sheet chưa liên kết Google Form`.
3. Đọc `LichTrinh`, `ChiChung` bằng `getDataRange().getDisplayValues()` (chuỗi theo khu vực, cùng dạng với CSV publish).
4. Tính nhãn bằng `planLabels(itemsRows, sharedRows)` — cùng quy tắc với trang (mục 7.3).
5. Tìm item có tiêu đề `Địa điểm` (so như `keyOf`), loại `LIST`. Không có → ném `Không tìm thấy câu hỏi "Địa điểm" (menu thả xuống)`.
6. So với `getChoices().map(c => c.getValue())`; giống hệt → `{ changed: false }`; khác → `setChoiceValues(labels)`.

Lỗi từ trigger: Google tự email chủ script.

### 7.3. Quy tắc nhãn — phải khớp trang

`planLabels` lặp lại phần tối thiểu của `readPlan` + `buildFund` (~40 dòng):

1. `ChiChung`: bỏ dòng thiếu tên / `Phát sinh` / trùng → `Chung · <Tên>` theo thứ tự dòng, rồi `Chung · Phát sinh`.
2. `LichTrinh`: bỏ dòng ngày sai, giờ sai, `Kết thúc` ≤ `Bắt đầu`, thiếu tên, `Phát sinh`, trùng tên trong ngày (giữ dòng đầu).
3. Ngày = hợp các ngày của dòng `LichTrinh` còn lại sau bước 2 và các dòng `Ngay` có ngày hợp lệ (script đọc cả cột `Ngày` của tab `Ngay`). Ngày không có khung giờ vẫn chiếm một số `N` và có nhãn `Day N · Phát sinh` — như `buildFund` của trang.
4. Sắp ngày tăng dần → `Day N` (N từ 1). Trong ngày sắp theo `Bắt đầu` → `Day N · <Tên>`, cuối ngày `Day N · Phát sinh`.

Sắp xếp phải ổn định giống trang: khung cùng giờ bắt đầu giữ thứ tự dòng trong Sheet (`Array.prototype.sort` ổn định ở cả V8 Node và Apps Script).

Test `tests/form-sync.test.js` giữ hai bên không lệch (mục 9.1).

### 7.4. Giới hạn đã chấp nhận

- Đổi tên / chuyển ngày một địa điểm sau khi đã có khoản chi → dòng cũ rơi vào `Không khớp địa điểm` (như hiện nay); sửa tên trong ChiTieu.
- Thêm ngày trước ngày đầu tiên → mọi `Day N` dịch số, khoản đã nhập lệch hết. Ghi rõ trong README.
- Vài giây giữa lúc sửa Sheet và lúc dropdown đổi: link Form chọn sẵn cho địa điểm mới có thể chưa chọn được (Form bỏ qua giá trị không có trong dropdown).
- Trang thấy thay đổi sau ~5 phút (publish CSV), Form thấy sau vài giây — trong khoảng đó trang có thể chưa có nhãn mà Form đã có. Khoản nhập lúc đó vẫn khớp khi trang cập nhật.

## 8. File

**Mới**

| File | Vai trò |
|---|---|
| `js/lib/table.js` | `readTable`, `parseAmount` chuyển từ `model/fund.js` |
| `js/model/plan.js` | `readPlan`, parse ngày/giờ/dự kiến/checkbox, cảnh báo; `mergePlan(json, plan)` ghép raw trip |
| `js/controllers/plan.js` | `loadPlan` (bản lưu, tải, `decide`, reload/toast); `decide` export riêng |
| `js/views/plan-warnings.js` | Banner 6.1 |
| `js/views/update-toast.js` | Toast 6.2 |
| `scripts/apps-script/form-sync.js` | Mục 7 |
| `tests/fixtures/trip.json` | Bản `data/trip.json` đầy đủ hiện tại (có `days`, `fund.shared`) |
| `tests/table.test.js` · `tests/plan.test.js` · `tests/plan-cache.test.js` · `tests/form-sync.test.js` | Mục 9.1 |

**Sửa**

| File | Thay đổi |
|---|---|
| `js/lib/csv.js` | Thêm `fetchCsv` (chuyển từ `controllers/fund.js`) |
| `js/model/fund.js` | Import `readTable`, `parseAmount` từ `lib/table.js` |
| `js/controllers/fund.js` | Import `fetchCsv` từ `lib/csv.js` |
| `js/model/trip.js` | Kiểm tra `plan.items/days/shared` là link `docs.google.com` |
| `js/main.js` | Có `plan` → luồng 5.1; mount banner, toast; footer nhận `fetchedAt` |
| `js/views/footer.js` | Dòng `Lịch trình cập nhật HH:MM`, trả về hàm cập nhật |
| `js/views/fund.js` · `css/fund.css` · `css/base.css` | Style cảnh báo dùng chung; style banner, toast |
| `tests/trip.test.js` · `tests/fund.test.js` · `tests/status.test.js` · `tests/calendar.test.js` | Đọc `tests/fixtures/trip.json` thay cho `data/trip.json` |
| `package.json` | Bỏ script `form-options` |
| `README.md` | "Sửa lịch trình" → sửa trong Sheet; "Kết nối Google Form / Sheet" thêm 3 tab + cài Apps Script; bảng test; cấu trúc thư mục; tài liệu |
| `data/trip.json` | **Bước cuối (mục 10):** thêm `plan`, xóa `days` và `fund.shared` |

**Xóa:** `scripts/form-options.js`.

## 9. Kiểm thử

### 9.1. Unit test (`npm test`)

- `tests/table.test.js` — test `readTable`, `parseAmount` chuyển từ `fund.test.js`, không đổi nội dung.
- `tests/plan.test.js`
  - Parse: `16/10/2026`, `6/9/2026`, `2026-10-16`, ngày không tồn tại; `7:00`, `07:00`, `7:00:00`, `24:00`; dự kiến trống / `0` / `280.000` / chữ; `TRUE` / `FALSE` / `x` / trống.
  - Mỗi dòng trong bảng 5.4: bị bỏ hay giữ, đúng chữ cảnh báo, đúng số dòng.
  - Tab thiếu cột bắt buộc → ném `LichTrinh: thiếu cột "…"`.
  - Ngày gộp từ `LichTrinh` + `Ngay`; ngày chỉ ở `Ngay` có `items: []`.
  - Trường rỗng không xuất hiện trong object.
  - **Round-trip:** `tests/fixtures/trip.json` → CSV 3 tab (helper trong test) → `readPlan` → `mergePlan` → `buildTrip` ≡ `buildTrip(fixture)` (so `days`, `items`, `fund.shared`, `fund.labels`, `placeCount`).
- `tests/plan-cache.test.js` — `decide()` cho mọi dòng bảng 5.2, biên `elapsedMs` = 4000 / 4001, `lastReloadAt` 59s / 61s trước.
- `tests/form-sync.test.js` — nạp `form-sync.js` bằng `node:vm` với `SpreadsheetApp`, `FormApp`, `LockService`, `ScriptApp` giả:
  - `planLabels` trên fixture có dòng lỗi (cả ngày chỉ có ở `Ngay`) ≡ `buildTrip(mergePlan(…, readPlan(…))).fund.labels`.
  - Lựa chọn giống → không gọi `setChoiceValues`; khác → gọi đúng một lần với danh sách mới.
  - Không có câu `Địa điểm` / Sheet chưa liên kết Form → ném đúng thông báo.
  - `setup()` chạy 2 lần → chỉ 1 trigger.

### 9.2. Trình duyệt (Chrome headless, iPhone + máy tính)

Chặn request tới 3 link `plan`, trả CSV fixture:

1. Lần đầu (không bản lưu) → chờ tải, trang đúng, footer có giờ cập nhật.
2. Mở lại → hiện ngay từ bản lưu (trước khi request trả về).
3. CSV đổi, trả trong 1s → reload đúng 1 lần, trang mới đúng.
4. CSV đổi, trả sau 5s → không reload, hiện toast; bấm `Tải lại` → trang mới.
5. Request lỗi / timeout, có bản lưu → trang bản lưu, không toast, không banner.
6. Request lỗi, không bản lưu → trang lỗi.
7. Có dòng lỗi → banner đúng số, mở ra đúng danh sách, link Sheet.
8. Mọi dòng `LichTrinh` lỗi, có bản lưu → giữ bản lưu, không reload; không bản lưu → trang lỗi.
9. Không có `plan` → trang như trước thay đổi.
10. Tab Quỹ vẫn chạy (dự kiến chi chung lấy từ `ChiChung`, cảnh báo quỹ vẫn đúng style).
11. Không cuộn ngang; toast không che nút nổi `+ Nhập chi`.

### 9.3. Apps Script (tay, trên Sheet thật)

1. Dán script, chạy `setup` → cấp quyền → 1 trigger `onChange`.
2. Sửa tên một khung → vài giây sau dropdown Form đổi.
3. Xóa một dòng → địa điểm biến khỏi dropdown.
4. Gửi Form một khoản chi → trigger chạy, không đổi dropdown (xem Executions).
5. Mở lại Sheet → menu `🔄 Đồng bộ Form` chạy, toast đúng số.

## 10. Triển khai

1. Merge code. `data/trip.json` chưa có `plan` → trang chạy y như cũ.
2. Tạo 3 tab `LichTrinh`, `Ngay`, `ChiChung` trong spreadsheet quỹ; dán TSV tạo sẵn từ `data/trip.json` hiện tại (script một lần trong scratchpad, không commit). Định dạng cột `Bắt đầu` / `Kết thúc` là văn bản thuần hoặc giờ đều được; cột `Trống` chèn checkbox.
3. Publish CSV cho 3 tab (giữ "Tự động công bố lại").
4. Dán Apps Script, chạy `setup`, kiểm tra 9.3.
5. Thêm `plan` vào `data/trip.json`, xóa `days` và `fund.shared`, kiểm tra local, push.

Từ đây sửa lịch trình / chi phí chung chỉ trong Sheet.
