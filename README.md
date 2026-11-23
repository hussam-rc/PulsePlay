# PulsePlay

*Bring people together. One game at a time.*

| What | Where | Status |
|---|---|---|
| **PulsePlay app** (Discover, live multiplayer for 3 games, Host Studio, Workspace with organisations) | https://hussam-rc.github.io/PulsePlay/app/ | Phase 1b |
| **Ego Check LIVE** (live rooms, QR join, phones as controllers) | https://hussam-rc.github.io/PulsePlay/ | Live |

Architecture, decisions and the phased backlog: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout
```
index.html, game-src.html, build.py   Ego Check LIVE (single-file app, live on Supabase)
app/                                  Built PulsePlay app, served by GitHub Pages (generated; do not edit)
web/                                  PulsePlay source: React + TypeScript + Vite + Tailwind
  src/engine/                         Pure-TS engine: schema v1, validation, scoring, session state machine
  src/experiences/                    Ego Check, Would You Rather?, Myth or Fact?
  src/pages/, src/ui/                 Screens and components
  tests/                              Unit tests (Vitest)
  e2e/                                Browser tests (Playwright for Python)
supabase/migrations/                  egocheck (legacy), pp live engine (0100/0110), workspaces & roles (0200/0210)
supabase/functions/publish/           Edge Function: server-side validation + versioned publish (holds the service key)
supabase/tests/                       SQL tests (engine, isolation, grants) + publish function test
.github/workflows/ci.yml              Type-check, unit tests, build on every push
```

## Develop
```bash
cd web
npm ci
npm run dev              # local dev server
npm test                 # unit tests (engine, scoring, privacy thresholds, timing)
npm run publish:pages    # build into ../app — commit the result to deploy
```
Browser tests: build, serve the repo root so the app sits at `/PulsePlay/app/` (for example by copying `index.html` and `app/` into `/tmp/site/PulsePlay/` and running `python3 -m http.server 4174` there), then run `npm run e2e`. They need `pip install playwright && playwright install chromium`.

## Backend
- Supabase project **`pulseplay`** (Pro, Frankfurt). The browser holds only the *publishable* key, which can call only the 8 `egocheck_*` functions. No secret keys anywhere in this repo.
- Live game state, deadlines and scoring are checked on the server. Names and answers are stored in unlinked tables, and rooms are deleted when the host ends them or after 24 hours.

## Deploy and roll back
GitHub Pages serves branch `main` from the repository root. To deploy, commit and push. To roll back, revert the commit and push.

A light-hearted reflection and engagement platform: not a psychological assessment or a performance tool.
