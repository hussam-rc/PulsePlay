# Open Answer questions: release notes and activation plan (PR #17)

Status: **draft, not deployed.** The migration has not been applied to production. Activation needs explicit approval.

## What ships

Open Answer is a generic PulsePlay question type. It is not tied to Ego Check. Any game kind can contain it, and it is never scored.

- **Projector views:** live word cloud, answer wall, or live list.
- **Moderation:** host approval by default.
- **Filtering:** an offensive-word filter and a check for code-like text both hold answers for the host; neither publishes anything.
- **Privacy:** anonymous to the host; texts are deleted with the room.

| Part | Change |
|---|---|
| Database | `20261128_0200_pp_open_answers.sql`: table `pp.open_answers`, `pp.open_submit`, moderation through `pp.host_command`, and the open view in `pp._state`. Additive; no existing data changes. |
| Edge Functions | `publish` and `draft-questions` carry the schema copy with the `open` type. They must be redeployed, or publishing an open question is refused (a safe failure). |
| Frontend | Creator Studio settings, phone input, projector (cloud / wall / list), host moderation panel, projector window (`#/screen`), practice mode. |

## Integration with scoring v2 (PR #12)

Both PRs redefine `pp._state`. Open Answer's definition is a **superset**: it contains #12's `scoring.version` line, which does nothing until a snapshot carries `scoring.version`.

- **Recommended order:** apply `20261128_0100_pp_scoring_v2` first, then `20261128_0200_pp_open_answers`. Both features are kept.
- **If scoring v2 is ever applied after Open Answer:** run `supabase/manual/pp_state_combined.sql` straight afterwards. Otherwise `_state` stops returning open answers. This was verified locally in both orders.
- `supabase/tests/state_combined_test.sql` (in CI) checks that both are present. A unit test keeps the manual file identical to the migration.
- **Merge conflicts:** three trivial ones in `ci.yml`, `run_all.sh` and `view.ts`. They are resolved on `integration/open-answer-scoring-v2` (draft PR #18, do not merge), and the whole combined branch passes every suite.
- **Rollback:** roll back in reverse order. The Open Answer rollback restores `_state` with the inert scoring line, so it is safe with or without #12.

## Production activation sequence (each step needs approval)

1. **Pre-checks.**
   - Production backup is less than 24 h old and verified.
   - CI is green on #17, and the #18 integration run is green.
   - No live rooms are running (check `pp.sessions`).
2. **Merge #17** (squash) into `main`. If #12 is already merged, resolve the three trivial conflicts exactly as on #18.
3. **Apply the migration** `20261128_0200_pp_open_answers.sql`.
   - Apply it after `20261128_0100` if scoring v2 is part of the same release.
   - It is additive. Existing games keep working, because the old frontend never sends open questions.
4. **Verify the database:**
   - Run `open_answers_test.sql` and `state_combined_test.sql` inside a transaction that is rolled back.
   - Run the Supabase security advisors. Confirm that `anon` cannot select `pp.open_answers` or execute `pp._open_*`.
5. **Redeploy** the `publish` and `draft-questions` Edge Functions from `main`.
6. **Publish the frontend:** `cd web && npm run publish:pages` with the env vars unset, then check that the build has no `localhost:8789` or `testkey`.
7. **Production acceptance:**
   - Use one disposable private game in the personal workspace. Practice first, then a live room with 2–3 phones (EN + AR).
   - Run through approve, remove, clear, close and reveal, then end the room.
   - Confirm that `pp.open_answers` holds no rows for that session. Delete the test game only with approval.
8. **Monitor for 7 days:** API errors, `rate_limits` growth, and the row count in `pp.open_answers` (it should return to 0 between events).

**Rollback** (no participant data outside open answers is affected):
1. Unpublish games that contain open questions.
2. Revert the frontend commit.
3. Run `supabase/manual/rollback_20261128_open_answers.sql`. This deletes the open answers.
4. Redeploy the previous Edge Functions.

## Retention

- **Raw text:** lives only in `pp.open_answers`, linked to the session and player with cascade delete. It is removed when:
  - the host ends the room;
  - the participant uses "forget me" or is removed by the host;
  - the room expires (24 h after creation) and is purged the next time any room is created.
- **Summaries:** keep counts only (`{n}` per open question), never words.
- **Residual:** an abandoned room can keep its texts until the next room is created after expiry. The scheduled cleanup job (`ops/cleanup-job`) would close this gap, but its schedule is not approved yet.

## Known limits and open risks

- **Filters are basic** (a short EN/DE/FR/AR word list and a code-like text check). Safety rests on host approval, which is the default. "Show at once" mode still holds flagged answers, but unflagged offensive phrasing can appear.
- **Content language:** questions are written in one language. Phones say so when their interface language differs. There are no per-question translations.
- **Browsers:**
  - Chromium is tested end to end.
  - Firefox and WebKit (Safari's engine on Linux) are covered by a CI smoke test.
  - Real iOS Safari and Android Chrome have not been tested.
- **Load:**
  - 80 concurrent participants (about 140 answers) were tested against a local Postgres, not production.
  - A projector window doubles that host's polling (every 700 ms).
- **Word cloud:** shows the first 120 distinct answers. The wall shows the latest 60, and the list the top 12.
- **Projector window:** uses the host session saved in the same browser profile, so anyone at the host's computer can open it.
- **Translations:** the Arabic copy was rewritten to avoid number-agreement errors, but it still needs a native-speaker review. German and French remain draft.
- **Solo play:** a self-paced game treats an open question as a private note kept on the device.
