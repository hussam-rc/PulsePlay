# Who is in Control?: "ego" wording migration (`20261125_0300_pp_seed_ego_wording.sql`)

**Write scope (verified on a fresh schema mirroring production):** inserts exactly 4 new rows into `pp.experience_versions` (ego-check v6, ego-check-de/fr/ar v2) and updates `pp.experiences.title`/`updated_at` for those 4 built-ins (titles unchanged). Nothing else.

**Not touched:** existing versions (0 changed, md5-compared), Would You Rather and Myth or Fact (no new version), scoring (points, correct answers, band ranges and tones identical per option and band), running sessions (they keep their own snapshot), `session_summaries`, responses, organisations, user games. Re-running the file adds nothing.

**Text changes:** "autopilot" → "ego" (Arabic: الأنا) everywhere; result bands 3 and 4 rewritten to be clearer and more encouraging (no llama/donut idioms); band 3 emoji 🦙 → 🚦. The playful "llama is watching" transition line stays.

**Rollback:** previous versions stay intact. New rooms always use the latest version, so rolling back means inserting the previous content again as a new version (re-run the 20261124 seed files' blocks for these 4 slugs), or deleting the 4 new version rows while no session references them (`delete from pp.experience_versions where id in (...)`, only with approval). Already-finished sessions are unaffected either way.
