# Chào mừng đến với BookWeb

**BookWeb** là bản web chạy local (PWA offline 100%) được clone từ ý tưởng của **NoCap_App_EXE** — app đọc sách Android viết bằng Kotlin + Jetpack Compose.

Bản web này giữ lại phần **core**: thư viện, đọc sách, lưu tiến độ — bỏ phần cloud (đồng bộ, tài khoản, thanh toán) để bạn dùng ngay không cần mạng, không cần server.

## 1. BookWeb đọc được gì?

- **EPUB** — sách điện tử chuẩn, có mục lục, ảnh minh họa
- **PDF** — giáo trình, tài liệu scan (đọc từng trang)
- **TXT / Markdown** — ghi chú, truyện, tài liệu nhẹ
- **HTML** — bài viết web đã lưu
- **DOCX** — tài liệu Word cơ bản (đoạn văn, tiêu đề)
- **CBZ / ảnh** — truyện tranh (ZIP chứa ảnh JPG/PNG/WebP)

Mọi file bạn import đều được lưu vào **IndexedDB** trên trình duyệt — tắt mạng vẫn đọc bình thường.

## 2. Bắt đầu trong 30 giây

1. Mở tab **Thư viện**, bấm nút **＋ Thêm**.
2. Chọn file trên máy (hoặc dán link HTTPS).
3. Bấm vào bìa sách để mở trang chi tiết, rồi bấm **Đọc sách**.
4. Kéo đọc, app tự lưu vị trí. Lần sau mở tab **Trang chủ** → **Đọc tiếp**.

## 3. Mẹo đọc sách

- **Mục lục**: trong màn đọc, bấm nút ☰ để nhảy chương (EPUB/Markdown/HTML).
- **Tìm trong sách**: bấm 🔍, gõ từ khóa, bấm kết quả để nhảy tới đoạn đó.
- **Chế độ đọc**: Sáng / Vàng giấy / Tối. Vàng giấy dịu mắt nhất khi đọc lâu.
- **Cỡ chữ & font**: chữ serif hợp tiểu thuyết, sans-serif hợp tài liệu kỹ thuật.
- **Đánh dấu xong**: khi đọc xong, mở chi tiết sách → **Đánh dấu hoàn thành**.

## 4. So với bản NoCap gốc

| Tính năng | NoCap Android | BookWeb local |
|---|---|---|
| Đọc EPUB/PDF/TXT/MD/HTML/DOCX/CBZ | Có | Có |
| Thư viện, tiến độ, tìm kiếm | Có | Có |
| Mục lục, tìm trong sách | Có | Có |
| Sáng/Tối/Sepia, cỡ chữ, font | Có | Có |
| Song ngữ Việt–Anh | Có | Có |
| Bookmark, highlight, note, tag | Có | Chưa (bản sau) |
| Review, thống kê, Memory | Có | Chưa (bản sau) |
| Tài khoản, sync, backup cloud, Pro | Có | Không (local-only) |

## 5. Dữ liệu của bạn ở đâu?

- Sách + tiến độ: **IndexedDB** (xem trong DevTools → Application).
- Cài đặt (ngôn ngữ, theme, cỡ chữ): **localStorage**.
- Xóa dữ liệu trình duyệt = mất sách. Hãy giữ file gốc trên máy.
- Muốn dọn sạch: **Cài đặt → Xóa toàn bộ dữ liệu local**.

## 6. Cài như app thật (PWA)

- **Android/Chrome**: menu ⋮ → *Thêm vào Màn hình chính* / *Cài đặt ứng dụng*.
- **iPhone/Safari**: nút Chia sẻ → *Thêm vào Màn hình chính*.
- **Desktop**: biểu tượng cài đặt trên thanh địa chỉ.

Sau khi cài, BookWeb mở toàn màn hình, có icon riêng, chạy offline hoàn toàn.

---

*Chúc bạn đọc vui! Mở file mẫu tiếng Anh để xem bản English, hoặc import sách của bạn vào Thư viện.*
