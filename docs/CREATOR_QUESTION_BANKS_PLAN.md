# Creator Studio: question banks (Release 3.0C plan)

Status: **plan.** It builds on what already exists. Nothing here is built yet.

## Already in place (reused, not rebuilt)
| Piece | Where | Used for |
|---|---|---|
| Generic bank engine: fixed / random / balanced by category or dimension, required, archived, fixed-only, recent-question avoidance | `web/src/engine/bank.ts`, `pp._bank_*` (live since 3.0A) | Preview, solo play and live rooms. No game-specific rules. |
| Bank fields in the schema | `bank`, per question `category` `dimension` `difficulty` `tags` `active` `random` `required` `rev` | Already accepted by the publish function (redeployed in 3.0A) |
| Validation and warnings | `validateExperience`: lengths, required overflow, missing categories, too few questions | Publish gate (server) and inline checks (editor) |
| Editor with question list, duplicate/delete/move, phone preview, checker | `web/src/builder/*` (C1, C2) | Extended, not replaced |
| Immutable versions + locked session snapshots | `pp.experience_versions`, `sessions_locked` trigger | Every publish is a new version; running rooms are never affected |
| Language packs with parity checks and review status | `web/src/experiences/drafts/translate.ts` pattern (3.0B) | Generalised for creator content in C3e |

## Slices (small PRs, each shippable)
| Slice | What the creator gets | Tests | Risk |
|---|---|---|---|
| **C3a: Bank basics in the editor** | A category (or dimension) field per question with suggestions from existing ones. **Archive** instead of delete for published questions (keeps ids stable). Filter the list by category. Bulk "duplicate as new question". | unit: ids stable after archive or reorder; browser: add / edit / duplicate / archive / filter on 375 px and desktop | Low |
| **C3b: Overview card** | "Leadership Quiz · 48 questions · 6 categories · 2 languages · supports 10, 15 and 20-question games". It shows warnings in plain words ("Only 12 questions in *History*: balanced 20-question games will repeat other categories more") and per-category counts. | unit: counts match the engine; browser: warnings appear and clear | Low |
| **C3c: Game lengths and selection settings** | Choose supported lengths (10 / 15 / 20; only those the bank can fill are enabled) and a default, plus the selection mode (fixed, random, balanced by category). Questions can be marked **required** or **not in random games**. Scoring values per answer stay where they are. | unit + SQL: server refuses what the editor would refuse; browser | Low |
| **C3d: Preview random selections** | "Show me 3 sample games" for any length: lists the questions each sample would pick, the category balance, and the estimated duration for the host's default timing. Samples are reproducible (seeded) so the creator can compare. | unit: preview uses the same engine as live; browser | Low |
| **C3e: Publish flow and versions** | Publishing shows exactly what changes (added / edited / archived questions, length settings) and creates a new immutable version. A version list shows "v3 · 26 Nov · 48 questions". Rooms already running keep their version. | SQL: version immutability, org isolation; browser: publish → host → confirm the room uses the new version | Medium (touches publishing) |
| **C3f: Bank templates** | Reusable starting banks: **Trivia** (categories + difficulty), **Team reflection** (dimensions, 4-level answers, scoring rubric explained in the editor), **Would you rather** (random only). Copy a template into your workspace and extend it. | unit: every template validates and plays at each supported length | Low |
| **C3g: Translations for creator banks** | Add a language to a bank. The editor shows untranslated questions; a language publishes only when complete. Optional reviewer field. | unit: parity (ids, points); browser: incomplete language cannot be published | Medium |

The five-minute target (create → customise → preview → save → publish → host) gets a **timed usability test** with first-time creators after C3c and again after C3e. I'll report the measured times, not an estimate.

## Rules that stay fixed
- **The engine stays generic.** Strategies only use `category` or `dimension`. No experience-specific code paths.
- **Questions are never padded.** Lengths that can't be filled from eligible questions are disabled with a reason.
- **IDs stay stable.** Editing keeps a question's id and raises `rev`, archiving hides it from future selections, and nothing that a past version or snapshot references is ever deleted.
- **Org isolation and privacy:** banks follow the existing workspace RLS. Recent-question history stays per host and never per participant.

## Open questions for later
1. Should creators be able to set **difficulty balancing** (e.g. 40% easy / 40% medium / 20% hard) in addition to categories? The engine would need a second balancing key. I recommend deferring until a trivia creator asks for it.
2. **Import from a spreadsheet** (CSV with prompt, answers, points, category) would speed up large banks. It's a good candidate for C3h once C3a–C3e are stable.
