# Release 3.0A: question banks and game length

## What it does
- **Question banks.** Any game can hold more questions than one session uses. New optional fields:
  - per question: `category`, `dimension`, `difficulty`, `tags`, `estSec`, `rev`, `active`, `random`, `required`
  - per game: `bank: { strategy, lengths, defaultLength }`
- **Selection strategies** (generic, nothing game-specific):
  - `fixed`: authored order.
  - `random`: least recently used first, played in random order.
  - `category` / `dimension`: even across groups, within one question of each other, played interleaved.
  - In every strategy, required questions are always included.
- **Game length.** The host picks 10 ⚡ / 15 🎯 / 20 🚀.
  - Only lengths that have enough eligible questions are selectable. The others show what is missing, and questions are never duplicated.
  - Games without a bank also offer "all N", their previous behaviour, which stays the default.
- **Server-authoritative and locked.**
  - `pp.create_session` validates length and strategy, selects the questions, and writes them into the session snapshot.
  - A database trigger refuses any later change to a session's snapshot, version or question count.
  - Every participant, reconnect and summary uses that one snapshot. New content versions never reach a running room.
- **Recent-question avoidance, privacy-safe.**
  - Signed-in hosts: the last 10 selections per game are kept server-side in `pp.selection_history` (host id, game, question ids only; not readable by browsers).
  - Anonymous hosts: their own browser keeps their last 5 selections and sends them as a hint, which the server validates and treats as best-effort.
  - Nothing about participants is stored or used.
- **Host setup.** Length cards, a selection choice with a plain explanation, reading 5/8/10 s and answering 3/5/8/12 s (plus the game's recommended time), and a live "Your game" summary with the estimated duration.
- **Lobby.** The lobby shows "N questions · about M min" before the start (and "N of B questions" for larger banks).
- **Duration estimate.** Calculated from the actual settings:
  - per question: read + answer + transition (5 s when the host advances, or the auto-advance/reveal time)
  - plus 1 min intro and 2.5 min results (1.5 min for unscored games)
  - joining time is not included
  - Calibrated on the 25 Nov game.

## Unchanged
- Scoring and result bands.
- Built-in content: no content migration in this release.
- Answer shuffling (per phone, by stable option id).
- Privacy thresholds, cleanup and organisation isolation.

## Tests
- Unit: `web/tests/bank.test.ts` (24).
- SQL: `supabase/tests/question_banks_test.sql` (34). It covers:
  - 10/15/20 selection and balance
  - insufficient banks and invalid input
  - recent-question avoidance and bank exhaustion
  - duplicate prevention
  - locked snapshots and repeated starts
  - reconnection
  - content updates not reaching running rooms
  - scoring over the played subset
  - history privacy and grants
- Browser: `web/e2e/release_3a.py` (16): setup, Arabic RTL, phone layout, lobby, random order across rooms, host-device history.
- All earlier suites still pass.

## Deploy and rollback
- Migration `supabase/migrations/20261127_0100_pp_question_banks.sql`: additive and safe to re-run.
- Edge Functions `publish` and `draft-questions`: redeploy so their schema copy accepts the new optional fields.
- Rollback: `supabase/manual/rollback_20261127_question_banks.sql`.
  - Restores the previous `create_session` and `_state`, and removes the trigger, functions and history table.
  - Tested locally: all earlier SQL suites pass after rollback, and the migration re-applies cleanly afterwards.
