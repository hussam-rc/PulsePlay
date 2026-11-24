# PulsePlay 2.0 — Product Excellence Report

Status: 24 Nov 2026. Audit of commit `c9b5902` (production bundle `index-DbPmcMKO.js`).

**How this was audited.** I read the source of all routes, pages, the engine, the live controllers, the migrations and the CI workflow. I took screenshots of the same build at 375×812 and 1280×800 in headless Chromium against the local Supabase emulator. I also opened production in a real browser on your machine to confirm the live bundle and its load (0.47 s to DOMContentLoaded, 161 KB transferred). **Not tested:** real iOS/Android devices, Safari, Firefox, screen readers, projectors and slow 3G. Scores below are based on observed evidence unless marked *(assumption)*.

## 1. Scores (1–10)

| # | Dimension | Score | Evidence |
|---|---|---|---|
| 1 | First impression | 5 | Clear headline, but the hero offers no action. There is no room-code field and no "create" entry. On mobile, the "In development" list (9 items) is taller than the playable catalogue (3 items). |
| 2 | Visual design | 6 | Coherent palette, type and cards. Emoji are the only visual identity. Cards use three near-identical gradients. |
| 3 | Navigation & IA | 5 | On mobile the main nav is five unlabeled icons (🔭 📱 🛠️ 🎤 🗂️). "Play", "Host" and "Discover" all list the same three games with different actions. |
| 4 | Discoverability | 4 | Filtering is by internal categories ("Personal reflection") and keyword only. There is no purpose, duration or group-size filter. The card says "10 questions" instead of what people actually do. The only action on a card is "Open". |
| 5 | Mobile experience | 7 | Join form is large, code-first and clear. Practice and lobby fit 375px. Long lists and the icon-only nav reduce the score. |
| 6 | Gameplay quality | 7 | Server-timed phases, pause/resume, private results, kept-on-phone results and 4 languages for the flagship. All three games use the same multiple-choice mechanic. |
| 7 | Presenter experience | 7 | QR, big code, live count, keyboard shortcuts, end confirmation, recovery after refresh (tested in `resilience.py`). The host setup is a plain form. There are no presentation themes. |
| 8 | Creator experience | 6 | The builder is fully no-code, with a plain-language checker, preview and publishing. Create explains the flow, but you must sign in before seeing anything. There are no templates by goal and no preview of what the builder looks like. |
| 9 | Accessibility | 6 | Focus rings, reduced motion, `lang`/`dir`, 48px targets. Icon-only nav relies on `sr-only` labels. No screen-reader test was done. Contrast of grey text on cream is borderline *(assumption — not measured)*. |
| 10 | Reliability & privacy | 8 | Server-authoritative, unlinked identity/answers, group minimum enforced server-side, RLS isolation tests, no secrets in the bundle (checked on every publish). Gaps: no client error monitoring, expired rooms purged only when a new room is created, browser tests not in CI, and the legacy `egocheck` backend is still live. |

## 2. The 15 most valuable improvements

Complexity S/M/L · Risk L/M/H · Priority P1 (now) to P3.

| # | Problem (evidence) | Solution | User benefit | Cx | Dependencies | Risk | Pri |
|---|---|---|---|---|---|---|---|
| 1 | Hero has no action; joining needs a second click to "Play" | Hero with **Explore**, **Create your own** and an inline **room-code** field | First-time visitors and players act in one step | S | — | L | P1 |
| 2 | Discovery by internal category only | **"What do you want to make happen?"**: 8 purpose tiles driven by catalogue metadata; empty purposes say so honestly | Hosts find a fit by intent (User A) | S | catalogue metadata | L | P1 |
| 3 | Cards don't say what people do; one "Open" action | Cards show *what you'll do*, format, duration, group size, Live/Solo badges, and direct **Host · Try it · Play solo** actions (only for supported modes) | Fewer clicks, clearer choice | S | — | L | P1 |
| 4 | Roadmap list dominates mobile Discover | Collapse into one compact "Coming next" disclosure | Catalogue first; no fake availability | S | — | L | P1 |
| 5 | Mobile nav is 5 unlabeled icons | Labeled bottom tab bar on phones; top nav on desktop | Navigation is understandable without guessing | S | layout test update | L | P1 |
| 6 | Detail page lists facts, not the experience | "How it works" in 3 steps, a **sample question**, modes explained, practice button fixed (wraps at 1280px) | Hosts know what participants will see before starting | S | — | L | P1 |
| 7 | One 474 KB JS bundle (153 KB gzip) loads builder, workspace and reports for every player | Route-level code splitting | Faster first load on phones joining a room | S | — | L | P1 |
| 8 | Small copy bugs (e.g. "counts.." double period on host setup) | Fix and add a test for doubled punctuation in all locales | Polish, trust | S | — | L | P1 |
| 9 | No guided choice for first-time hosts | **Find Your Perfect Experience** concierge: 4 questions, deterministic scoring with reasons, AI-ready interface | User A gets a recommendation in under 30 s | M | #2 metadata | L | P2 (2.0B) |
| 10 | Three games, one mechanic | Extend the engine with **Quick vote + prediction**, **Word cloud** (moderated) and **Ranking** as activity types with aggregation and reveal components | Real variety, not reskins | L | schema v1 additive, server aggregation, moderation for text | M | P2 |
| 11 | Same result screen pattern everywhere | Reveal components per result kind: reflection card, quiz scoreboard, opinion split with discussion prompts | Memorable endings | M | #10 | L | P2 |
| 12 | Builder starts empty and needs sign-in to look around | **Templates by goal** plus a no-account builder preview; sign-in only to save/publish | Creator activation (User C) | M | builder | L | P2 |
| 13 | No presentation themes | Professional / Playful / Party themes as design tokens on presenter and phone | Fits corporate, school and party contexts | M | token refactor | L | P3 |
| 14 | Ops gaps: no error monitoring, lazy room purge, browser tests not in CI | Privacy-safe client error log RPC (no IP, no content), scheduled purge (pg_cron), Playwright job in CI | Problems found before users report them | M | **approval: new scheduled job in prod** | M | P2 |
| 15 | Legacy `egocheck` schema and 8 public RPCs still live; no longer linked from the app | Retire after a 14-day watch window | Smaller attack surface | S | **approval: destructive** (drop schema; rollback = re-run `20261123_ego_check.sql`) | M | P2 |

Signature experiences (Impossible Mission, Time Capsule, Appreciation Wall) depend on #10 and on free-text moderation. They belong in 2.0D, starting with the Appreciation Wall, because it reuses word cloud and moderation and carries the lowest risk.

## 3. Design direction

**Principle:** every screen has one job and one primary button. Purpose first, catalogue second, machinery hidden.

- **Discover:** compact hero (headline, one sentence, Explore / Create / inline code), purpose tiles, filterable grid (search + purpose; duration and group size behind "More filters"), honest "Coming next" disclosure. Collections appear only when at least 3 games match their metadata.
- **Experience detail:** title, tagline, the primary action for its best mode, "How it works" (3 steps), sample question rendered as a phone, facts, privacy box, facilitator guide.
- **Host Studio:** Choose → Configure (defaults visible, advanced folded) → Lobby (QR, short URL, code, counter, names, Start) → Facilitate (question, progress, countdowns, response count, pause/next/end) → Celebrate (result reveal + "play another", "save", "insights").
- **Participant mobile:** Scan → nickname → join; one question per screen, thumb-zone answers, clear "answer saved" feedback, friendly reconnect and expired-room screens (exists; keep).
- **Personal results:** private card with an interpretation, one habit and one challenge, copy/delete (exists); add share-safe takeaway text.
- **Collective results:** kind-specific reveal; reflection = anonymous average + distribution ≥10; opinions = split + discussion prompt; quiz = optional nickname board.
- **Create Studio:** three entries (Scratch / Template / Describe your idea → AI draft); editor = outline left, live phone preview right, checker inline (exists in part).
- **Design system:** keep current tokens (ink, paper, violet, sky, teal, sun, coral), and add a `purpose` colour per tile, semantic button hierarchy (primary/ghost/link) and motion tokens (≤400 ms, reduced-motion off).

## 4. Technical plan

**Reuse as is:** pure TS engine and zod schema, server-authoritative `pp` RPCs, unlinked identity/answer model, RLS + isolation tests, publish/draft/AI Edge Functions, i18n layer, live controllers with Realtime ticks + polling fallback, the Playwright suites.

**Improve:**
- **Catalogue metadata** separate from game content (`experiences/catalog.ts`): purposes, format, "what you'll do", audiences. Frontend-only now; moves into `pp.experiences` columns when community publishing needs it. This avoids a schema bump for discovery.
- **Code splitting** by route (React.lazy) to keep player routes light.
- **Engine extension** for new activity types: additive union members with a server aggregation function per type. Unknown types are already ignored at play time.
- **Ops:** error RPC + scheduled purge + Playwright in CI (approval needed for the prod scheduled job).

## 5. Release 2.0A — this slice

Items 1–8 above. All are frontend-only, with no database or privacy change. Items 9–15 follow in 2.0B/C; #14 and #15 need your approval before touching production.

## 6. Release 2.0A — delivered (24 Nov)

| Item | Change | Evidence |
|---|---|---|
| 1 | Hero: new headline, Explore / Create your own, inline room-code join with inline error | `e2e/release_2a.py` |
| 2 | 8 purpose tiles from `experiences/catalog.ts`; tiles show "n ready to play" or "Build your own"; empty goals lead to Create | same |
| 3 | Cards: format, what you'll do, duration, players, live, scores vs no winners, languages; Host / Try it / Play solo only where supported | same |
| 4 | Roadmap folded into "Coming next" (closed by default) | same |
| 5 | Phones: labelled bottom tab bar; desktop keeps the top nav | same + `feedback2.py` |
| 6 | Detail: what you'll do, primary actions, "How it works", sample question on a phone mock-up, practice as a secondary link | same |
| 7 | Code splitting + QR and zod moved off the player path: main JS **153.2 → 113.8 KB gzip (−26%)**, measured with `vite build` | build output |
| 8 | "counts.." fixed; new test blocks doubled punctuation in all 4 languages | `tests/i18n.test.ts` |
| — | Filters (time, group size, saved) behind "More filters"; panel no longer closes itself (bug found by the new test) | `release_2a.py` |
| — | axe-core: no serious/critical issues on Discover, Detail, Play, Join (desktop) | `release_2a.py` |

All new UI strings exist in EN/DE/FR/AR. Tests: unit 47/47; browser: release_2a 31/31, e2e (0 fails), feedback2 21/21, live_multiplayer 34/34, workspace 59/59, resilience 5/5, results_keep 7/7, i18n 7/7 — on the local emulator, Chromium only. Not tested: real phones, Safari/Firefox, screen readers.

**Next (2.0B):** Experience Concierge (#9), kind-specific reveals (#11), Playwright in CI. **Needs your approval:** #14 scheduled purge job and #15 retiring the legacy `egocheck` backend.
