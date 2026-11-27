# Who is in Control? v2: final approval report

Status: **for your final approval. Draft, not published, scoring v2 not active.** PR #12 stays a draft until you approve.

## Decisions applied
- **Approved as proposed:** em7, cl8, sa9, hl4 and rc6. Their wording and scores are unchanged.
- **Revised:** em2 now separates *respectfully giving privacy* (0) from *ignoring someone in distress* (2).
- **Corrected:** sa3, fb4 and rc5. They described a judgement or a mood, not a reaction.
- **Re-audit of all 60:** 7 more answers had the same problem and were made observable: sa3 (a second answer), sa4, sa7, fb9, fb10, rc4, hl5 and hl6. A new test now blocks thought, decision or mood words in any answer worth 1–3 points.

## Changed questions: final answers and points
Answers are in authored order (open · assertive · self-protective · ego-driven); players see them shuffled.

| Id | Situation | Final answers and points |
|---|---|---|
| `em2` | A teammate is in tears after a tough meeting. | Quietly ask if they'd like company or some space **0**<br>Give them privacy, and check in later **0**<br>Look away and carry on as if nothing happened **2**<br>Tell them they took it too personally **3** |
| `sa3` | You snapped at someone in a stressful meeting. | Apologise to them in person afterwards **0**<br>Apologise, and mention the pressure you were under **1**<br>Say nothing and carry on **2**<br>Tell them they provoked it **3** |
| `fb4` | A client says your presentation was "too long". | Ask which part they'd happily skip **0**<br>Agree to shorten it, but keep the key data **0**<br>Explain that the topic needs that detail **1**<br>Tell colleagues the client didn't get it **3** |
| `rc5` | A colleague gets the exciting assignment you hoped for. | Offer to help them with it **0**<br>Tell your manager you'd like the next one **0**<br>Stop volunteering for new tasks for a while **2**<br>Hint that they're not quite ready for it **3** |
| `sa4` | You blamed a colleague for a delay, then realise it was yours. | Tell them, and say sorry for assuming **0**<br>Fix your part and mention the mix-up **0**<br>Fix it quietly, without clearing their name **2**<br>Say they could have reminded you **3** |
| `sa7` | One colleague irritates you every time they speak. | Talk to them to understand them better **0**<br>Stay professional and vent to a friend later **0**<br>Avoid working with them where you can **2**<br>Let a few sharp remarks slip in meetings **3** |
| `fb9` | Your manager says your idea "needs more thinking". | Agree on what to rework, and by when **0**<br>Say you think it's ready, and ask what's missing **0**<br>Drop the idea without asking more **1**<br>Ask another manager to approve it instead **2** |
| `fb10` | A peer gives you feedback that feels unfair. | Find out what they saw that led them there **0**<br>Say you see it differently, and why **0**<br>Thank them, then change nothing **1**<br>Tell others how unfair they are **3** |
| `rc4` | You're praised in public for a team effort. | Name the people who made it work **0**<br>Thank them, and call it a team effort **0**<br>Accept the praise without mentioning the team **1**<br>Add details about the parts you did **2** |
| `hl5` | A peer suggests a training course for you. | Ask which one helped them most **0**<br>Look into it, despite your experience **0**<br>Say you're too busy right now **1**<br>Say you could teach that course **3** |
| `hl6` | You're the most senior person, and the team disagrees with you. | Find out what they see that you don't **0**<br>Explain your reasons, then listen **0**<br>Let them try, but offer no help **2**<br>Remind them who has the most experience **3** |

## Reasons
| Id | Before | Why it changed |
|---|---|---|
| em2 | "Tell them it happens to everyone" **1** · "Look away and get back to your work" **1** · "…too personally" **2** | Privacy with a check-in is now its own 0-point answer. Ignoring someone in distress is self-protective avoidance (**2**). Telling them they took it too personally dismisses their feelings, which scores **3** to match em3 ("overreacting") and em5 ("not a great idea anyway"). The minimising answer was dropped to keep four distinct reactions. |
| sa3 | "Decide they provoked it" · "Act normal and hope it's forgotten" | "Decide" is a judgement in the head; "hope" is a wish. Both are replaced by what you say or do. |
| fb4 | "Decide they just didn't get it" | A judgement → saying it to colleagues, which is observable. |
| rc5 | "Lose interest in your own tasks for a while" | A mood → withdrawing effort. Scored **2**, consistent with fb3 ("Stop sharing ideas for a while"). |
| sa4 | "Fix it quietly and hope nobody noticed" | A wish → the observable consequence: the colleague keeps the blame. |
| sa7 | "Work out what exactly sets you off" (0) | An internal process → a conversation. |
| fb9 | "Hear it as a polite no and drop it" | An interpretation → the action only. |
| fb10 | "Thank them, then forget about it" | Forgetting is not observable → "change nothing". |
| rc4 | "Just enjoy it; correcting people is awkward" | A feeling and a justification → the action. |
| hl5 | "…even though you feel experienced" (0) | Removes "feel"; the meaning is unchanged. |
| hl6 | "Let them try, and wait for it to fail" | An intention → withholding help. |

Points changed only for em2. Every other change is wording with the same points.

## Translations
- **German, French and Arabic were updated for every change above** and all stay **draft**. The review packages were rebuilt (`docs/review/`). No reviewer names or approvals have been added.
- **Arabic:**
  - "الأنا" is now always grammatically masculine; two new strings that used the feminine were corrected.
  - Player-facing adjectives are gender-neutral: «تحدثت بحدّة», «أحافظ على المهنية», «ألتزم الحياد», «أقول بابتسامة», «رغم خبرتي».
  - The result titles "ممسك/ممسكون" became «المقود بين يديك/أيدينا».
- **French:** the player-facing adjectives in fb3 and rc1 were made neutral ("ça me déçoit", "Ça fait plaisir").

## Remaining ambiguities for you or the reviewers
1. **Arabic second person.** Prompts address the player in the masculine generic, because Arabic has no neutral "you". Colleagues alternate between female and male across questions, consistently within each question, as in German and French. Native reviewers should confirm this convention.
2. **Wording in 0-point answers.** A few 0-point answers state a view or a feeling out loud: em1 "Tell them calmly it didn't feel good", fb9 "Say you think it's ready". I kept them because they are spoken, observable and unpenalised.
3. **sa4 ("without clearing their name") at 2.** It could be argued as 3, because the colleague keeps the blame. I kept 2 because it is passive, not an active move against them.
4. **rc4 ("Add details about the parts you did") at 2.** This is the highest option in that question, so rc4 has no ego-driven answer (one of the 12 questions without one).
5. **em2 now reaches 3.** The number of questions whose top score is 2 drops from 13 to 12.

## Scoring and test results
- **Scoring formula unchanged** (Σ points ÷ Σ maximum of the questions answered). The simulation after these corrections, over 1,000 selections per pattern:
  - Healthy confidence ≈ 1.
  - Realistic mix ≈ 22: 🧘 64–71%, 😎 29–35%.
  - Defensive ≈ 58.
  - Strongly ego-driven 99.
  - **0 incoherent feedback results** in 30 pattern × length combinations.
  - The weak spot is unchanged: a defensive pattern in feedback and collaboration is found 42% of the time at 10 questions and 84% at 20.
- **Score wording** (all four languages): *"A game-based reflection score for this round only… It does not measure your ego or personality."*
- **Question maximum vs feedback level:** a new test runs on the real bank. On each of the 12 questions whose top score is 2, the worst answer earns 100% of that question's points, is read as self-protective (level 2), and never as a single ego-driven situation.
- **Unit tests:** 144/144 (3 new: observable answers only, the em2 privacy distinction, and the scale-separation test above).
- **SQL:** 180/180 checks in 10 suites on a fresh database, including published-version immutability, scoring-version tagging, and the existing live-engine and privacy suites.
- **Browser:** all 11 suites passed against the local test environment (e2e, release 2A/2B, creator C1, feedback, live multiplayer, resilience, results, i18n, workspace, release 3A).
- **Historical versions:** v1 games score exactly as before (a unit test covers this). Summaries of v2 rooms would be tagged `scoring_version = 2` by the planned migration, which is not applied.

## Not changed (needs separate approval)
- Publishing the 60-question bank.
- Activating scoring v2.
- Deploying the scoring migration or the Edge Functions.
