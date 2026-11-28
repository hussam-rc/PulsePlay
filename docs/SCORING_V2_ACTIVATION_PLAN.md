# PulsePlay: Ego Check v2 production activation plan (for approval)

Status: **plan only. Nothing in this document has been applied to production.** Each step needs your go-ahead and can be rolled back on its own. The steps keep existing live games, privacy thresholds and historical results unchanged.

## Where we are
- **English bank:** approved (60 questions, with sa4 at 3). German, French and Arabic stay draft until native review.
- **Staged acceptance test:** passed in the isolated test environment (`web/e2e/scoring_v2_acceptance.py`, 20 checks). The flow:
  - A creator imports the v2 game file and publishes it through the real publish function.
  - Six phones play a hosted room.
  - Every personal score matches 100 × Σ points ÷ Σ question maxima, from 0 to 100 inclusive, including questions whose top score is 2.
  - The v2 result layout appears; the optional score can be hidden; scores are described as a game-based reflection score.
  - The team score is the mean of valid scores. With 4 players it is withheld (minimum 5). The breakdown appears only from 10. No names are shown anywhere.
  - Summaries are tagged `scoring_version` 2 for v2 rooms and 1 for v1 rooms.
  - The existing v1 game is unchanged.
- **Other test results:** unit 145/145; SQL 180/180, including the planned migration and its rollback; the 11 existing browser suites all pass.

## Decision needed first: how v2 reaches players
| | **A. Pilot as a separate game (recommended)** | B. Replace the built-in Ego Check |
|---|---|---|
| What players see | A new unlisted game, "Ego Check (60 questions, pilot)", hosted by link. The built-in 10-question Ego Check stays as it is. | The built-in Ego Check becomes the 60-question v2 for every host. |
| History | v1 and v2 results never share an experience, so reports cannot mix them. | Same experience, two scoring versions. Reports must group by version first (Creator slice C3f, not built yet). |
| Risk | Low; easy to withdraw. | Every host changes at once. |
| Later | After the pilot, switch the built-in (B) once reports group by version. | – |

## Steps (option A)
| # | Step | Production change | Verify | Roll back |
|---|---|---|---|---|
| 0 | **Backup check** | none | Latest daily backup is less than 24 h old (PITR is off). | – |
| 1 | **Merge PRs #10 → #11 → #12** into main, with the production build. The bank stays unregistered in the catalogue. | Frontend only. The v2 code paths run only for content marked as version 2. | Pages serves the new bundle; the 6 built-in games play; v1 results look the same. | Revert the merge commit. |
| 2 | **Apply the scoring migration** `20261128_0100_pp_scoring_v2.sql`. It is additive: a new state field and a new summary column, default 1. | Database (additive) | A v1 room's state is unchanged; a new v1 summary is tagged 1; existing summaries are unchanged. | `supabase/manual/rollback_20261128_scoring_v2.sql` |
| 3 | **Redeploy the `publish` and `draft-questions` Edge Functions.** Their schema gains `scoring.version`, `showScore` and `maxPoints`. | Edge Functions | Republish an existing v1 test game: accepted, content unchanged. | Redeploy the previous version (v2 of each function). |
| 4 | **Publish the pilot game.** Import the v2 English game file into your workspace as an unlisted experience, then publish. | One new experience; no existing game touched. | Publish accepted; stored version carries scoring version 2. | Unpublish or archive that one experience. |
| 5 | **Production acceptance** with disposable rooms (as in the 3.0A checks). | Test summaries only, retained. No deletion without your approval. | Scores, layout, team result, privacy thresholds, `scoring_version` = 2; one v1 room shows version 1. | – |
| 6 | **Pilot with a real team.** You choose the team and the date. | – | Feedback on believability and tone; whether scores feel too kind. | Withdraw the pilot link. |

## Not included
- Translations: activated per language only after native review.
- Switching the built-in Ego Check to v2 (option B): needs C3f (reports grouped by scoring version) and a separate approval.
- Removing the old egocheck backend: the Dec 8 review is still pending.
