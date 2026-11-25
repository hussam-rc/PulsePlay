# Scheduled cleanup of expired rooms

Status: **built and tested locally; not enabled in production.** Enabling needs Hussam's approval.

## What it deletes

| Data | Deleted when | Why that is safe |
|---|---|---|
| A room (`pp.sessions`) | expired more than **1 hour** ago (rooms expire 24 h after creation) **and** no phase change for **2 hours** | Expired rooms can no longer be joined, played or read through the API (`pp_state` checks `expires_at`). The 2-hour idle rule is an extra guard. |
| That room's host secret, lobby nicknames, player tokens and answers | together with the room, deleted explicitly child-first | They belong only to that room. Nothing else references them. |
| Rate-limit windows (`pp.rate_limits`) | older than **1 day** | Windows are at most 1 hour long; only the current one is read. |
| AI request counters (`pp.ai_requests`) | older than **2 days** | The quota counts the last 24 hours (the quota function already trims these). |
| Cleanup run log (`pp.cleanup_runs`) | older than **90 days** | Operational log only. |

## What it never touches

Active rooms; `session_summaries` (anonymous totals shown in Workspace and reports); `audit_events`; experiences and versions; organisations, members, invites, profiles; anything in `auth`. The test checks these counts before and after.

Rooms that end normally are already removed by the host's "End" command. In practice the job only clears rooms that were abandoned (host closed the tab) plus the small counter tables.

## How it works

- `pp.cleanup(p_dry_run default true, p_batch default 5000)` returns the counts of what it would delete or did delete, plus how many active rooms it kept.
- **Dry run is the default.** `select pp.cleanup();` changes nothing and only logs the counts.
- **Idempotent:** a second run deletes nothing new. A lock stops two runs at the same time.
- **Batches:** at most 5,000 rooms per run; `batch_limited: true` means more remain for the next run.
- **No reliance on cascades:** child rows are deleted explicitly, and the room delete re-checks the expiry.
- **Access:** only the database owner can run it or read its log; the public API (anon or signed-in) cannot (tested).

## Logging and monitoring

- Every run writes a row to `pp.cleanup_runs` (started, finished, dry run, counts) and a `LOG` line to the Postgres log (`pp.cleanup run=…`).
- `select * from pp.cleanup_health;` shows the last real run, its counts, rooms overdue by more than 2 days and `stale = true` if no real run finished in 36 hours. A failed run rolls back completely and leaves no row, so `stale` is the alarm.

## Tests

`supabase/tests/cleanup_test.sql` (17 checks, also run in CI) uses representative data: an active room with players and answers, a room just inside the grace period, an expired room whose phase changed recently, an abandoned room with lobby, players and answers, old and new rate-limit rows, plus extra abandoned rooms for the batch limit. It checks dry run, real run, idempotency, untouched unrelated tables, monitoring, input validation and that anon/signed-in users cannot run it.

## Production snapshot (24 Nov, read-only)

2 active rooms, 0 expired rooms, 12 rate-limit rows. `pg_cron` is available but not installed. A first real run today would delete almost nothing.

## To enable (needs approval)

1. Apply `20261125_0100_pp_cleanup.sql` (creates function, log and view; deletes nothing).
2. Run `select pp.cleanup();` (dry run) and review the counts.
3. Apply `supabase/manual/pp_cleanup_schedule.sql`: installs `pg_cron` and schedules a daily run at 03:17 UTC.

**Disable:** `select cron.unschedule('pp-cleanup');`. **Remove entirely:** `drop view pp.cleanup_health; drop function pp.cleanup(boolean, int); drop table pp.cleanup_runs;`.

## Recovery limits

Deleted rows cannot be undone by this job, and migrations do not restore data. Recovery of deleted data is only possible through Supabase's database backups (Pro plan: daily backups; point-in-time recovery only if that add-on is enabled — not verified). Because the job removes only expired, unusable room data and short-lived counters, no recovery path is normally needed. Players' private results are kept on their own phones, not in these tables.
