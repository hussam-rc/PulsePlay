# Scoring v2: evidence-based personal feedback (built, not activated)

Status: **implemented and tested, not active.** It only applies to content with `scoring.version: 2`. No published experience has that, so every live game still uses v1. Activation needs your separate approval.

## What stays the same
- **The 0–100 game score formula:** points ÷ the maximum for the questions actually answered. It is already normalised for 10, 15 and 20 questions, and unanswered questions are excluded.
- **The four categories:** 🧘 You're in the driver's seat! · 😎 You're mostly in control! · 🦙 Your ego is grabbing the wheel! · 👑 Your ego is driving!
- **The company result:** the anonymous average, the number of completed participants, privacy thresholds (≥ 5 valid results; band breakdown ≥ 10), and no individual scores.

## What v2 adds (`web/src/engine/feedback.ts`)
| Section | Shown when | Rule |
|---|---|---|
| ✨ What you're doing well | Evidence exists | A dimension with ≥ 2 answers, all open (0) or confident (1). At most two. "Open" uses the dimension's strength text; "confident" recognises standing up for your view. |
| 🪞 Something to reflect on | Evidence exists | **Pattern:** ≥ 2 answers in a dimension and a clear majority (> 50%) self-protective or ego-driven ("a possible growth area"). Otherwise, **one situation:** a single ego-driven answer, framed as a situation worth a second look. Otherwise nothing is shown. |
| 🎯 Your next challenge | Always | One practical action for the next workday, tied to the reflection. Without a reflection, a general stretch. |
| 📊 Your score | Optional (`scoring.showScore`, default on) | Labelled "a game-based reflection score for this round only. It is not a measurement of you." |

Safeguards:
- A dimension represented by a single question is never called a strength or a pattern.
- The same dimension is never both a strength and the reflection.
- The private takeaway ("Save my takeaway (no score)") contains strengths, the reflection and the challenge. It never includes the score or the category.

## Validation (`docs/EGO_BANK_SIMULATION.md`, `web/tests/feedbackV2.test.ts`)
- Nine response patterns × 1,000 random balanced selections × 10/15/20 questions.
- **0 incoherent results.** Checked: a reflection without evidence, a single situation without an ego-driven answer, a pattern on fewer than 2 answers, a strength contradicted by an answer, and a dimension named twice.
- Deliberately stressed dimensions are named 94–100% of the time. The misses are 10-question games where the dimension appeared only once, and the system correctly declines to call that a pattern.
- **Healthy confidence:** always 😎, always gets a strength, never a reflection.
- **One threshold was tightened after simulation:** a pattern requires a majority, not half. Realistic players at 20 questions got a "growth area" 82% of the time with "half"; with "majority" it is 69%. This changed the feedback rule only, never the score.

## Versioning and activation plan (needs approval)
1. Content: publish the v2 bank as new immutable versions with `scoring.version: 2`. Existing versions and sessions are unchanged.
2. Database (additive migration):
   - add `scoring_version` to `pp.session_summaries`, filled from the snapshot at the end of a game
   - add `scoringVersion` to the room state, so the shared screen can label the average "Ego Driving Score (game score)"
3. Reports: show the scoring version, and never average or compare across versions without a clear note.
4. Edge Functions: redeploy `publish`/`draft-questions` (the schema gains `scoring.version` and `showScore`).

## Preview
- Development-only page, not in the production build: `npx vite` then `/dev/result-v2.html?lang=en&p=one` (patterns: open, confident, defensive, ego, one, pattern, mixed; `&score=off` hides the score).
- Screenshots: `docs/img/result_v2_en.png`, `docs/img/result_v2_ar.png`.
