-- NOT APPLIED TO PRODUCTION. Requires Hussam's explicit approval (see docs/CLEANUP.md).
-- Runs the cleanup once a day at 03:17 UTC. Requires the pg_cron extension.
-- Disable: select cron.unschedule('pp-cleanup');
create extension if not exists pg_cron;
select cron.schedule('pp-cleanup', '17 3 * * *', $$select pp.cleanup(false)$$);
