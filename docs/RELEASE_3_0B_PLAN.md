# Release 3.0B plan: Who is in Control? with 60 questions

Status: **English bank drafted for review** (`docs/EGO_BANK_REVIEW.md`, simulation in `docs/EGO_BANK_SIMULATION.md`). Nothing here changes production. Content and scoring changes ship as new immutable versions after review.

## Decisions so far (26 Nov)
- **Approved:**
  - the 60-question bank across six dimensions
  - the tone direction
  - EN first, then DE / FR / AR via versioned publishing
- **Score:** keep the 0–100 score as an anonymous **Ego Driving Score**, labelled as a game-based reflection score, not a psychological measurement. Results presentation becomes configurable (below).
- **Not yet approved:** the final question wording and the scoring rubric, which need review before publishing. Production scoring stays unchanged until the revised model is tested and approved.

## 1. What the 25 Nov game tells us (44 joined, 43 completed, average 9/100)

| Fact (current 10 questions) | Value |
|---|---|
| Expected score if people answered at random | 41/100 |
| Zero-point options per question | 2 of 4, every question |
| Points behind a 9/100 average | ≈ 2.7 of 30, i.e. about one non-zero pick per person |

Reading: people chose a zero-point option on roughly 9 of 10 questions. The 3-point options are caricatures ("I launch a 12-slide counter-presentation"), and two of four answers are visibly the "right" ones. That makes the socially desirable answer easy to spot. This is a **question-design effect**. It is not evidence that the team is low-ego, nor that anyone answered dishonestly. We should not "fix" it by moving band thresholds.

## 2. Dimensions (ids are tags in the question bank)

| Id | Dimension | 10 questions on |
|---|---|---|
| `self-awareness` | Self-awareness | noticing your own reactions, being wrong, blind spots |
| `feedback` | Feedback and criticism | public correction, unexpected criticism, rejected proposals |
| `recognition` | Recognition and validation | credit taken, others praised, being overlooked |
| `collaboration` | Collaboration and control | team picks another approach, delegating, letting go |
| `humility` | Humility and learning | someone younger teaches you, someone better at what you value |
| `empathy` | Empathy and emotional reactions | a stressed colleague, a frustrated client, conflict in the team |

The bank config becomes `bank: { strategy: 'dimension', lengths: [10, 15, 20], defaultLength: 10 }`. The engine shipped in 3.0A then guarantees all six dimensions in every 10-, 15- or 20-question game, balanced to within one question.

## 3. Question and answer rubric

Every question has four **believable** options, one at each level:

| Points | Reaction | Example stance |
|---|---|---|
| 0 | Curious, open | asks, explores, credits others |
| 1 | Healthy self-regard | states own view respectfully, admits discomfort, asks for fair credit |
| 2 | Self-protective | justifies first, keeps score, quietly withdraws |
| 3 | Ego takes the wheel | dismisses, wins the argument, claims credit, retaliates |

Rules:
- Professional confidence, respectful disagreement and asking for fair recognition score **0 or 1, never 2–3**.
- No caricatures. If a 3-point option would make people laugh at it, rewrite it.
- Short prompts (≤ 90 characters EN) and options (≤ 70) for timed play on phones.
- Humour lives in the situation, not in mocking an answer.
- Each question has a stable id and `rev`; options keep stable ids, so scoring never depends on display order.

Six draft items to agree the tone before all 60 are written:

1. **feedback**: *Your manager rewrites half of your report before it goes out.*
   0 Ask what made the new version stronger · 1 Ask to discuss the bigger changes next time · 2 Accept it, but feel less motivated on the next one · 3 Point out the parts that were better before
2. **recognition**: *A colleague presents your idea in the meeting, without your name.*
   0 Build on it and add what you know · 1 Mention afterwards that you'd like to be included next time · 2 Note it, and share less early next time · 3 Say in the meeting that it was your idea
3. **humility**: *The new intern shows you a much faster way to do your daily task.*
   0 Ask them to show you more tricks · 1 Thank them and try it tomorrow · 2 Stick with your way, it works fine · 3 Explain why your way is actually safer
4. **collaboration**: *The team picks an approach you argued against.*
   0 Ask how you can help it succeed · 1 Note your concern once, then commit · 2 Do your part, but by the book only · 3 Keep a list of what goes wrong
5. **self-awareness**: *Halfway through an argument, you realise you were wrong.*
   0 Say so and thank them · 1 Admit it and move on quickly · 2 Shift to a smaller point you're right about · 3 Keep going, it's too late to back down
6. **empathy**: *A colleague snaps at you during a stressful deadline.*
   0 Ask later if they're OK · 1 Tell them calmly it didn't feel good · 2 Keep your distance for a few days · 3 Snap back, it's only fair

## 4. Scoring and results presentation (current model stays live until you approve a new one)

Configurable presentation (scoring version 2):

| Personal (own phone only) | Company (shared screen and report) |
|---|---|
| Friendly category + clear interpretation | Anonymous average **Ego Driving Score** |
| Two insights: a strength **and** the strongest growth area when any answer scored 3 | Group interpretation (category text) |
| Optional number (host setting, default on), labelled "game reflection score" | Number of completed participants |
| One practical reflection challenge | Privacy threshold (≥ 5 valid results; band breakdown ≥ 10) |
| | Never individual scores or rankings |

Versioning:
- Every snapshot and session summary records `scoring.version`.
- Reports show a version label and never average or compare across versions.
- v1 sessions stay v1.

Simulation finding (`docs/EGO_BANK_SIMULATION.md`):
- Fixed patterns land in the same category on any selection, at 10, 15 and 20 questions.
- Healthy confidence always lands in 😎.
- A realistic mix lands in the same category 78% / 85% / 89% of the time at 10 / 15 / 20 questions.
- A strong reflex in one area does not move the category. Today's insight rules then show two strengths and no growth line; the v2 rule above fixes that.

Earlier analysis:

Current model: points ÷ maximum of answered questions → 0–100 → four bands (0–25, 26–50, 51–75, 76–100); valid if ≥ 70% answered. It already works for any length and ignores unanswered questions.

Issues and proposals:
- **False precision.** A 0–100 number suggests a measurement. *Proposal:* players see their category and two dimension insights, not the number; the number stays internal for the band. Organisers see the anonymous band distribution (already privacy-thresholded), not a company "score".
- **Versioning.** The new content gets `scoring.version: 2` in every snapshot. Summaries record the version, and reports never average across versions.
- **Evaluation before release:** simulate response patterns on 1,000 random 10/15/20-question selections:
  - all open
  - healthy-assertive (all 1s)
  - all self-protective
  - uniform random
  - "realistic mixed"
  
  Check that each pattern lands in a stable band whatever questions were drawn (target: the same band in ≥ 95% of draws), and that healthy-assertive lands in "mostly in control". We report the distributions as they come out and don't move thresholds to raise averages.

Result categories (wording to be finalised in all 4 languages, encouraging, Arabic uses الأنا):
🧘 You're in the driver's seat! · 😎 You're mostly in control! · 🦙 Your ego is grabbing the wheel! · 👑 Your ego is driving!

## 5. Translation workflow

1. EN master reviewed and approved by you (tone, cultural fit, the six samples first).
2. DE, FR and AR written as native workplace language, not literal translation. Same question ids, same option ids, same points.
3. Automated checks block publishing an incomplete language. Every language must have:
   - all 60 ids
   - matching option ids and points
   - no empty strings
   - length limits met
   - الأنا, never الغرور
4. Native-speaker review per language, recorded as `reviewed: {lang, by, date}`. A language without a review stays unpublished.
5. Published as new immutable versions (EN v8, DE/FR/AR v4), applied the same way as the band 3 fix. Running and finished rooms are unaffected.

## 6. Order of work and approvals

| Step | Needs your approval |
|---|---|
| Agree tone on the six samples above | **Yes** |
| Write the 60 EN questions + simulation report | Review |
| Scoring v2 (hide number, versioned) | **Yes**, it changes what people see |
| DE / FR / AR + native review | Reviewer names |
| Publish new content versions to production | **Yes** |
