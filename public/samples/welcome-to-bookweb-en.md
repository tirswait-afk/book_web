# Welcome to BookWeb

**BookWeb** is a local-first web clone (100% offline PWA) inspired by **NoCap_App_EXE** — an Android ebook reader built with Kotlin + Jetpack Compose.

This web version keeps the **core**: library, reading, progress tracking — and drops the cloud parts (accounts, sync, payments) so it works instantly with no network and no server.

## 1. What can BookWeb read?

- **EPUB** — standard ebooks with table of contents and images
- **PDF** — textbooks and scanned documents (page by page)
- **TXT / Markdown** — notes, stories, lightweight docs
- **HTML** — saved web articles
- **DOCX** — basic Word documents (paragraphs, headings)
- **CBZ / images** — comics (ZIP of JPG/PNG/WebP)

Every file you import is stored in the browser's **IndexedDB** — airplane mode still reads fine.

## 2. Get started in 30 seconds

1. Open the **Library** tab, tap **＋ Add**.
2. Pick a file from your device (or paste an HTTPS link).
3. Tap a cover to open details, then tap **Read book**.
4. Scroll and read — your position auto-saves. Next time: **Home → Continue reading**.

## 3. Reading tips

- **Table of contents**: in the reader, tap ☰ to jump chapters (EPUB/Markdown/HTML).
- **Search in book**: tap 🔍, type a keyword, tap a result to jump there.
- **Reading themes**: Light / Sepia / Dark. Sepia is kindest for long sessions.
- **Font size & face**: serif suits novels, sans-serif suits technical docs.
- **Mark finished**: open book details → **Mark as finished** when done.

## 4. Compared to the original NoCap app

| Feature | NoCap Android | BookWeb local |
|---|---|---|
| Read EPUB/PDF/TXT/MD/HTML/DOCX/CBZ | Yes | Yes |
| Library, progress, search | Yes | Yes |
| TOC, in-book search | Yes | Yes |
| Light/Dark/Sepia, font size, typeface | Yes | Yes |
| Vietnamese–English bilingual UI | Yes | Yes |
| Bookmarks, highlights, notes, tags | Yes | Not yet (next) |
| Review, stats, Memory | Yes | Not yet (next) |
| Accounts, sync, cloud backup, Pro | Yes | No (local-only) |

## 5. Where is your data?

- Books + progress: **IndexedDB** (see DevTools → Application).
- Settings (language, theme, font size): **localStorage**.
- Clearing browser data deletes books. Keep your original files.
- To wipe clean: **Settings → Erase all local data**.

## 6. Install it like a real app (PWA)

- **Android/Chrome**: menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone/Safari**: Share button → *Add to Home Screen*.
- **Desktop**: install icon in the address bar.

Once installed, BookWeb opens fullscreen with its own icon and works fully offline.

---

*Happy reading! Try the Vietnamese sample, or import your own books into the Library.*
