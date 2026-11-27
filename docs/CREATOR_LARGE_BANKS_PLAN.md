# PulsePlay Creator Studio: large question banks (Release C4 plan)

Status: **planning approved; no code until the signed-in production acceptance test of C3 is complete.** This is a separate release from C3 (PR #13).

## 1. Audit of the current editor (main, after C3)
**How it works:**
- The Builder (`web/src/builder/Builder.tsx`) renders every question as a fully open card. Each card has the prompt, up to 6 answers with points or the correct answer, type, timing, category/area, archive, move, duplicate and delete.
- Every edit clones the whole game, then re-runs validation, the plain-language checker, the bank overview and the 3 example games over all questions.
- Autosave sends the whole game every 1.2 s after typing stops.
- Publishing creates an immutable, server-checked version (unchanged by this release).

**Measured** in the isolated test environment, headless Chromium on a desktop CPU:

| Bank | Controls on the page | Page length | Typing delay (median / slowest 10%) |
|---|---:|---:|---:|
| 60 questions, desktop | 1,376 | 46 screens | 20 / 31 ms |
| 200 questions, desktop | 4,316 | 136 screens | 34 / 74 ms |
| 200 questions, 390 px phone viewport | 4,316 | 166 screens | 39 / 66 ms |

**What this means:**
- Phones and older laptops are typically 3–5× slower than this machine. At 200 questions, typing would lag noticeably (roughly 100–300 ms).
- The main problem is finding things: 136–166 screens of scrolling, with no search and no filters.

**What already fits and is reused:**
- **Schema and server.** Bank fields (`category`, `dimension`, `active`, `bank`) already exist. The draft size limit is 512 KB; 200 questions is about 120 KB. No database, Edge Function or schema change is needed for this release.
- **Validation.** The schema validator plus the plain-language checker (`humanize`) can check CSV rows with the same messages creators already see.
- **Adding questions.** The AI-draft "add to my game" path is how imported questions will be added.
- **Versions.** Published versions are available via `api.published(id)`, so the draft can be compared with the live version.
- **Existing UI.** The phone preview, checker, archive/restore and group logic (`bankModel.ts`) stay as they are.

**Gaps:**
- no search or filters
- no compact view
- no bulk import
- no duplicate warnings
- no per-question "changed since publish" marker
- 200 full cards on a phone

## 2. Proposed release, in priority order
### C4a: compact list, search and filters (first)
- **Collapsed by default.** Each question is one row: number, prompt (one line), category or area, status (in use / archived), top score, and a ⚠ badge if the checker found a problem. Tapping a row opens the existing editing card, one at a time, so the editing controls stay the same. "Expand all" stays available.
- **Search** across the question and all its answers. It ignores case and accents, works in Arabic, and highlights matches in the row.
- **Filters:**
  - category/area
  - status (in use, archived, has a problem, changed since publish)
  - question type
- Filters can be combined, and a counter shows "12 of 200".
- **Speed:**
  - edit only the changed question instead of cloning the whole game
  - delay validation slightly while typing
  - re-render only the open card
  - target: under 16 ms per keystroke at 200 questions on the test machine
- **Phone:**
  - the search bar stays visible at the top
  - an open question fills the screen, with Previous / Next buttons
  - the bank panel and checker sit behind a "Summary" tab

### C4b: CSV import with validation and preview (second)
- **Download a template.** Columns: id (optional), question, category, answer 1–6, points 1–6 (or "correct" for quizzes), explanation, status. The template is a CSV that opens in Excel or Google Sheets.
- **Upload and preview.** Nothing is saved until the creator confirms.
  - Handles UTF-8 with or without a BOM, comma or semicolon (Swiss and German Excel default), and quoted line breaks.
  - Every row is checked by the same validator. Rows with errors show plain-language messages and are skipped unless fixed.
  - Arabic rows display right to left.
  - Duplicates (C4c) are flagged in the preview.
- **Modes:** "Add as new questions", or "Update questions with the same id". Updated questions keep their history, because published versions never change.
- **Limits:** 200 rows per import, and the existing 512 KB game limit. The import goes into the draft only; publishing is unchanged.
- **Export:** the current bank can be exported to CSV for offline editing or translation.

### C4c: duplicate detection and draft vs published (third)
- **Duplicates:**
  - identical questions, ignoring case, punctuation and accents
  - near-identical questions (high word overlap)
  - identical answers within one question
- Duplicates are warnings in the checker and a filter, not errors.
- **Changed since publish.** Each row shows new / edited / archived compared with the latest published version, with a summary such as "14 changes since version 3 · Publish version 4". The editor header keeps the existing "Draft" / "Live version vN" chips.

## 3. Tests
- **Unit:** search normalisation, including Arabic; filter combinations; CSV parsing (BOM, `;`, quotes, line breaks, 200 rows, malformed rows); duplicate rules; the draft-vs-published comparison.
- **Browser (new `creator_c4`):**
  - a 200-question bank
  - search, filter, expand, edit and collapse
  - CSV template round trip, error preview, add and update modes
  - duplicate warnings and change markers
  - publish a new version
  - keystroke timing budget
  - 375 px phone without sideways scrolling
  - accessibility check
- **Regression:** all existing suites, including C3 (`creator_c3`) and live multiplayer.

## 4. Risks and choices
- **Two editors at once:** autosave keeps the last write. This is unchanged today, and C4 will not add real-time co-editing. A "changed by someone else" warning could follow later.
- **Excel quirks** (encodings, delimiters) are the main import risk. The template and the preview errors address them.
- **Out of scope:** drag-and-drop reordering and bulk actions on filtered results (e.g. "archive these 12"). Both are small follow-ups if wanted.
