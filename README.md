# BookWeb — PWA đọc sách offline (local-only)

Bản web chạy **local 100% offline**, clone phần **core** từ
[duytung-sc1/NoCap_App_EXE](https://github.com/duytung-sc1/NoCap_App_EXE)
(app Android Kotlin + Jetpack Compose: đọc EPUB/PDF/TXT/MD/HTML/DOCX/CBZ, thư viện,
tiến độ, bookmark/highlight, sync multi-device…).

> ✅ Đã đọc được repo gốc (public, ~196 file, ~29k dòng Kotlin). BookWeb giữ lại:
> thư viện + đọc sách + lưu tiến độ + mục lục + tìm trong sách + Sáng/Tối/Sepia +
> song ngữ Việt–Anh. Bỏ phần cloud (tài khoản, sync, Pro) để chạy local ngay.

## Chạy local (2 phút)

Yêu cầu: **Node.js 18+** (đã test Node 22).

```bash
cd book_web
npm install
npm run dev
```

Mở trình duyệt: **http://localhost:5173** (hoặc URL Live Preview trong Arena).

Lần đầu mở, app tự nạp **4 sách mẫu** (2 Markdown VI/EN + 1 TXT Truyện Kiều + 1 EPUB demo)
nên bạn đọc thử được ngay, không cần import gì.

### Build bản production (PWA offline thật)

```bash
npm run build
npm run preview   # http://localhost:4173 — test service worker + cài app
```

Hoặc serve thư mục `dist/` bằng bất kỳ static server nào
(`npx serve dist`, nginx, GitHub Pages…).

## Cài như app thật (PWA)

- **Android/Chrome**: menu ⋮ → *Cài đặt ứng dụng / Thêm vào Màn hình chính*
- **iPhone/Safari**: nút Chia sẻ → *Thêm vào Màn hình chính*
- **Desktop**: biểu tượng Install trên thanh địa chỉ

Sau khi cài: icon riêng, mở toàn màn hình, **tắt mạng vẫn đọc**.

## Tính năng (bản core)

| Nhóm | Có gì |
|---|---|
| 📚 Thư viện | Import từ máy (kéo nhiều file) + từ link HTTPS, phát hiện trùng, tìm kiếm, lọc (Tất cả/Đang đọc/Hoàn thành/Chưa đọc), sắp xếp |
| 📖 Đọc sách | EPUB (mục lục NCX + ảnh), PDF (từng trang, zoom, phím ←/→), TXT/MD/HTML/DOCX (mục lục, cuộn liên tục), CBZ/ảnh (cuộn ảnh) |
| 📍 Tiến độ | Tự lưu vị trí + % (scroll/page), Đọc tiếp ở Trang chủ, đánh dấu hoàn thành |
| 🔍 Trong sách | Mục lục ☰, tìm kiếm 🔍 (nhảy tới kết quả, highlight) |
| 🎨 Giao diện | Sáng / Vàng giấy / Tối (app + reader riêng), cỡ chữ 14–24, serif/sans, căn trái/đều |
| 🌐 Song ngữ | 🇻🇳/🇬🇧 một chạm, áp dụng ngay (theo phong cách `UiTranslations` bản gốc) |
| 💾 Local-only | Sách + tiến độ trong **IndexedDB**, cài đặt trong **localStorage**. Không tài khoản, không server, không tracking |

Định dạng hỗ trợ: **EPUB · PDF · TXT · MD · HTML · DOCX · CBZ/ZIP ảnh · JPG/PNG/WebP/GIF**.

## Cấu trúc thư mục

```
book_web/
├── index.html              # entry + PWA meta
├── vite.config.js          # host 0.0.0.0, base './' (chạy mọi nơi)
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js               # service worker: app-shell offline-first
│   ├── icons/              # icon.svg + PNG 192/512 + maskable
│   └── samples/            # 4 sách mẫu tự nạp lần đầu
├── src/
│   ├── main.js             # shell + hash-router (#/home, #/library, #/book/…, #/read/…)
│   ├── styles.css          # tokens Material3 port từ NoCap Color.kt
│   ├── i18n.js             # từ điển VI/EN (~130 key)
│   ├── db.js               # IndexedDB: books + progress
│   ├── store.js            # settings localStorage + format helpers
│   ├── importer.js         # import blob/URL → detect → meta → lưu
│   ├── seed.js             # nạp sách mẫu lần đầu
│   ├── pwa.js              # đăng ký service worker
│   ├── parsers/            # detect, text (txt/md/html), epub, docx, cbz, pdf
│   ├── components.js       # toast, sheet, drawer, bookCard…
│   └── views-*.js          # home, library, details, reader, settings
└── README.md
```

## So với bản NoCap Android gốc

- **Giữ**: đọc đa định dạng, thư viện, tiến độ, mục lục, tìm trong sách,
  theme Sáng/Tối/Sepia, cỡ chữ/font/căn lề, song ngữ, import thiết bị + URL,
  phát hiện trùng, PWA thay cho APK.
- **Chưa có** (để bản sau nếu bạn cần): bookmark, highlight/note, tag/collection,
  favorite, review/spaced-repetition, thống kê, Memory/search, export kiến thức.
- **Không làm** (local-only): tài khoản, Google Sign-In, sync đa thiết bị,
  backup cloud, Pro/thanh toán, catalog cloud.

## Xóa dữ liệu

**Cài đặt → Xóa toàn bộ dữ liệu local** (xóa IndexedDB + cờ seed).
Lưu ý: xóa dữ liệu trình duyệt cũng mất sách — hãy giữ file gốc.

## Giấy phép & nguồn

- Code BookWeb trong repo này: dùng tự do cho mục đích cá nhân/học tập.
- Ý tưởng + phạm vi tính năng tham khảo repo gốc `duytung-sc1/NoCap_App_EXE`.
- Thư viện: `jszip` (EPUB/DOCX/CBZ), `pdfjs-dist` (PDF, Mozilla), `vite` (dev/build).
- Sách mẫu: nội dung tự viết + trích *Truyện Kiều* (Nguyễn Du, phạm vi công cộng).
