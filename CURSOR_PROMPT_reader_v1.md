# Cursor prompt: Speed Reader v1 (one public-domain book, phone first)

Paste everything below the line into Cursor.

---

You are creating a new repository `guventech/speed-reader`. It is a small, private reading app for one person. He reads one public-domain book from Project Gutenberg (a plain .txt file that he opens from his phone or pastes in). The app shows the text one word at a time (RSVP) or as normal text with a moving highlight (pacer).

Goal: build the first version only. Keep it simple. Do not add features that are not listed here.

## Repo, branch and PR
- Create the repo `guventech/speed-reader` (private).
- Set git identity before any commit, or Vercel Hobby rejects the deploy:
  - `git config user.name "Guventech"`
  - `git config user.email "67098879+guventech@users.noreply.github.com"`
- Put a minimal README on `main`. Do all app work on a branch and open one PR. Do NOT merge. Guven merges with Squash and merge.
- Put the acceptance checklist below in the PR description, with each item ticked or explained.

## Stack
- Vite + TypeScript, static site. No backend, no server code, no API routes.
- No accounts, no analytics, no tracking, no external fonts or CDNs, no network calls after load.
- All book text and data stay on the device (IndexedDB for book text, localStorage for settings).
- Installable PWA: web manifest, icons (192 and 512), service worker so it works offline.
- Hosted on Vercel as a static site.
- Keep dependencies few. Use Vitest for unit tests.

## Layout
- Phone first (test at 375 x 667 and 390 x 844). Works on desktop too.
- Dark mode (follow the system, with a manual switch) and a font size setting.
- Big tap targets (at least 44 px). Nothing overlaps, no text runs out of its box.

## 1. Load a book
- Open a local .txt file, or paste text into a box.
- Store the book in IndexedDB with a title (from the Gutenberg "Title:" line if found, otherwise the file name).
- One book is enough, but do not break if a second one is added.

## 2. Text cleaning (pure functions, unit tested)
- Remove the Gutenberg header and footer: everything before the `*** START OF THE PROJECT GUTENBERG EBOOK ...` line and after the `*** END OF THE PROJECT GUTENBERG EBOOK ...` line, including the licence text. If the markers are missing, keep the whole text.
- Join words split by a hyphen at a line break (`impor-\ntant` becomes `important`). Keep real hyphens inside a line (`well-known`).
- Join wrapped lines inside a paragraph. A blank line means a new paragraph.
- Normalise curly quotes and apostrophes to one style. Turn `--` into a normal dash character used by the book.
- Remove `_underscores_` used for italics.
- Sentence splitting must not break on abbreviations: Mr., Mrs., Ms., Dr., St., Prof., e.g., i.e., etc., vs., No., single capital initials (J. R.), and numbers like 3.14.

## 3. Chapters and position
- Build a chapter list from headings (lines like `CHAPTER I`, `Chapter 1`, `BOOK II`, `PART ONE`, or short all-caps lines alone between blank lines). If none are found, split into sections of about 2,000 words.
- Show the chapter list as a simple menu. Tap a chapter to jump there.
- Save the reading position per book (word index), and resume there on next open.

## 4. RSVP mode
- One word at a time at a fixed spot in the middle of the screen.
- Optional coloured letter (setting, on by default): the optimal recognition point, slightly left of centre. Use this rule: length 1: letter 1, 2 to 5: letter 2, 6 to 9: letter 3, 10 to 13: letter 4, 14 and more: letter 5. Line the coloured letter up at the same horizontal spot for every word, so the eye does not move.
- Speed slider in words per minute: 100 to 700, step 10, default 250.
- Pacing (pure function, unit tested). Base time per word = 60000 / wpm ms. Then:
  - words longer than 8 letters: x1.3, longer than 12: x1.6
  - words with digits: x1.5
  - after a comma, semicolon or colon: x1.5
  - after a full stop, question mark or exclamation mark: x2
  - at the end of a paragraph: x3
- Tap the word area to pause or play. Space bar does the same on desktop.
- Back one sentence button (also left arrow): jumps to the start of the current sentence, or to the previous sentence if already at the start.
- While paused, show the full current sentence with the current word marked, and a button to show the whole paragraph.

## 5. Pacer mode
- Normal paragraph text, with a highlight moving word by word at the same speed and the same pacing as RSVP.
- Auto scroll to keep the highlighted line in view, in the upper part of the screen.
- Same pause, back one sentence and speed controls.
- Switching between RSVP and pacer keeps the same word position.

## 6. Word counter and session log
- Show words read in this session and progress in the book (percent and current chapter).
- Session log in localStorage: date and time, mode (rsvp or pacer), wpm, words read, minutes read (only time while playing). A session starts at first play and ends when the book is closed or after 5 minutes of pause.
- A simple log screen with a table and a button to export it as CSV.
- No quizzes in the app.

## Out of scope (do not build)
- Share target and opening links
- Accounts, sync, analytics
- Languages other than English
- .epub and .pdf files
- Quizzes, AI features, text to speech

## Acceptance checklist (run these and report the results in the PR)
- [ ] Unit tests pass for the cleaner: header and footer removal, missing markers, hyphen joining, real hyphens kept, line joining, quote normalising, abbreviations do not split sentences.
- [ ] Unit tests pass for the pacing: base time, long words, digits, comma, full stop, paragraph end.
- [ ] Unit test for the coloured letter position rule.
- [ ] `npm run build` passes with no TypeScript errors.
- [ ] Lighthouse: the PWA is installable (manifest and service worker found). Report the scores.
- [ ] Works offline after the first load.
- [ ] Tested with a real Gutenberg .txt (for example Pride and Prejudice, ebook 1342): header and licence are gone, chapters are found, position resumes after reload.
- [ ] Screenshots at 375 px and 390 px width, light and dark, RSVP paused and playing, pacer mode, chapter list, log screen. No text overlaps or runs out of its box. Attach them to the PR.
- [ ] No network requests after load (check the browser network tab).
- [ ] Git author on every commit is Guventech with the noreply email above.
