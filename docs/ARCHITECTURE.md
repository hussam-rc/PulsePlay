# PulsePlay — Architecture & Plan (Phase 0)

*Bring people together. One game at a time.*
Status date: 23 Nov 2026. This document separates **what exists** from **what is planned**.

## 1. Audit of what exists

| Area | State | Notes |
|---|---|---|
| Ego Check LIVE (`index.html`) | **Live**, verified end to end on 23 Nov | Single-file app, 10 questions, demo mode, host/join/QR, private results, team average ≥5 |
| Backend | **Live** in the dedicated Supabase project `pulseplay` (Pro, Frankfurt), schema `egocheck` + 8 `public.egocheck_*` RPCs. Moved out of `rc-academy-staging` on 23 Nov | Server clock decides deadlines; names and answers in unlinked tables; duplicate/late rejection; 24 h expiry |
| Hosting | GitHub Pages from branch `main`, root | Reachable from Switzerland; Egypt reachability not yet confirmed |
| Tests | Local: 7-session Playwright run vs Postgres 16; live: scripted 6-player run from a real browser | Not yet in CI |

**Technical debt / risks**
- Resolved 23 Nov: Ego Check moved to the dedicated `pulseplay` project; the copy in `rc-academy-staging` is removed after the live page is confirmed on the new backend.
- Single 1,100-line HTML file: fine for one game, not for a platform. Its engine ideas (host state machine, seeded answer shuffling, server-authoritative phases, privacy split) are reused; its code is not.
- Live state uses polling (~0.5 s). Adequate for ≤80 players; Supabase Realtime broadcast is the Phase 1b upgrade.
- No rate limiting on `join` beyond an 80-player cap per room.

## 2. Target architecture

```
GitHub Pages (static, portable)          Supabase project "pulseplay" (Pro, EU)
┌──────────────────────────────┐         ┌────────────────────────────────────────┐
│ React + TS + Vite + Tailwind  │  HTTPS  │ Postgres + RLS (tenancy, roles)        │
│  routes: Discover/Play/Create │ ──────▶ │ RPCs (SECURITY DEFINER) for live play  │
│  /Host/Workspace/Admin        │         │ Auth (creators/facilitators only)      │
│ engine/ (pure TS, shared)     │ ◀────── │ Realtime broadcast (session channels)  │
│ practice mode (no backend)    │  WS     │ Edge Functions (rate limits, exports)  │
└──────────────────────────────┘         └────────────────────────────────────────┘
```

**Key decisions**
1. **Engine is pure TypeScript** (`web/src/engine`) with no React or Supabase imports, so the same scoring and validation run in the browser, in tests and (Phase 2) in an Edge Function.
2. **Server is authoritative** for state, timing and scoring in live sessions. Clients send intents (`join`, `answer`, `host_step`) and never send scores.
3. **Experiences are versioned JSON documents** validated by a schema (`schemaVersion: 1`). Sessions run on an **immutable snapshot** of a published version.
4. **Anonymous participants are not users.** They hold a per-session token. Auth is only for creators, facilitators and admins.
5. **Privacy by structure.** Lobby identity (nickname/avatar), response records and private results live in separate tables with no foreign key between identity and responses. Aggregates have a minimum group size (default 5) and suppress small segments.
6. **Hash routing** (`#/discover`) so refreshes work on any static host with no server rewrites, which keeps the host portable to Cloudflare Pages or Vercel.
7. **Practice mode is first-class.** The same engine runs with simulated participants entirely in memory and never writes to the database or analytics.

## 3. Reuse map

| From Ego Check | Into PulsePlay |
|---|---|
| Questions, rubric, result bands, copy | `experiences/ego-check.ts` (schema v1) |
| Host phase machine (read → answer → locked) | `engine/session.ts` (generic over activities) |
| Seeded per-player answer shuffle | `engine/random.ts` |
| Server RPC design, privacy split, thresholds | Phase 1b schema `pulseplay` (sessions, participants, responses) |
| QR generation, presenter layout ideas | `ui/` components |

## 4. Minimal versioned experience schema (v1)

```ts
Experience {
  schemaVersion: 1; id; slug; title; tagline; emoji; category; description;
  durationMin; players: {min, max}; languages: ['en']; ageRating; contentNotes?;
  facilitator: 'required'|'optional'; modes: ('live'|'self'|'practice')[];
  privacy: { individualResults: boolean; groupMinimum: number; retainResponses: boolean };
  scoring: { kind: 'behaviour'|'correct'|'aggregate'|'none'; max?: number };
  results?: ResultBand[]     // complete, non-overlapping 0..100 ranges, validated
  rounds: Round[]            // Round { id, title?, activities: Activity[] }
}
Activity =
 | { type:'choice';   prompt; options:{id,text,points?,correct?}[]; shuffle; timing }
 | { type:'poll';     prompt; options:{id,text}[]; timing }
 | { type:'scale';    prompt; min; max; labels; timing }
 | { type:'reflection'; prompt; private: true }
timing = { readSec; answerSec }
```
Rules: unknown activity types are rejected at publish but **ignored with a notice** at play time, so old games keep working when new mechanics are added. A `schemaVersion` bump comes with a migration function.

## 5. Navigation and core interfaces

`Discover | Play | Create | Host | My Workspace` (+ Admin for platform admins)

- **Discover:** library grid with search and category filter; detail sheet with duration, players, modes, privacy note and *Play solo / Host / Practice*.
- **Play:** join with a code or QR (live), or play any self-paced experience.
- **Host:** pick an experience → settings → *Practice* (simulated 5–20) or *Live room*. Projector layout, keyboard shortcuts.
- **Create** (Phase 2): builder wizard, activity editor, results builder, validation, simulated test.
- **Workspace** (Phase 1b): sign-in, my experiences, sessions, organisation members and roles.

## 6. Data model (Phase 1b, dedicated project)

Identity: `profiles`, `organisations`, `organisation_members(role)`
Content: `experiences(owner, org, visibility, status)`, `experience_versions(json, published_at)`
Live: `sessions(snapshot_version_id, host_user, state, deadlines)`, `session_secrets`, `lobby(nickname, avatar)`, `players(token_hash)`, `responses(player_id, activity_id, value)`
Results: `aggregate_results(session, activity, payload, n)`; private results are computed on demand from `responses` + token, never stored with names.
Governance: `reports`, `audit_events`, `feature_flags`.
RLS: org data visible to members by role; public library is published and approved only; live tables have no client access except through RPCs.

## 7. Phased backlog

**Phase 1a: done (23 Nov)** (frontend; served at `/PulsePlay/app/`)
- App shell, design system, hash routing, RTL-safe layout (logical CSS)
- Schema v1 + validator, scoring engine, result-band validator
- Experiences: Ego Check, Would You Rather?, Myth or Fact?
- Practice mode with 5–20 simulated players (projector + phone view)
- Self-paced play for all three
- Live Ego Check stays on the existing backend (Play → join code routes there)
- Unit tests (19, Vitest) + browser tests (21 checks, Playwright) + CI workflow (type-check, tests, build)
- Ego Check backend moved to the dedicated `pulseplay` Supabase project

**Phase 1b: needs the dedicated Supabase Pro project**
- Migrations for the data model above, RLS, RPCs, Realtime broadcast
- Generic live sessions for all experiences (pause/resume, late-join policy)
- Auth (email magic link), personal workspace, basic organisations and roles
- GitHub Actions → Pages deploy (switch the Pages source to "GitHub Actions")

**Phase 2:** Create Studio (wizard, editor, CSV import, results builder, drafts, versions, simulated test), more activity types (this-or-that, ranking, word cloud, open response), basic analytics.
**Phase 3:** remaining 9 experiences, community challenges, team vs team, moderation workflow, Arabic (RTL), German, French, enhanced analytics.
**Phase 4:** AI co-creator (server-side, consented, human-approved), learning paths, team adventures, integrations.

Challenged / simplified on purpose
- No Storage, Edge Functions or TanStack Query until a feature needs them.
- Guess Who and Most Likely To need named-consent flows. They wait for Phase 3 moderation tooling.
- No numeric scores for polls, open responses or discussions.

## 8. Security & privacy checklist (status)
- [x] Server-side deadlines, duplicate/late rejection, host token (Ego Check live)
- [x] Unlinked identity vs responses; group minimum 5; distribution only from 10
- [x] No privileged keys in the frontend (publishable key only reaches the game RPCs)
- [x] Rate limiting on public RPCs (pg-based, per IP)
- [x] Audit events for organisation actions
- [x] Cross-organisation access tests with multiple users (SQL + browser)

## 9. Rollback
- Frontend: Pages serves `main`. To roll back, revert the commit; the previous `index.html` is restored.
- Ego Check backend removal (when migrated): `drop schema egocheck cascade` + drop 8 `public.egocheck_*` functions (statement at the end of the migration file). Run it only after the new backend has served a successful session.

## 10. Phase 1b status (slice 2: accounts and organisations)
- Creator sign-in: Supabase Auth email link or 6-digit code, no passwords, no extra JS dependency (`web/src/live/auth.ts`). Participants never sign in.
- Organisations: owner / admin / creator / facilitator. Invites are accepted on first sign-in with the invited email. A creator can belong to many organisations and switch spaces.
- Isolation: RLS on every `pp` table via `pp.has_role`; workspace API wrappers are SECURITY INVOKER so RLS applies; audit trail for org actions.
- Drafts, template copies, libraries (personal and per organisation), immutable versions, session insights (anonymous totals).
- Publishing goes only through the `publish` Edge Function: it re-validates with the same schema as the app (sync enforced by a unit test) and is the only holder of the service key. Public Discover listing needs a review step (not built).
- Hosting an org/personal experience uses its latest published version (`pp_get_published`), never the draft.
- Tests: SQL 40 engine + 46 isolation + 9 grants locally and in CI. On production (inside a rolled-back transaction): 40 engine + 43 isolation + grant checks. 13 publish-function tests (local Deno). Browser: 34 live + 19 app + 33 workspace on a local Auth/REST/Function emulator, not yet against production Auth.
