# PulsePlay Creator Studio: architecture and implementation plan

Status: 25 Nov 2026. Goal: anyone can create, preview, publish and host a great experience without technical knowledge.

## 1. What already exists (audited)

| Capability | State | Where |
|---|---|---|
| Form-based builder: 4 game types, questions, answers, correct answer or 0–3 points, results bands, timing, privacy | Live, English only | `builder/Builder.tsx`, `builder/model.ts` |
| Plain-language checker linked to fields | Live | `builder/model.ts#humanize` |
| Autosaved drafts, immutable published versions, personal and organisation libraries | Live (RLS-isolated, tested) | `pp.experiences`, `pp.experience_versions` |
| Preview with simulated players | Live, but **requires sign-in** | `/workspace/preview/:id` → `PracticeRun` |
| Server-validated publishing | Live (`publish` Edge Function) | |
| AI question drafts (optional, server-side key) | Live | `draft-questions` Edge Function |
| Start points | Blank game by type, or copy of a built-in game | Workspace |

**Main gaps for nontechnical creators:** nothing can be tried before signing in; the start is a blank form or a copy of a full game; only multiple-choice/poll/scale mechanics; one round, one game per room.

## 2. Architecture decisions

1. **Draft = published shape.** A draft is an `Experience` with `status: 'draft'`. Templates, the editor, preview and publishing all share the engine schema, so a template that validates can be played, previewed and published with no conversion step.
2. **Templates are code-reviewed content** (`builder/templates.ts`), validated in unit tests and playable in practice mode. Later: organisation templates stored as experiences with `visibility = 'org'` and a `template` flag (no new table needed).
3. **Try before account:** template previews run in `PracticeRun` entirely in memory. Nothing is stored and no request is made, which keeps it outside the privacy and tenancy model.
4. **New mechanics are additive activity types** (`wordcloud`, `ranking`, `scenario`, `team`) with: a zod schema member, a server validation and aggregation function in `pp`, a phone input, a reveal component, and a builder editor. Unknown types are already ignored at play time, so older clients keep working.
5. **Experience Builder (multi-round)** uses the existing `rounds[]` array: each round gets a title and may mix activity types. The engine already iterates activities across rounds, so the change is mostly in the builder and the round-transition screen.
6. **Game Night** = one room hosting a **playlist** of published versions. Server: `pp.sessions` gains `playlist jsonb` (version ids) and `game_idx`. When a game ends, the next snapshot loads **in the same room** and players stay joined (same tokens and nicknames). Results per game are computed and deleted per game as today. Privacy is unchanged: per-game minimum group size, no cross-game individual history.

## 3. Release plan (small PRs, each independently testable)

| Slice | Scope | Tests | Risk |
|---|---|---|---|
| **C1 — Starter templates + try without account** (this PR) | 5 templates (Trivia Quiz, Icebreaker, Would You Rather?, Opinion Poll, Personal Reflection); Create page gallery; "Try it" runs practice mode without sign-in; "Use this template" creates a draft after sign-in (pending choice survives the sign-in step) | unit: every template validates, is playable end to end in the engine; browser: gallery, try, use → editor with template content → publish → host | Low: frontend only, uses existing draft API |
| C2 — Creator flow polish | Guided first-run (what should players experience, audience, size, time → suggested template), visual question list with drag-and-drop, inline phone preview beside the editor, translated builder | browser on 375 px and desktop, EN/DE/FR/AR | Low |
| C3 — Ranking + Word cloud | New activity types; word cloud needs **moderation before projection** (host approves words; profanity filter; minimum group size) | SQL (validation, aggregation, injection), browser, privacy (no individual text shown below minimum) | Medium (free text) |
| C4 — Scenario decisions | Branching-free scenarios first: situation + options + consequence text per option | unit + browser | Low |
| C5 — Team Challenge template + collaborative mechanic | Teams assigned in the lobby; team answers (first answer or majority); team scoreboard. **Team Challenge template ships here**, not before, because it needs team mechanics | SQL (team isolation), multiplayer browser | Medium |
| C6 — Experience Builder | Multiple rounds, round titles, mixed mechanics per round | browser | Low–medium |
| C7 — Game Night | Playlist in one room, same QR; host picks 2–5 published games; transitions between games | SQL + multiplayer browser incl. refresh between games | Medium |

**Not shipped until complete:** no "Team Challenge", word cloud or Game Night entry appears in production navigation before its slice is done and tested.

## 4. Privacy and isolation rules for all slices

- Organisation templates and drafts stay under existing RLS (`pp.has_role`); tests extend `workspaces_isolation_test.sql`.
- Free-text mechanics: nothing reaches the projector without host approval; texts are escaped (React) and length-limited server-side; minimum group size applies.
- Reflection results stay on the phone; Game Night never links a player's results across games.

## 5. Open product questions (for later slices)

- Should organisations be able to publish templates to the whole community? (Needs the moderation workflow from Release 2.0E.)
- Language of templates: templates are English in C1; translated template content follows the same pattern as the built-in language versions.
