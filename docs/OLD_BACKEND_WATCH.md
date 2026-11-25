# Old Ego Check backend: observation period

Status: started 24 Nov 2026. Earliest removal proposal: **8 Dec 2026**. Nothing will be removed without Hussam's final approval.

## What exists (production project `pulseplay`)

| Kind | Name | Access | Writes? |
|---|---|---|---|
| Function | `egocheck_create_room_json(p_read_s, p_ans_s)` | anon, authenticated | yes (new room) |
| Function | `egocheck_join_json(p_code, p_nickname)` | anon, authenticated | yes (lobby + player) |
| Function | `egocheck_submit_answer(p_token, p_q, p_option)` | anon, authenticated | yes (answer) |
| Function | `egocheck_host_step(p_code, p_token, p_action, p_read_s, p_ans_s)` | anon, authenticated | yes (room state; host token required) |
| Function | `egocheck_forget_me(p_token)` | anon, authenticated | yes (deletes own player data) |
| Function | `egocheck_host_state(p_code, p_token)` | anon, authenticated | no |
| Function | `egocheck_me_json(p_token)` | anon, authenticated | no |
| Function | `egocheck_room_state(p_code)` | anon, authenticated | no |
| Schema `egocheck` | `rooms`, `room_secrets`, `lobby`, `players`, `answers` | RLS on, no policies (functions only) | — |
| Schema `egocheck` | `question_points` | same | static, 40 rows |

## Findings on 24 Nov

- **Traffic:** 0 calls to any `egocheck_*` function in the last 24 h of API logs. All traffic goes to `pp_*` (for example `pp_state` 1,149, `pp_join` 14).
- **Data:** `rooms`, `room_secrets`, `lobby`, `players` and `answers` are empty. Only the 40 static scoring rows remain, so there is no participant data at stake.
- **Frontend dependencies:** the PulsePlay app (`web/src`, `app/`) does not call the old backend; `web/src/live/config.ts` only mentions it in a comment. The **only caller is `classic.html`** (all 8 functions). It is still deployed but no longer linked: the root page redirects to the app.
- **Source of truth:** `supabase/migrations/20261123_ego_check.sql` recreates functions and schema. It does **not** restore data. Today that does not matter because the tables are empty, but it means migrations are not a backup.

## Transition options (not applied; for decision)

1. **Frontend only, reversible:** replace `classic.html` with a redirect to the app. This removes the last caller. Rollback: revert the commit.
2. **Disable writes, keep reads:** `revoke execute` on the 5 write functions from `anon, authenticated`. That stops new rooms, joins and answers on the old path; read functions stay harmless because the tables are empty. Rollback: `grant execute ... to anon, authenticated` (one statement, instant). Recommended only after option 1, otherwise `classic.html` fails with an error.
3. **Removal** (at the end of the period, with approval): `drop` the 8 functions, then `drop schema egocheck cascade`. Before running it: export `question_points` and the function definitions (`pg_get_functiondef`) to a dated file in the repo; confirm 14 days of zero traffic in the logs; confirm empty tables. Rollback: re-run `20261123_ego_check.sql`, then re-insert the exported rows. Players' data cannot be recovered, but there is none.

## Checks to repeat before the proposal

- `egocheck_*` calls per day over the period (logs are queried in 24 h windows).
- Row counts in the 6 tables.
- `grep -r egocheck` in `web/src`, `app/`, root HTML.
- New backend health: sessions created and completed, Edge Function errors.
