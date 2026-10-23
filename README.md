# Speed Reader

A private, phone-first reading app for one public-domain Project Gutenberg book (plain `.txt`).

Read one word at a time (RSVP) or with a moving highlight (pacer). Reading data stays on your device. Downloaded books work offline as an installable PWA; linked books need internet unless you choose **Keep offline**.

## Reading a book

- Import a local `.txt` file or paste text, optionally adding a source URL. New imports store one cleaned copy instead of both the original and cleaned text. Reimporting identical cleaned text resumes the existing book, even when its file name changes or its downloaded copy has been removed.
- **Open from link** accepts a direct HTTPS UTF-8 plain-text URL. Linked imports keep only the URL, content fingerprint, word count and bookmark between sessions; full text is held in memory while reading. The source must permit cross-origin browser downloads. HTML/EPUB/PDF, authentication, redirects, downloads over 10 MB and requests exceeding 20 seconds are not supported. A blocked or unavailable source can still be imported manually as a file.
- Under each book's **Storage & source**, use **Keep offline** to download it, or **Remove downloaded text, keep my place** to free space. Removal first downloads and verifies that the source has the exact same cleaned text. A failed check keeps the existing copy and position. Source links can be added to existing local books.
- Bookmarks keep the word index and a short nearby passage. If a linked edition changes, the app searches for that exact passage. A missing or ambiguous passage requires confirmation before restarting; cancelling preserves the old bookmark. There are no stable page numbers because font and screen size vary.
- Use **Continue reading** to reopen the most recently read book. Each book keeps its own position.
- Both reading modes use the same **base WPM** clock. Punctuation, paragraph breaks, long words and numbers receive extra time, so average WPM is lower. For example, 600 base WPM gives a normal word 100 ms and a paragraph-ending word at least 300 ms.
- Pause to select a word in the sentence or pacer text. **Find text** searches words and phrases without changing your place until you choose a result. Search shows up to 30 matches.
- Reading pauses when the page is hidden, and returns paused. While playing, the app requests a screen wake lock where supported. If the device refuses it, reading still works and a message explains that the screen may lock.
- **Back up books & progress** downloads a local JSON file containing source links, bookmarks and any downloaded book text. Link-only books remain link-only in the backup and need internet when reopened. Restore accepts the original version 1 backups and new version 2 backups, adds missing books and restores matching positions while preserving other books. Existing database records remain readable without a destructive migration. Settings are separate, and session logs can be exported as CSV.

Source downloads happen only on explicit actions: opening a link-only book, keeping it offline, or verifying text removal. No book text or bookmark is uploaded. Downloads use no credentials or referrer, bypass the HTTP cache, and have no service-worker runtime caching. The source website still receives the download request. There is no proxy or backend to bypass a source's restrictions; Project Gutenberg or other sites may block browser downloads, so source links must be tested before relying on them.

The RSVP guide line has been removed; the optional coloured letter stays aligned. Pacer renders a bounded window around the current word rather than putting the entire book into the page.

Text sizes are independent in Settings: **RSVP word size** defaults to 32px (14–64px), **Sentence and paragraph size** to 20px (14–32px), and **Pacer text size** to 20px (14–32px). Existing font preferences are retained for pacer text. Context size applies to both the paused sentence and the expanded paragraph.

Chapter detection prefers explicit CHAPTER/BOOK/PART headings over short capitalised titles, avoiding publisher names and addresses when numbered headings are present. Gutenberg illustration brackets such as `Chapter I.]` are accepted without changing the underlying book text or saved word positions. The local Pride and Prejudice fixture is checked for exactly 61 chapters, I–LXI. Text before the first chapter is labelled “Front matter” in the reading status.

## Verification

`npm test` covers text processing, shared timing at 100/250/700 base WPM, actual elapsed timing with a synthetic 100,000-word book in jsdom, interruption handling, wake-lock fallback, backup compatibility, source validation/download failures, safe text removal, changed editions, and import/search/resume/offline-storage interactions. Downloads in tests use mocked sources. The elapsed-time check uses short words without punctuation so base WPM can be compared directly. These checks do not measure Safari layout or rendering or prove that a third-party source permits CORS.

Before release, check on an iPhone in Safari and as a Home Screen app: portrait/landscape, 375/390 px layouts, large text, keyboard focus, long RSVP words, pacer chunk transitions, interruptions, wake lock, offline reload, and downloading/restoring a backup. Browser and device checks remain necessary in addition to the automated suite.

## Stack

Vite + React + TypeScript. Static site on Vercel. No accounts, no analytics, no backend.

## Develop

```bash
npm install
npm run dev
npm test
npm run build
```
