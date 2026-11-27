# Native-language review packages: Ego Check v2 (“Who is in Control?”)

One file per language: `ego-bank-review-de.html`, `ego-bank-review-fr.html`, `ego-bank-review-ar.html`. Each one works offline: open it in any browser, with no login and no server.

**What reviewers can do (116 items per language: 4 game texts, 60 questions, 32 feedback texts, 20 result texts)**
- See the English original next to the draft translation. For questions, all four answers appear side by side, each with its fixed points.
- Suggest new wording for the question or any single answer.
- Tick **Cultural ambiguity** and add a comment.
- **Approve** or mark **Needs change** for each item. Progress is saved in their browser.
- Filter by not reviewed, needs change, flagged or approved.
- **Export** the feedback as JSON (re-importable) or CSV (opens in Excel) and send it back.

**Rules**
- **Points cannot change through translation.** They come from the English master. A reviewer who thinks a score is wrong should flag it in a comment.
- **Approval in the file is input, not publication.** A language moves to `in-review`, then `reviewed`, in `web/src/experiences/drafts/translate.ts` (`TRANSLATION_STATUS`), with the reviewer's real name and the date, once the content owner has applied the feedback. Nothing is published before that.
- **Rebuild after any content change:** `cd web && npx tsx scripts/build-review-packages.ts`. The package shows its build date, so an export can be matched to the version that was reviewed.

**Known points to check**
- **Arabic:** Player-facing adjectives were made gender-neutral (e.g. «تحدثت بحدّة», «ألتزم الحياد»). Prompts still address the player with the masculine generic (Arabic has no neutral second person), and colleagues alternate between female and male across questions, consistently within each question, as in German and French. This convention is decided; please review the wording.
- **German:** du-form and Swiss spelling.
- **French:** tu-form, and the length of answers on phones.
