# Who is in Control? v2: content-quality report (English master)

Status: **review complete, bank revised, not published.** The full revised bank is in `docs/EGO_BANK_REVIEW.md`. Metrics come from `web/scripts/quality-ego-bank.ts`; the rules are enforced by `web/tests/egoBank.test.ts`.

## Method
I reviewed every question against your ten criteria:
1. realistic situation
2. short, clear wording
3. four believable answers
4. defensible scoring order
5. healthy confidence not penalised
6. respectful disagreement not treated as ego
7. normal emotions not treated as problems
8. cultural and language fit
9. a distinct contribution to the bank
10. no answer obviously "the moral one"

I then measured the patterns a player could use to guess the scoring without reading the situation.

## The distinction used for scoring
| Level | What it is | Typical forms | Never scored here |
|---|---|---|---|
| 0 | Open, curious | explores, invites, credits others, regulates in the moment | |
| 1 | **Healthy confidence** | states own view, disagrees respectfully, names a feeling, asks for fair credit or process, sets a boundary | |
| 2 | **Self-protection** | justifies first, deflects, scorekeeps, withdraws effort, works around | feelings themselves |
| 3 | **Ego takes the wheel** | wins, dismisses, retaliates, claims credit, overrides others | legitimate escalation, accountable decisions |

## Systemic findings (first draft → revised)
| Finding | First draft | Revised | Why it matters |
|---|---|---|---|
| 0-point answers starting with "Ask…" | 26 of 60 (43%) | 9 (15%) | The best answer could be spotted by its first word. "Ask" now also opens confident, self-protective and ego answers. |
| Most common opening word, any level | 43% | ≤ 15% | Same giveaway, checked for every level. The test fails above 20%. |
| Feelings inside 2/3-point answers | 5 (`sa7`, `fb1`, `rc2`, `rc4`, `cl7`) | 0 | "Feel less motivated" or "feel left out" scored a feeling, contradicting the game's own promise. Every 2/3 answer now describes a behaviour. |
| Duplicate answers | 1 ("Ask privately how they're doing", `em4`/`em10`) | 0 | |
| Average answer length by level | 33–38 characters | 34–38 characters | Length gives no hint. The test fails if levels differ by more than 6 characters. |
| Grammar slips from contractions | 3 (`fb10`, `cl2`, `rc7`) | 0 | e.g. "how unfair they're", "thank you'd mean". |
| Healthy behaviour scored as ego | 3 (`sa10` escalation, `hl6` accountable decision, `sa8` "take it as a compliment") | 0 | Escalating a rating or deciding as the accountable lead are legitimate. Those questions were replaced or re-anchored. |
| Near-duplicate situations | 9 | 0 | Recognition had five "you weren't credited" variants. Self-awareness had three "someone tells you about a trait". `fb6`/`hl8` and `hl1`/`hl2` overlapped across dimensions. |

## What each dimension now covers (ten distinct situations each)
- **Self-awareness:**
  - being wrong mid-argument
  - interrupting
  - snapping under stress
  - a wrong assumption about a colleague
  - dominating airtime
  - a decision you pushed that failed
  - irritation with one person
  - over-optimistic estimates
  - needing to win a harmless debate
  - your voice rising
- **Feedback:**
  - your report rewritten
  - public correction
  - a proposal turned down
  - "too long"
  - surprise criticism in a review
  - intent vs. impact (email read as rude)
  - rude delivery of useful feedback
  - your manager challenging you in front of a client
  - "needs more thinking"
  - feedback that feels unfair
- **Recognition:**
  - your idea taken
  - a colleague singled out
  - a promotion
  - receiving praise for a team effort
  - a coveted assignment
  - status (missing title)
  - unthanked effort
  - client praise routed to your manager
  - someone else presenting
  - being left out of a meeting
- **Collaboration:**
  - the team picks another approach
  - a different method
  - handover
  - someone else leads
  - a slower learner
  - a co-lead
  - a decision while you're away
  - a slow process
  - a client taken over
  - your work edited without asking
- **Humility:**
  - an intern teaches you
  - a tool everyone knows but you
  - someone better at your signature skill
  - not knowing the answer
  - a training suggestion
  - seniority vs. team view
  - "basic" questions
  - a junior catches your mistake
  - a non-expert challenge
  - your tool replaced
- **Empathy:**
  - someone snaps at you
  - a colleague in tears
  - an angry client
  - a struggling colleague
  - a rejected idea
  - a second-language speaker
  - a conflict between others
  - a personal problem shared
  - a stressed manager
  - good news on your bad day

All ten situations from your brief are covered: credit taken (`rc1`), manager disagrees (`fb8`), public correction (`fb2`), younger person teaches you (`hl1`), proposal rejected (`fb3`), someone else recognised (`rc2`), assumption wrong (`sa4`), team chooses another approach (`cl1`), unexpected criticism (`fb5`), someone better at what you value (`hl3`).

## Question dispositions
**Kept unchanged (12):** `cl3` `cl4` `cl5` `hl1` `hl3` `hl4` `hl7` `hl8` `hl10` `em3` `em5` `em7`

**Replaced with a new situation (13)**
| Id | Was | Now | Reason |
|---|---|---|---|
| sa4 | "Hard to approach" survey | Blamed a colleague, then realised the delay was yours | Third "trait feedback" item; now covers a wrong assumption |
| sa8 | Asked why you always lead | Two days became two weeks | 3-point "take it as a compliment" wasn't ego; now covers overconfidence |
| sa9 | Friend jokes you never admit you're wrong | Needing to win a harmless lunch debate | Duplicated `sa1`; adds light humour |
| sa10 | Rating lower than expected | Your voice getting louder | Escalation was scored as ego; now covers in-the-moment regulation |
| fb6 | Junior points out a flaw | Email read as rude | Duplicated `hl8`; adds intent vs. impact |
| fb8 | Comments on every page | Manager challenges you in front of a client | Duplicated `fb1`; covers "your manager disagrees with you" |
| rc4 | Nobody mentions your part | Praised in public for a team effort | Fourth "uncredited" variant; now about receiving praise |
| rc5 | Praised for what you do weekly | Someone gets the exciting assignment | Fifth "uncredited" variant |
| rc6 | Fewer reactions on your post | Your title left off the programme | Social media fits work poorly; covers status |
| cl8 | Team wants a worse tool | Following a process you think is slow | Duplicated `cl1` |
| cl10 | Idea merged in a brainstorm | Your work edited without asking | Ownership instead of another "team picks" item |
| hl2 | Someone younger explains a topic | Everyone knows the new tool but you | Duplicated `hl1` |
| em10 | Teammate quiet for a week | Good news on your bad day | Same answer as `em4`; covers your own emotions without penalising a bad mood |

**Revised wording or anchors (35):** the remaining questions. The main patterns:
- **Feeling to behaviour** (`fb1`, `rc2`, `cl7`, `sa7`): "feel less motivated" became "put less into the next one".
- **Varied 0-point openings** (19 questions): "Ask what…" became "Find out…", "Compare…", "Pause and invite…", "Catch up on…".
- **Re-anchored 2/3 answers:**
  - `hl6`: "decide anyway; you're accountable" became "remind them who has the most experience"
  - `rc7`: "decide not to stay late again", a legitimate boundary, became "stay late again, but make sure people see it"
  - `cl9` and `fb10`: wording clarified
- **Self-protection made more believable:** "Fix it, and start checking their numbers too", "Nod, then explain why it happened", "Ask the client to copy you next time".

## Judgement calls for your review
These are the items where reasonable people may rank the answers differently:
1. **`em2` (colleague in tears):** across cultures, offering space can be the respectful choice. The 0-point answer now offers "a chat, a coffee or some space", so it doesn't impose one. Please confirm this works in Swiss and MENA contexts.
2. **`em7` (both colleagues complain to you):** "Stay neutral and keep out of it" is scored 1. In some workplaces it would be the best answer.
3. **`cl8` (slow process):** "Follow it, and ask why it's needed" is scored 1. Asking why could also be a 0.
4. **`sa9` (lunch debate):** "Laugh and give them the point" is scored 0. In a debate where you are right, it could also read as conflict-avoidant.
5. **`hl4` (bluffing a client):** "Answer confidently anyway" is scored 3. It's harsh but defensible: it puts looking competent above being accurate.
6. **`rc6` (missing title):** "Ask the organisers to add it" is scored 1, as fair recognition. Some may see any title concern as ego. I kept it at 1 to protect healthy self-advocacy.

## Validation after revision
- Structure: 60 questions, 10 per dimension, exactly one answer per level, and all three game lengths available.
- Phone limits: prompts at most 71 characters, answers at most 55.
- 11 automated content rules pass, including the four new guards against giveaways.
- Scoring simulation: re-run on the revised bank in `docs/EGO_BANK_SIMULATION.md`.
