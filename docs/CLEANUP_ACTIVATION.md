# Cleanup job: activation recommendation (25 Nov 2026)

**Recommendation: activate in two stages, starting with a 7-day dry-run period. There is no urgency.** Production currently has nothing to clean up, so the job's value is preventive: it stops abandoned rooms (host closed the tab without ending) and counters from piling up as usage grows.

## What I verified

| Check | Result | How |
|---|---|---|
| Daily backups | Included in the Pro plan, **7 days** of daily backups (Supabase docs). Whether backups have actually run for this project, which was created on 23 Nov, is **not visible to me**. | docs.supabase.com/guides/platform/backups |
| Point-in-time recovery | Paid add-on (about USD 100/month for 7 days; needs at least the Small compute add-on). Whether it is enabled here is **not verified**; I have no tool that reads add-ons. Probably off. | same + Management API not reachable from here |
| Retention periods | Rooms: deleted only when expired more than 1 h ago (rooms expire 24 h after creation) **and** no phase change for 2 h. Rate-limit windows: 1 day. AI counters: 2 days. Run log: 90 days. | `20261125_0100_pp_cleanup.sql` |
| Deletion boundaries | Production has exactly four foreign keys into rooms/players: `session_secrets`, `lobby`, `players` → `sessions`; `responses` → `players`. All room-owned. The job deletes them explicitly, child first, and never touches summaries, audit log, games, organisations or accounts. | read-only query on production |
| Dry run on production | **0** rooms, **0** lobby rows, **0** players, **0** answers, **0** rate-limit windows, **0** AI counters would be deleted. 1 active room and 4 anonymous summaries would be kept. | read-only query equivalent to `pp.cleanup(true)`, 25 Nov 00:01 UTC; nothing installed |
| Monitoring | `pp.cleanup_runs` (one row per run), Postgres `LOG` line per run, `pp.cleanup_health.stale` turns true when no real run finished within 36 h. | tested (17 checks) |
| Rollback | Stop: `select cron.unschedule('pp-cleanup');`. Remove: drop view, function, table (3 statements). **Deleted rows cannot be restored by rollback**; only a project restore from a backup brings them back, which restores the *whole* database to that moment and causes downtime. | docs/CLEANUP.md |

## Why the residual risk is acceptable

Everything the job deletes is already unusable: expired rooms cannot be joined, read or played through the API. Players keep their private results on their own phones, not in these tables. Summaries used for insights are untouched. In the worst case (a bug), what is lost is abandoned room data that the product already treats as gone.

## Proposed activation (each step needs your go)

1. **Install, dry-run only:** apply `20261125_0100_pp_cleanup.sql` (creates function, log table, health view; deletes nothing) and schedule a **daily dry run** (`select pp.cleanup(true)`), 03:17 UTC. Review the logged counts after 7 days.
2. **Real runs:** switch the schedule to `pp.cleanup(false)` if the dry-run counts match expectations.
3. **Before step 2, please check in the dashboard** (Database → Backups) that daily backups are listed, and decide whether point-in-time recovery is worth its cost for PulsePlay. For this job alone I do not think it is necessary.

## Also noticed

The Supabase project's display name is now **"pulseplay-development"** (it was created as "pulseplay"). If this project is meant to be production, consider renaming it back to avoid confusion. If a separate production project is planned, the cleanup job should be activated there, not here.

## Status log

- **25 Nov 2026, 01:25 UTC:** stage 1 install applied to production with Hussam's approval (`pp_cleanup`: function, run log, health view; deletes nothing by itself). One manual report-only run (run 1): 0 rooms, players, answers or counters to delete; 1 active room kept. Verified that `anon` and `authenticated` cannot execute `pp.cleanup` or read `pp.cleanup_runs` / `pp.cleanup_health`.
- **Not yet done:** the daily report-only schedule (needs `pg_cron`; `supabase/manual/pp_cleanup_schedule.sql`, using `pp.cleanup(true)` first). Awaiting explicit approval. Real deletion (`pp.cleanup(false)`) stays off.
- **25 Nov 2026:** Hussam confirmed daily backups are listed in the dashboard, and that `pulseplay-development` is the only (and therefore production) project. Point-in-time recovery remains off; not needed for this job.
