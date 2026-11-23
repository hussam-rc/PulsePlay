# PulsePlay — Ego Check LIVE 🪞🚗

A presenter-led team reflection game for Remotecoders: *Who's driving today — you or your ego?*

**Play:** https://hussam-rc.github.io/PulsePlay/

- 🎤 **Host a Game** on the projector, 📱 **join** by QR code (no account), 🧪 **Demo Mode** works offline.
- Answers stay private: names (lobby) and answers are stored in unlinked tables; the projector only shows counts and an anonymous team average (5+ finished players).
- Server-checked timers, duplicate/late answers rejected, phones can reconnect after a refresh.
- Rooms are deleted when the host ends the game, or after 24 hours.

## How it's built
- `index.html` — the whole app (built from `game-src.html` by `python3 build.py <SUPABASE_URL> <PUBLISHABLE_KEY>`).
- `supabase/migrations/` — database: everything in schema `egocheck`, plus 8 `public.egocheck_*` API functions. Removal instructions are at the end of the file.
- The publishable key in `index.html` is meant to be public; it can only call the 8 game functions.

A light-hearted reflection activity — not a validated assessment or a performance tool.
