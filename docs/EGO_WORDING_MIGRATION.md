# Who is in Control?: "ego" wording migration (`20261125_0300_pp_seed_ego_wording.sql`)

**Write scope (verified on a fresh schema mirroring production):** inserts exactly 4 new rows into `pp.experience_versions` (ego-check v6, ego-check-de/fr/ar v2) and updates `pp.experiences.title`/`updated_at` for those 4 built-ins (titles unchanged). Nothing else.

**Not touched:** existing versions (0 changed, md5-compared), Would You Rather and Myth or Fact (no new version), scoring (points, correct answers, band ranges and tones identical per option and band), running sessions (they keep their own snapshot), `session_summaries`, responses, organisations, user games. Re-running the file adds nothing.

**Text changes:** "autopilot" → "ego" (Arabic: الأنا) everywhere; result bands 3 and 4 rewritten to be clearer and more encouraging (no llama/donut idioms); band 3 emoji 🦙 → 🚦. The playful "llama is watching" transition line stays.

**Rollback:** previous versions stay intact. New rooms always use the latest version, so rolling back means inserting the previous content again as a new version (re-run the 20261124 seed files' blocks for these 4 slugs), or deleting the 4 new version rows while no session references them (`delete from pp.experience_versions where id in (...)`, only with approval). Already-finished sessions are unaffected either way.

## Follow-up: band 3 de-duplication (`20261125_0400_pp_seed_ego_band3.sql`)

**Why:** band 3's short message repeated the explanation's sentence ("Noticing it is the hardest part…"), and both are shown together. The message now reads (EN) "In some moments your first reflex steers. That's human, and the wheel is still yours." with equivalents in DE/FR/AR (Arabic keeps الأنا). The explanation is unchanged. A unit test now fails if any band's message repeats a sentence of its explanation, in any language.

**Write scope (verified on a local mirror whose latest version hashes match production):** inserts exactly 4 rows into `pp.experience_versions` (ego-check v7, ego-check-de/fr/ar v3); touches `pp.experiences.updated_at` for those 4 slugs (titles unchanged). Content vs the previous version: identical except `results[2].message` (band 3). All older versions, Would You Rather, Myth or Fact, sessions, responses and summaries unchanged. Re-running adds nothing.

**Rollback:** delete the 4 new rows while no live session references them (sessions keep their own snapshot, so finished and running rooms are unaffected); new rooms then use v6/v2 again. Only with approval.
