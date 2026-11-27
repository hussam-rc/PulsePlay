# Scoring v2: validation report (approved for continued testing, not activated)

Status: **approved for final testing; not active in production.** v2 applies only to content with `scoring.version: 2`, and no published experience has it, so every live game still uses v1. Activation needs your separate approval. Full simulation output: `docs/EGO_BANK_SIMULATION.md`.

## Verdict
- **The formula is valid across banks and game lengths.** With tied scores it moves a strongly ego-driven player from 92 to 99, which is closer to the intended 100, and it changes nothing else materially.
- **Ties lower the scores of reasonable players.** Healthy assertive play now scores about 1 instead of about 33, because assertiveness is no longer penalised. This is the intended effect, not a tuning target: no weights were adjusted to reach a company average.
- **The feedback is coherent.** 0 contradictions in 30,000 simulated results.

## Formula
**Ego Driving Score = round(100 × Σ points earned ÷ Σ maximum points of the questions answered)**

- 100 means the maximum ego-driving points *possible for the questions this player answered*. There is no assumed fixed maximum of 3.
- Questions without an ego-driven option (maximum 2) count with their own maximum.
- Unanswered questions are excluded. A result needs ≥ 70% answered (unchanged).
- The formula is identical in the browser (`scoring.ts`) and the database (`_player_stats`), so 10, 15 and 20 questions and any future bank use the same rule.
- **Feedback levels** (used for strengths and reflections, never the score) use the bank's point scale, `scoring.maxPoints`. A 2 is therefore always "self-protective" and a 3 always "ego-driven", even in a question whose maximum is 2. Without this, a 2-point answer in a 2-max question would be read as ego-driven.

## Does normalising across different questions distort the score?
Compared over 1,000 random balanced selections per pattern:

| Pattern (20 questions) | **Approved:** Σp ÷ Σmax | A: Σp ÷ (3 × n) | B: mean of p ÷ max |
|---|---|---|---|
| Healthy confidence | 1 | 1 | 1 |
| Realistic mix | 22 ± 8 | 21 ± 8 | 22 ± 8 |
| Defensive | 58 ± 4 | 54 ± 3 | 59 ± 4 |
| Strongly ego-driven | **99 ± 1** | 92 ± 3 | 99 ± 2 |

- **A** penalises the bank for including 12 questions with no ego-driven option: a fully ego-driven player can never reach 100, and their score depends on which questions were drawn.
- **B** gives a 2-max question the same weight as a 3-max one. A single self-protective answer on a 2-max question then counts as 100% ego for that question.
- **Approved** sits between them. Its spread from random selection is ≤ ±11 points at 10 questions and ±8 at 20, so differences between selections are smaller than the width of a category band (25).
- **Conclusion:** no material distortion. Keep the approved formula.

## Impact of tied scores
| | Before (0/1/2/3 forced) | After (ties) |
|---|---|---|
| Always assertive/neutral/boundary answer | ~33 → 😎 | ~1 → 🧘 |
| Realistic mix (35% open, 35% assertive, 20% self-protective, 10% ego) | ~38 | ~22 (🧘 63–70%, 😎 30–35%) |
| Always self-protective | ~67 | ~58 (🦙 88–99%) |
| Always ego-driven | 100 | 99 (👑 100%) |

- **Category bands are unchanged** (0–25 / 26–50 / 51–75 / 76–100). Results now lean calmer because healthy behaviour is no longer scored as mild ego.
- If live teams feel the scores are "too kind", the fix is the content (more realistic ego options), not the bands or weights. That decision is yours after the first real games.
- **One weaker area:** a 10-question game finds a feedback + collaboration defensive pattern only 42% of the time (84% at 20 questions). Many self-protective answers there now score 1, and 10 questions often include only one question per area. The system then says nothing rather than over-claim, which is the safe failure.

## Feedback rules (`web/src/engine/feedback.ts`)
| Section | Rule |
|---|---|
| ✨ What you're doing well | An area with ≥ 2 answers, every answer at level ≤ 1 and a mean ≤ 0.5. At most two. Open and assertive answers both qualify, so confidence is never penalised. |
| 💡 Something to reflect on | **Pattern:** ≥ 2 answers in an area, ≥ 2 of them at level 2–3, and a clear majority (> 50%). Otherwise **one situation:** the first ego-driven answer. Otherwise nothing. |
| 🎯 Your next challenge | One action, tied to the reflection; otherwise a general stretch. |
| 📊 Your Ego Driving Score | Optional (`showScore`). Described as "a game-based reflection score for this round only… It does not measure your ego or personality." |

Safeguards:
- A single question never makes a strength or a pattern.
- An area is never both a strength and the reflection.
- Feelings are never scored.
- The private takeaway never includes the score or the category.

## Tests added (`web/tests/feedbackV2.test.ts`, `egoBank.test.ts`, `translations.test.ts`, `supabase/tests/scoring_v2_test.sql`)
- **Tied scores:**
  - both 0-point answers give identical results
  - a strength is still awarded when assertive answers are used
- **Variable maximum:**
  - 2-max questions reach 100 when the worst option is picked
  - a mixed bank is normalised by Σmax
- **Questions without a high-ego option:** they never produce a "single situation" reflection, and a 2 there counts as self-protective.
- **Balanced selection and 10/15/20 scoring:** every length uses the same formula, and areas stay balanced.
- **Feedback consistency:** no contradiction across all simulated patterns.
- **Translation completeness:**
  - every question and answer is present in DE/FR/AR, mapped by authored position
  - Arabic uses الأنا
  - all three stay draft
- **Historical compatibility:**
  - v1 content produces exactly the v1 result: no feedback object, same score, same habit
  - v1 rooms expose no scoring version
- **Published-version immutability:** the existing snapshot lock and version tests still pass (34 + 40 SQL checks).
- **Existing multiplayer:** all SQL suites pass on a fresh database: 183 checks in 10 suites, including the new one. The browser suites run in CI on the PR.

## Personal and team result layout
- **Personal:** 🪞 Who's Driving? → large emoji and title → ✨ What you're doing well → 💡 Something to reflect on → 🎯 Your next challenge → 📊 Your Ego Driving Score (optional).
- **Presenter, v2 games only:** 🏢 Our Team Ego Driving Score
  - a large average with a gauge
  - a friendly team message
  - number joined and completed
  - a reflection prompt
- **Unchanged rules:** no names; the result is hidden below 5 valid completions; the band breakdown appears only from 10. v1 games keep their existing layout.
- **Screenshots** (`docs/img/`): `result_v2_r_en_one`, `r_ar_one`, `r_de_mixed`, `r_fr_ego_noscore` (score hidden), `g_en_12` (team, 12 completions), `g_ar_8` (team, 8: no breakdown).

## Versioning and activation (needs your approval)
- **Version number:** v2 was never released, so no v2 results exist. Version 2 is therefore kept rather than bumped. Any future change to the model gets version 3.
- **Never compare incompatible versions:** a summary is only comparable with summaries of the same `scoring_version`. Reports must group by it.

**Activation steps** (each separately reversible):
1. **Planned migration** `20261128_0100_pp_scoring_v2.sql`, additive. Not applied to production; tested in CI and locally, with its rollback verified.
   - `_state` exposes `experience.scoring.version` (v1 rooms unchanged)
   - `session_summaries.scoring_version` (existing rows = 1), set automatically when a summary is written
   - rollback: `supabase/manual/rollback_20261128_scoring_v2.sql`
2. Redeploy the `publish` and `draft-questions` Edge Functions, whose schema gains `scoring.version`, `showScore` and `maxPoints`.
3. Publish the v2 bank as a new immutable version. Existing versions and sessions are untouched.
4. Reports: group averages by `scoring_version` (Creator slice C3f).
