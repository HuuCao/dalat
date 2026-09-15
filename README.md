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
  - [Quỹ chung & chi phí](#10-quỹ-chung--chi-phí)
  - [Lịch biểu](#11-lịch-biểu)
- [Hỗ trợ trình duyệt](#hỗ-trợ-trình-duyệt)
- [Chạy local](#chạy-local)
- [Kiểm thử](#kiểm-thử)
- [Sửa lịch trình](#sửa-lịch-trình)
- [Kết nối Google Form / Sheet](#kết-nối-google-form--sheet)
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

- Tab `Tất cả`, `Ngày 1…N` và `💰 Quỹ` sinh tự động theo dữ liệu. Tab ngày ghi thêm thứ và ngày (`T6 16/10`); ngày đang diễn ra có chấm xanh dưới chữ. Thêm ngày thứ 4 thì tab thứ 4 tự xuất hiện.
- Thanh tab dính ở đầu màn hình khi cuộn, nền mờ kính.
- Chọn tab hiện đúng ngày đó, `Tất cả` hiện toàn bộ; mỗi lần đổi tab, ngày vừa mở mờ dần vào và các khung giờ bay vào lại. Đang cuộn sâu thì ngày được chọn tự đưa lên ngay dưới thanh tab.
- Điều khiển bằng bàn phím: `←` `→` chuyển tab, `Home` / `End` về tab đầu / cuối.
- Nhiều ngày không đủ chỗ thì hàng tab vuốt ngang được, tab vừa chọn tự cuộn vào tầm nhìn.
- Tab `Tất cả` ghi chế độ đang xem ở dòng dưới (`☰ Danh sách` / `📅 Lịch`, điện thoại chỉ hiện icon); đang ở `Tất cả` mà bấm lại thì đổi chế độ — xem [Lịch biểu](#11-lịch-biểu).

### 3. Lịch trình từng ngày

Mỗi ngày là một thẻ gồm:

- **Tiêu đề:** icon + `Ngày N`.
- **Dòng thông tin tự tính:** thứ/ngày, giờ bắt đầu → kết thúc, ghi chú — ví dụ `Th 7, 17/10 · 07:00 → 21:30 · Cà phê · Lẩu · Chợ Đà Lạt`.
- **Bộ đếm tự tính:** `6 điểm · 2 khung trống` (bỏ vế bằng 0; ngày chưa có gì hiện `Chưa có lịch`).
- **Đường timeline dọc** nối các khung giờ, mỗi khung có một chấm tròn.

Mỗi khung giờ gồm:

- **Giờ** (`07:00 – 09:00`) và **buổi tự suy ra**: `Sáng`, `Trưa`, `Chiều`, `Tối`, hoặc khung vắt qua hai buổi như `Trưa → chiều`.
  - Sáng trước 11:00 · Trưa 11:00–12:59 · Chiều 13:00–17:59 · Tối từ 18:00.
- **Giờ nổi bật:** giờ bắt đầu in đậm cỡ lớn, giờ kết thúc nhỏ bên cạnh.
- **Thẻ địa điểm:** icon trong ô màu, tên địa điểm in đậm cỡ lớn. Phần sau dấu ` — ` trong `title` hiện thành dòng mô tả nhỏ bên dưới tên (vd. `Đồi chè Cầu Đất — Săn mây, ăn sáng, cà phê`).
- **Link `📍 Maps`** nằm cùng hàng với tên, mở Google Maps tìm đúng địa điểm trong tab mới. Máy dưới 380px chỉ hiện 📍 để tên dài vẫn vừa một dòng.
- **Mọi thẻ cao bằng nhau:** tên một dòng, mô tả một dòng (giữ chỗ khi không có), dòng 💰; chữ quá dài hiện `…`.
- **Khung trống:** thẻ viền nét đứt (`🍚 Ăn trưa — Tự do`), không tính vào số điểm.

### 4. Trạng thái chuyến đi

Panel tối màu nổi đè lên mép dưới banner, nằm trên thanh tab — vì nó thuộc về cả chuyến đi chứ không riêng ngày nào. Nội dung tự đổi theo thời điểm:

| Thời điểm | Nhãn | Nội dung |
|---|---|---|
| **Trước chuyến đi** | `Đếm ngược khởi hành` | Ô đếm ngược `ngày · giờ · phút · giây` (bỏ đơn vị 0 ở đầu, luôn giữ ít nhất 2 ô), đồng hồ cát lật cát chảy, ghi chú `Đà Lạt đang chờ · bắt đầu 07:00 · Th 6, 16/10` |
| **Đang ở một khung giờ** | `Đang diễn ra` | Tên điểm hiện tại + nút `📍 Maps`, ghi chú `Còn 15 phút · đến 12:15`, dòng `Tiếp theo 12:45 · 🐈 Trại Mèo Mướp`, tiến độ `2/16 điểm` ở góc phải, chấm xanh nhấp nháy |
| **Giữa hai khung giờ** | `Đang di chuyển` | Tên điểm kế tiếp + nút `📍 Maps`, ghi chú `Bắt đầu 09:15 · còn 15 phút`, dòng Tiếp theo, tiến độ |
| **Sau chuyến đi** | `Hành trình đã khép lại` | `Hẹn gặp lại Đà Lạt ✦`, ghi chú `Đã đi qua 16 điểm trong 3 ngày` |

- Điểm tiếp theo ở ngày khác thì ghi thêm thứ: `Tiếp theo T7 07:00 · 🥞 Ăn sáng — Bánh căn`.
- Hàng `💰 Quỹ còn` dính liền dưới panel thành một khối.
- Đếm ngược cập nhật mỗi giây; các trạng thái còn lại cập nhật mỗi 15 giây, và ngay đúng giây một khung giờ bắt đầu hoặc kết thúc (không chờ tới lượt 15 giây kế tiếp).
- Tiến độ chỉ đếm địa điểm thật, không đếm khung trống.
- Có hiệu ứng vệt sáng quét chậm qua panel.

### 5. Theo dõi thời gian thực

Trong thời gian chuyến đi, trang tự phản ánh "bây giờ":

- **Chỉ ô giờ đổi màu theo thời gian**, thẻ địa điểm giữ nguyên: khung đang diễn ra có ô giờ xanh chanh nhấp nháy và chấm có vòng sáng lan ra (tắt khi bật "Giảm chuyển động"); khung đã qua có ô giờ và chấm xám. Trình đọc màn hình vẫn đọc "Đang diễn ra" / "Đã qua".
- **Tự mở đúng ngày:** mở trang trong lúc đang đi, tab tự chuyển sang ngày hiện tại và cuộn tới khung đang diễn ra.
- **Tự chuyển khi đến giờ:** khung mới bắt đầu thì trang tự đưa thẻ đó vào giữa màn hình (mở tab ngày nếu đang ở tab khác). Nếu 30 giây gần nhất bạn vừa chạm, cuộn hay gõ phím thì trang không giành cuộn mà hiện nút `📍 Đang diễn ra: …` ở góc dưới — bấm để tới, tự ẩn khi thẻ đã trên màn hình. Mở lại trang từ nền cũng bắt kịp ngay. Bật "Giảm chuyển động" thì nhảy thẳng, không cuộn mượt.
- **Lịch biểu cũng theo thời gian thực:** thẻ đang diễn ra nền trắng viền xanh chanh phát sáng kèm chấm nhấp nháy, thẻ đã qua xám, vạch giờ hiện tại ở cột hôm nay kèm nhãn giờ ở cột giờ. Đang xem lịch thì trang không tự chuyển sang tab ngày khi khung mới bắt đầu.
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
- **Dễ bấm:** tab cao tối thiểu 52px; link `📍 Maps` và dòng 💰 có vùng chạm 44px dù chữ nhỏ.
- **Nút nổi `+ Nhập chi`** ở góc dưới phải trong tầm ngón cái, tránh thanh home của iPhone; chỉ hiện trên điện thoại.
- **Không "dính" hover** sau khi chạm trên iPhone — hiệu ứng hover chỉ bật trên thiết bị có chuột.
- **Không cuộn ngang** ở mọi độ rộng (đã kiểm tra 360, 390, 430, 1440px).
- Panel đếm ngược tự xuống dòng các ô số trên màn hình hẹp.
- Thanh địa chỉ trình duyệt đổi màu xanh theo trang (`theme-color`); không chặn zoom.
- **Icon riêng:** ghim bản đồ xanh chanh có cây thông trên nền xanh rêu — hiện trên tab trình duyệt (`favicon.svg`, dự phòng PNG 32px) và khi ghim ra màn hình chính (`apple-touch-icon.png` 180px cho iPhone, PNG 192/512px trong `site.webmanifest` cho Android).
- **Mở như app riêng:** bấm icon trên màn hình chính, trang mở toàn màn hình không có thanh địa chỉ, tên dưới icon là `Đà Lạt`. Link Form / Maps vẫn mở bình thường; không kéo xuống để tải lại được — sổ quỹ vẫn tự cập nhật và có nút `↻`.

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

### 10. Quỹ chung & chi phí

Nhóm đóng quỹ chung; mọi khoản chi được ghi qua Google Form, trang đọc Google Sheet và tự tính.

- **Từng khung giờ:** dòng `💰` so dự kiến với thực chi — `💰 260k / 200k ▲ 60k` (vượt, cam đỏ), `▼ 20k` / `✓` (xanh), `💰 Dự kiến 200k` (chưa chi; mở ra thấy `Mỗi người ~50k`), `🆓 Miễn phí`. Bấm để xem từng khoản: viền và nhãn màu theo người trả (xanh `Quỹ trả`, cam `Hữu trả hộ`, đỏ dòng cần sửa), số tiền, ghi chú, chia cho ai, ai nhập, lúc nào — kèm nút `➕ Nhập chi ở đây` mở Form **đã chọn sẵn địa điểm**.
- **Từng ngày:** `💰 1tr660 / 3tr120 · phát sinh 120k` và thanh tiến độ; cuối ngày có khối `⚡ Phát sinh ngoài plan` với nút `➕ Nhập phát sinh`.
- **Dính liền panel trạng thái:** `💰 Quỹ còn 8tr080`; nút `+ Nhập chi` trên máy tính, nút nổi trên điện thoại — chọn sẵn khung đang diễn ra, giữa hai khung thì chọn khung vừa kết thúc.
- **Tab `💰 Quỹ`:** các mục ngăn nhau bằng một dải xám tràn hết bề ngang thẻ; cảnh báo và khoản không khớp địa điểm (nếu có); thẻ tổng quan — `Quỹ còn` chữ lớn, thanh tiến độ `Đã chi … / dự kiến … · 4%`, ba thẻ đều nhau `Đã góp` · `Đã chi` · `Dư dự kiến` (hoặc `Thiếu dự kiến` màu cam) — nhãn nhỏ trên, số đậm dưới; 🧮 quyết toán dạng bảng gọn — cột `Góp · Trả hộ · Chịu · Hoàn/Nộp`, mỗi người một dòng: chữ cái đầu trong vòng tròn và tên, số không dấu nhưng tô màu theo công thức (góp và trả hộ xanh, chịu cam, 0 mờ); cột `Hoàn/Nộp` chỉ ghi số tiền — màu xanh là được hoàn, màu cam là phải nộp thêm, `0` màu mờ là đủ; 📅 theo ngày dạng biểu đồ thanh ngang chung một thang đo — nền nhạt là dự kiến, phần xanh là đã chi, đoạn cam là phát sinh (tách bằng khe trắng 2px); mỗi thanh ghi `đã chi / dự kiến`, rê chuột, chạm hoặc Tab tới thanh hiện thêm còn/vượt; dòng Tổng bằng chữ; 🧾 chi phí chung dạng thẻ (vé xe, khách sạn, xe máy, phát sinh chung); sổ sách với nút chuyển `Sổ chi` / `Góp quỹ` — sổ chi nhóm theo Chung → Ngày 1…N → Không khớp, mỗi nhóm có tổng, mỗi khoản ghi tên địa điểm gọn và số tiền; góp quỹ mỗi khoản một hàng kèm dòng tổng; nút mở Form và Sheet. Tab `Tất cả` không gồm tab này.
- **Quyết toán:** `Kết quả = Đã góp + Trả hộ − Phần chịu`, ghi bằng chữ: `Hoàn 2tr695`, `Nộp 845k`, `Đủ`; tổng các kết quả luôn bằng số quỹ còn. Trong chuyến ghi `tạm tính`; khi chuyến đi kết thúc hiện `Chốt quỹ` ghi đủ từng đồng — `→ Quỹ hoàn Hữu 2.695.000đ`, `→ Khanh nộp thêm vào quỹ 845.000đ` — mỗi người chỉ một giao dịch với quỹ.
- **Cách viết tiền:** dưới 1 triệu `640k`, `33,3k`; từ 1 triệu `11tr760`, `12tr`; từng khoản trong sổ viết gọn khi tròn nghìn (`2tr200`, `320k`), lẻ đồng thì ghi đủ (`1.234.567đ`); chốt quỹ luôn ghi đủ đồng.
- **Chia lẻ đúng từng đồng:** 100.000đ chia 3 = 33.334 + 33.333 + 33.333.
- **Nhập sai không mất tiền:** sai tên địa điểm → vẫn tính vào tổng, hiện ở mục `Không khớp địa điểm`; sai tên người → vẫn tính vào tổng nhưng chưa quyết toán (`⚠️ Có N dòng cần sửa — số liệu chưa chốt`); sai số tiền → bỏ dòng. Mỗi lỗi báo đúng dòng trong Sheet, vd. `Dòng 9 · Ai trả "Tram" không phải thành viên`.
- **Tự cập nhật:** tải lại mỗi 5 phút khi trang đang mở, ngay khi mở lại trang, hoặc bấm `↻` — mục nào đang mở vẫn giữ nguyên. Google cần khoảng 5 phút sau khi gửi Form mới công bố số mới.
- **Mất sóng:** dùng bản lưu gần nhất trên máy — `Dữ liệu lúc 14:05 · chưa tải được bản mới`. Lỗi phần quỹ không bao giờ làm hỏng lịch trình.
- **Chưa kết nối Sheet:** trang vẫn hiện toàn bộ dự kiến, tab Quỹ ghi `Chưa kết nối Google Sheet`.

### 11. Lịch biểu

Cả chuyến đi trên một lưới, như lịch tuần: mỗi cột một ngày, trục dọc là giờ.

- **Bật:** mở tab `Tất cả` rồi bấm lại vào nó — dòng dưới chữ `Tất cả` đổi từ `☰ Danh sách` sang `📅 Lịch`; bấm lần nữa để về danh sách. Trang nhớ lựa chọn cho lần mở sau; trình duyệt chặn lưu dữ liệu thì mở lại vẫn là `Danh sách`.
- **Khung giờ tự tính:** từ giờ tròn trước khung sớm nhất tới giờ tròn sau khung trễ nhất của cả chuyến (`07:00 – 22:00`), vạch mảnh mỗi giờ.
- **Mỗi khung là một thẻ** bo tròn nền xanh nhạt, đặt đúng giờ, cao đúng thời lượng — khoảng trống giữa các khung thấy ngay. Thẻ ghi icon + tên đậm, ngay dưới là khung giờ `07:00–09:00`; tên dài xuống dòng khi thẻ đủ cao, hết chỗ thì `…`. Khung dưới 40 phút chỉ ghi tên. Khung trống có nền sọc chéo nhạt.
- **Hai khung chồng giờ** trong một ngày thì chia đôi bề ngang, không đè nhau.
- **Hàng ngày** (thứ nhỏ `T6`, số ngày lớn `16`) dính ngay dưới thanh tab khi cuộn, nền mờ kính; hôm nay số ngày nằm trong vòng tròn xanh chanh và cả cột được tô nhẹ. Bấm vào ngày → mở tab ngày đó.
- **Bấm một khối** → mở tab ngày, thẻ của khung đó cuộn vào giữa màn hình và nháy viền hai lần (bật "Giảm chuyển động" thì viền hiện tĩnh).
- **Trong chuyến:** bật lịch thì vạch giờ hiện tại tự vào giữa màn hình.
- Điện thoại 1 phút = 1px (cả ngày ~900px), máy tính 1,2px. Nhiều ngày thì cột hẹp lại chứ không cuộn ngang.

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
| `tests/time.test.js` | Định dạng giờ/ngày, thứ trong tuần, suy ra buổi cho mọi khung giờ, điền `{days}`/`{nights}`, thứ ngắn `T6 16/10`, thời lượng `1 giờ 20 phút`, ngày và phút theo múi giờ chuyến đi |
| `tests/calendar.test.js` | Khung giờ lịch làm tròn tới giờ, vị trí và chiều cao khối, chia làn khi chồng giờ, vạch giờ hiện tại (ngoài ngày / ngoài giờ) |
| `tests/tabs.test.js` | Tab nào hiện panel nào ở chế độ Danh sách / Lịch, đọc lựa chọn đã nhớ khi bộ nhớ trình duyệt thiếu hoặc lỗi |
| `tests/trip.test.js` | Số ngày/đêm/điểm/khung trống, `srcset`, link Maps, sắp xếp, thông báo lỗi dữ liệu, budget, cấu hình quỹ, nhãn Form |
| `tests/status.test.js` | Trạng thái trước / trong / giữa / sau chuyến đi, biên đầu–cuối khung giờ, ô đếm ngược, thời gian còn lại, điểm tiếp theo (cả sang ngày khác), link Maps |
| `tests/motion.test.js` | Parallax dự phòng khớp CSS, giới hạn giá trị, ảnh hero không bao giờ hở mép |
| `tests/clock.test.js` | Tham số `?now=` |
| `tests/csv.test.js` | Đọc CSV: nháy kép, dấu phẩy và xuống dòng trong ô, CRLF, BOM, trang HTML thay vì CSV |
| `tests/text.test.js` | So tên không phân biệt hoa thường, khoảng trắng thừa, dạng Unicode |
| `tests/money.test.js` | `1tr660`, `12tr`, `33,3k`, `260.000đ`, ▲ ▼ ✓, khoản tròn nghìn viết gọn / lẻ đồng ghi đủ |
| `tests/fund.test.js` | Tìm cột theo tên, đọc số tiền, chia lẻ, tổng khung/ngày/chung/chuyến, quyết toán, chữ Hoàn / Nộp / Đủ, dòng lỗi, link Form điền sẵn |

Phần giao diện được kiểm tra trên Chrome headless (iPhone và máy tính): chọn đúng ảnh, không cuộn ngang, trạng thái thời gian thực, cả hai lớp animation, giảm chuyển động, lịch biểu (vị trí khối, trạng thái theo giờ, bấm khối mở thẻ, nhớ chế độ xem), dữ liệu lỗi, thêm ngày mới.

## Sửa lịch trình

Chỉ sửa `data/trip.json`. Thêm ngày = thêm một object vào `days`; thêm điểm = thêm một object vào `items`. Tab, số điểm, khung trống, thứ/ngày, buổi và đếm ngược tự tính lại.

```json
{
  "date": "2026-10-19",
  "icon": "🧳",
  "note": "Ngày thêm",
  "items": [
    { "start": "09:00", "end": "10:30", "icon": "☕", "title": "Cà phê sáng", "map": "cà phê view đồi Đà Lạt" },
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
| `items[].icon` | không | |
| `items[].map` | không | Từ khóa tìm trên Google Maps; có thì hiện link `📍 Maps` |
| `items[].empty` | không | `true` = khung trống, không tính là điểm |
| `items[].budget` | không | Dự kiến, VND, số nguyên ≥ 0. `0` = `Miễn phí` |
| `fund.members[]` | có (khi có `fund`) | Tên thành viên, không trùng, không được là `Quỹ` |
| `fund.shared[]` | không | `{ "title", "icon", "budget", "note" }` — chi phí chung không thuộc ngày nào |
| `fund.csv.expenses`, `fund.csv.contributions` | không | Link CSV publish của tab `ChiTieu` và `GopQuy`. Thiếu thì trang chỉ hiện dự kiến |
| `fund.form.url`, `fund.form.placeField` | không | Link Form (`…/viewform`) và `entry.…` của câu hỏi Địa điểm |
| `fund.sheet` | không | Link mở Google Sheet |

Khi có `fund`, các khung trong cùng một ngày không được trùng `title` và không được đặt tên `Phát sinh` — Form phân biệt địa điểm bằng tên.

## Kết nối Google Form / Sheet

Làm một lần, khoảng 15 phút. **Lưu ý:** link CSV đã publish là công khai — ai có link (kể cả người xem source trang) đọc được tên và số tiền, nhưng không sửa được.

1. **Lấy danh sách địa điểm:** chạy `npm run form-options`, copy toàn bộ kết quả.
2. **Tạo Google Form** "Chi tiêu Đà Lạt". Tên câu hỏi phải giữ **đúng chữ** như bảng:

   | Câu hỏi | Loại | Lựa chọn / xác thực | Bắt buộc |
   |---|---|---|---|
   | Người nhập | Menu thả xuống | Hữu, MiMi, Khanh, Trâm | có |
   | Địa điểm | Menu thả xuống | Paste kết quả bước 1 vào lựa chọn đầu tiên — Form tự tách mỗi dòng | có |
   | Số tiền | Câu trả lời ngắn | Xác thực phản hồi: Biểu thức chính quy → Khớp → `^[1-9][0-9]*$`; văn bản lỗi: `Chỉ nhập số, vd 260000` | có |
   | Ai trả | Trắc nghiệm | Quỹ, Hữu, MiMi, Khanh, Trâm | có |
   | Chia cho | Hộp kiểm | Hữu, MiMi, Khanh, Trâm — mô tả: "Bỏ trống = chia đều cả nhóm" | không |
   | Ghi chú | Câu trả lời ngắn | | không |

   Trong Cài đặt → Câu trả lời: tắt thu thập email và giới hạn 1 câu trả lời, để nhập không cần đăng nhập.
3. **Liên kết Sheet:** tab Câu trả lời → Liên kết với Trang tính → tạo bảng tính mới. Đổi tên tab câu trả lời thành `ChiTieu`.
4. **Tạo tab `GopQuy`** trong cùng bảng tính, dòng 1 là `Ngày`, `Người góp`, `Số tiền`, `Ghi chú`. Mỗi lần góp quỹ nhập một dòng.
5. **Đặt khu vực:** Tệp → Cài đặt → Ngôn ngữ và khu vực = **Việt Nam**.
6. **Publish CSV:** Tệp → Chia sẻ → Công bố lên web → chọn tab `ChiTieu`, định dạng **Giá trị được phân tách bằng dấu phẩy (.csv)** → Công bố → copy link. Làm lại cho `GopQuy`. Giữ bật "Tự động công bố lại khi có thay đổi".
7. **Lấy `placeField`:** trong Form, menu ⋮ → Nhận đường liên kết điền sẵn → chọn một Địa điểm bất kỳ → Nhận đường liên kết → Sao chép. Link có đoạn `entry.123456789=…`; lấy phần `entry.123456789`. Phần trước dấu `?` (kết thúc bằng `/viewform`) là link Form.
8. **Chia sẻ bảng tính** quyền chỉnh sửa cho cả nhóm, để ai cũng sửa được dòng nhập sai.
9. **Điền vào `data/trip.json`:**

   ```json
   "fund": {
     "members": ["Hữu", "MiMi", "Khanh", "Trâm"],
     "csv": {
       "expenses": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
       "contributions": "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
     },
     "form": { "url": "https://docs.google.com/forms/d/e/…/viewform", "placeField": "entry.123456789" },
     "sheet": "https://docs.google.com/spreadsheets/d/…/edit",
     "shared": [ … giữ nguyên … ]
   }
   ```

10. `npm test`, mở trang local → tab `💰 Quỹ` hiện `Cập nhật HH:MM`. Push lên `main`.

Đổi tên hoặc thêm khung giờ sau này: chạy lại `npm run form-options` và cập nhật lựa chọn của câu hỏi Địa điểm. Dòng cũ không khớp tên mới vẫn được tính và hiện ở mục `Không khớp địa điểm` — sửa tên trong Sheet là hết.

## Cấu trúc thư mục

```
index.html              khung trang + script chọn lớp animation
data/trip.json          toàn bộ nội dung
site.webmanifest        tên, màu, icon khi ghim ra màn hình chính (Android)
assets/img/             ảnh nhiều kích thước
assets/icons/           favicon (SVG + PNG 32px), apple-touch-icon 180px, icon 192/512px
css/
  tokens.css            màu, bo góc, bóng, easing
  base.css              nền tảng, footer, thanh tiến trình, thông báo lỗi
  hero.css · tabs.css · timeline.css · calendar.css · countdown.css · fund.css
  motion/
    keyframes.css       toàn bộ keyframes
    load.css            animation lúc mở trang
    scroll-timeline.css hiệu ứng theo cuộn (lớp A)
    reveal.css          nội dung ngày hiện ra khi cuộn tới / đổi tab
js/
  main.js               tải dữ liệu → dựng trang → khởi động
  lib/                  giờ, đồng hồ, animation, tạo DOM, đọc CSV, định dạng tiền, so tên
  model/                dữ liệu → model, trạng thái chuyến đi, lưới lịch biểu, sổ quỹ (thuần, có test)
  views/                hero, tabs, ngày, lịch biểu, panel trạng thái, quỹ, footer, lỗi
  controllers/          tabs, đồng hồ thời gian thực, bấm lịch biểu, reveal, parallax dự phòng, tải sổ quỹ
scripts/form-options.js in danh sách địa điểm cho Google Form
tests/                  node --test
docs/                   spec và plan
```

Luồng dữ liệu một chiều: `trip.json` → `model` (kiểm tra, tính số liệu) → `views` (dựng DOM) → `controllers` (tương tác, thời gian thực, animation).

## Deploy

GitHub Pages phục vụ nhánh `main`, thư mục gốc. Push lên `main` là trang tự cập nhật sau 1–2 phút; nếu không thấy thay đổi, tải lại bằng `Cmd + Shift + R`.

## Tài liệu

- [Thiết kế](docs/specs/2026-09-11-dynamic-render-design.md) — kiến trúc, schema, animation chi tiết và 16 lỗi đã gặp cần tránh.
- [Kế hoạch triển khai](docs/plans/2026-09-11-dynamic-render.md).
- [Thiết kế quỹ chung & chi phí](docs/specs/2026-09-14-fund-ledger-design.md) — dữ liệu, cách tính, giao diện, xử lý lỗi.
- [Kế hoạch triển khai quỹ](docs/plans/2026-09-14-fund-ledger.md).
- [Thiết kế tinh gọn giao diện](docs/specs/2026-09-14-ui-polish-design.md) · [Kế hoạch](docs/plans/2026-09-14-ui-polish.md).
- [Thiết kế lịch biểu](docs/specs/2026-09-15-calendar-view-design.md) · [Kế hoạch](docs/plans/2026-09-15-calendar-view.md).

## Nguồn ảnh

Ảnh theo [Unsplash License](https://unsplash.com/license):

- Hero — Pete Walls: https://unsplash.com/photos/Fl3bY0hWXv4
- Thumbnail A — Pete Walls: https://unsplash.com/photos/RTSpODtSxTw
- Thumbnail B — Điệp Zader: https://unsplash.com/photos/i29Z07meKds
