// DRAFT for review (Release 3.0B). Not registered in the catalogue and not published.
// "Who is in Control?" v2: a 60-question bank, 10 per dimension, balanced by dimension, 10 / 15 / 20 questions per game.
//
// Rubric (points describe the observable reaction, never the feeling; ties are allowed when two reactions are equally reasonable):
//   0  open or healthy assertive   curious, OR states own view, asks for fair credit, sets a boundary, stays neutral,
//                                  escalates openly, names a feeling. Open and assertive are equal, not ranked.
//   1  mild self-focus              explains before acknowledging, steps back a little. Not ego.
//   2  self-protective              justifies or deflects, keeps score, withdraws effort, works around people
//   3  ego-driven                   wins at others' expense, dismisses, retaliates, claims credit, overrides covertly
// Every question has at least one 0-point reaction; not every question needs a 3. Answers are authored in the order
// [open, assertive, self-protective, ego] and keep that order in every language (translations are keyed by position).
import type { Experience } from '../../engine/schema';

export const DIMENSIONS = ['self-awareness', 'feedback', 'recognition', 'collaboration', 'humility', 'empathy'] as const;
export type Dimension = typeof DIMENSIONS[number];

// Answer letters are mixed per question so no letter is "always the open one"; players also see their own shuffled order.
const ORDERS = [[0, 1, 2, 3], [2, 0, 3, 1], [1, 3, 0, 2], [3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1]];
let n = 0;
/** Letter order per question: AUTHORED[id][k] = authored position of answer letter 'abcd'[k]. Used by translations. */
export const AUTHORED: Record<string, number[]> = {};
/** q(id, dimension, prompt, four answers in authored order). Points come from POINTS (final review, 27 Nov). */
const q = (id: string, dimension: Dimension, prompt: string, texts: [string, string, string, string]) => {
  const order = ORDERS[n++ % ORDERS.length], pts = POINTS[id];
  if (!pts) throw new Error(`no points for ${id}`);
  AUTHORED[id] = order;
  return {
    id, type: 'choice' as const, theme: dimension, dimension, prompt, shuffle: true, rev: 2,
    options: order.map((ai, k) => ({ id: 'abcd'[k], text: texts[ai], points: pts[ai] })),
  };
};

/** Final scoring per question, in authored order. Ties mean "equally reasonable". See docs/EGO_BANK_FINAL_REVIEW.md. */
export const POINTS: Record<string, [number, number, number, number]> = {
  sa1: [0, 0, 2, 3], sa2: [0, 0, 2, 2], sa3: [0, 1, 2, 3], sa4: [0, 0, 2, 3], sa5: [0, 0, 1, 3],
  sa6: [0, 0, 1, 2], sa7: [0, 0, 2, 3], sa8: [0, 0, 2, 3], sa9: [0, 0, 2, 3], sa10: [0, 0, 2, 3],
  fb1: [0, 0, 2, 1], fb2: [0, 0, 2, 3], fb3: [0, 0, 2, 3], fb4: [0, 0, 1, 3], fb5: [0, 0, 1, 2],
  fb6: [0, 0, 1, 3], fb7: [0, 0, 2, 3], fb8: [0, 0, 2, 3], fb9: [0, 0, 1, 2], fb10: [0, 0, 1, 3],
  rc1: [0, 0, 2, 3], rc2: [0, 0, 2, 2], rc3: [0, 0, 2, 3], rc4: [0, 0, 1, 2], rc5: [0, 0, 2, 3],
  rc6: [0, 0, 2, 3], rc7: [0, 0, 2, 3], rc8: [0, 0, 0, 3], rc9: [0, 0, 2, 3], rc10: [0, 0, 3, 2],
  cl1: [0, 0, 2, 2], cl2: [0, 0, 2, 3], cl3: [0, 0, 2, 3], cl4: [0, 0, 1, 3], cl5: [0, 0, 1, 3],
  cl6: [0, 0, 2, 3], cl7: [0, 0, 2, 3], cl8: [0, 0, 2, 3], cl9: [0, 0, 1, 3], cl10: [0, 0, 2, 3],
  hl1: [0, 0, 1, 2], hl2: [0, 0, 2, 2], hl3: [0, 0, 2, 3], hl4: [0, 0, 2, 3], hl5: [0, 0, 1, 3],
  hl6: [0, 0, 2, 3], hl7: [0, 0, 2, 3], hl8: [0, 0, 1, 3], hl9: [0, 0, 2, 3], hl10: [0, 0, 2, 3],
  em1: [0, 0, 1, 3], em2: [0, 1, 1, 2], em3: [0, 0, 1, 3], em4: [0, 0, 1, 3], em5: [0, 0, 1, 3],
  em6: [0, 0, 1, 2], em7: [0, 0, 2, 3], em8: [0, 0, 1, 3], em9: [0, 0, 2, 3], em10: [0, 0, 1, 2],
};

export const BANK_EN = [
  // ---------- Self-awareness: noticing your own reactions as they happen ----------
  q('sa1', 'self-awareness', 'Halfway through an argument, you realise you were wrong.',
    ['Say so, and thank them for the push', 'Admit it briefly and move on', 'Switch to a smaller point you\'re right about', 'Keep arguing; backing down now would look weak']),
  q('sa2', 'self-awareness', 'A colleague says you interrupt a lot in meetings.',
    ['Ask for an example so you can catch yourself', 'Admit it surprises you, and watch for it', 'Point out that others interrupt too', 'Explain that you only interrupt to save time']),
  q('sa3', 'self-awareness', 'You snapped at someone in a stressful meeting.',
    ['Apologise to them in person afterwards', 'Apologise, and mention the pressure you were under', 'Act normal and hope it\'s forgotten', 'Decide they provoked it']),
  q('sa4', 'self-awareness', 'You blamed a colleague for a delay, then realise it was yours.',
    ['Tell them, and say sorry for assuming', 'Fix your part and mention the mix-up', 'Fix it quietly and hope nobody noticed', 'Say they could have reminded you']),
  q('sa5', 'self-awareness', 'You notice you\'ve done most of the talking in the meeting.',
    ['Pause and invite the quieter people in', 'Wrap up your point and pass the floor', 'Finish your full point first; it matters', 'Keep going; you know the topic best']),
  q('sa6', 'self-awareness', 'A decision you pushed for turns out badly.',
    ['Raise it in the review and share what you learned', 'Own your part when it comes up', 'Point to the factors nobody could foresee', 'Remind everyone the team agreed to it too']),
  q('sa7', 'self-awareness', 'One colleague irritates you every time they speak.',
    ['Work out what exactly sets you off', 'Stay professional and vent to a friend later', 'Avoid working with them where you can', 'Let a few sharp remarks slip in meetings']),
  q('sa8', 'self-awareness', 'You said two days. It\'s taking two weeks.',
    ['Flag it early and ask what to cut', 'Flag it, with a new realistic date', 'Work late and keep the old date', 'Blame the unclear requirements']),
  q('sa9', 'self-awareness', 'At lunch, you catch yourself needing to win a harmless debate.',
    ['Laugh and give them the point', 'Make your case once, then drop it', 'Bring it up again later in the day', 'Keep going until they give in']),
  q('sa10', 'self-awareness', 'In a tense meeting, you hear your voice getting louder.',
    ['Pause, breathe and slow down', 'Say: sorry, this topic matters to me', 'Keep going; it\'s just passion', 'Get louder until you\'re heard']),

  // ---------- Feedback and criticism: being corrected, challenged or turned down ----------
  q('fb1', 'feedback', 'Your manager rewrites half of your report before it goes out.',
    ['Compare the versions to see what improved', 'Ask to be involved in big changes next time', 'Let it go, and put less into the next one', 'Point out what was better in your version']),
  q('fb2', 'feedback', 'A colleague corrects your numbers in front of the whole team.',
    ['Thank them and fix it on the spot', 'Fix it, and ask for a private heads-up next time', 'Fix it, and start checking their numbers too', 'Correct something in their slides right back']),
  q('fb3', 'feedback', 'Your proposal is turned down with little explanation.',
    ['Find out what would make it work next time', 'Say you\'re disappointed, and ask for the reasons', 'Stop sharing ideas for a while', 'Get another manager to push it through, without telling them']),
  q('fb4', 'feedback', 'A client says your presentation was "too long".',
    ['Ask which part they\'d happily skip', 'Agree to shorten it, but keep the key data', 'Explain that the topic needs that detail', 'Decide they just didn\'t get it']),
  q('fb5', 'feedback', 'Your yearly review includes criticism you didn\'t see coming.',
    ['Write it down and ask for one example', 'Say it surprised you, and ask why it\'s only now', 'Nod, then explain why it happened', 'Argue each point until it\'s softened']),
  q('fb6', 'feedback', 'A colleague says your email came across as rude.',
    ['Ask which line landed badly', 'Say it wasn\'t meant that way, and rephrase', 'Explain what you actually meant', 'Tell them they\'re being too sensitive']),
  q('fb7', 'feedback', 'Useful feedback reaches you in a rude tone.',
    ['Take the useful part and leave the tone', 'Tell them the tone made it hard to hear', 'Dismiss all of it because of the tone', 'Reply in the same tone']),
  q('fb8', 'feedback', 'Your manager challenges your idea in front of a client.',
    ['Answer the question and note the concern', 'Answer, and suggest going deeper later', 'Answer, then go quiet for the rest of the call', 'Prove them wrong in front of the client']),
  q('fb9', 'feedback', 'Your manager says your idea "needs more thinking".',
    ['Agree on what to rework, and by when', 'Say you think it\'s ready, and ask what\'s missing', 'Hear it as a polite no and drop it', 'Ask another manager to approve it instead']),
  q('fb10', 'feedback', 'A peer gives you feedback that feels unfair.',
    ['Find out what they saw that led them there', 'Say you see it differently, and why', 'Thank them, then forget about it', 'Tell others how unfair they are']),

  // ---------- Recognition and validation: credit, status, being seen ----------
  q('rc1', 'recognition', 'A colleague presents your idea in a meeting without naming you.',
    ['Build on it and add what you know', 'Say with a smile: "Glad my idea is landing"', 'Share less with them from now on', 'Correct them sharply in front of everyone']),
  q('rc2', 'recognition', 'Your manager thanks the team but names only one colleague.',
    ['Congratulate that colleague too', 'Ask your manager later how they see your part', 'Do the minimum on the next shared task', 'Send a recap listing everything you did']),
  q('rc3', 'recognition', 'A newer colleague gets the promotion you wanted.',
    ['Congratulate them and learn what made the difference', 'Congratulate them, and ask your manager about your path', 'Congratulate them, then keep your distance', 'Point out how long you\'ve been here']),
  q('rc4', 'recognition', 'You\'re praised in public for a team effort.',
    ['Name the people who made it work', 'Thank them, and call it a team effort', 'Just enjoy it; correcting people is awkward', 'Add details about the parts you did']),
  q('rc5', 'recognition', 'A colleague gets the exciting assignment you hoped for.',
    ['Offer to help them with it', 'Tell your manager you\'d like the next one', 'Lose interest in your own tasks for a while', 'Hint that they\'re not quite ready for it']),
  q('rc6', 'recognition', 'The event programme lists everyone\'s title except yours.',
    ['Shrug; the talk is what counts', 'Ask the organisers to add it', 'Open your talk by listing your credentials', 'Threaten to pull out unless it\'s fixed']),
  q('rc7', 'recognition', 'You stayed late to help, and nobody says thank you.',
    ['Let it go; you helped because it mattered', 'Mention that a thank-you would mean a lot', 'Stay late again, but make sure people see it', 'Remind them how much you gave up']),
  q('rc8', 'recognition', 'A client praises your work, but writes only to your manager.',
    ['Be glad the client is happy', 'Ask your manager to forward it to you', 'Ask the client to copy you next time', 'Reply to all to say it was your work']),
  q('rc9', 'recognition', 'Someone else is chosen to present your team\'s project.',
    ['Help them prepare', 'Say you\'d like to present next time', 'Skip the rehearsal; they\'ve got it', 'Jump in during their talk to add your points']),
  q('rc10', 'recognition', 'Colleagues meet about your topic without inviting you.',
    ['Catch up on what came out of it', 'Ask to be included next time', 'Hold your own meeting on it, without them', 'Complain about it to the team']),

  // ---------- Collaboration and control: letting others shape the work ----------
  q('cl1', 'collaboration', 'The team picks an approach you argued against.',
    ['Look for how you can help it succeed', 'Note your concern once, then commit', 'Do your part, but strictly by the book', 'Keep a list of what goes wrong']),
  q('cl2', 'collaboration', 'A colleague does a task differently than you would.',
    ['Ask why they chose that way', 'Share your way as one option', 'Redo it later your way', 'Tell them to switch to your way']),
  q('cl3', 'collaboration', 'You\'re asked to hand over a project you started.',
    ['Write a clear handover and offer help', 'Ask to stay informed on big decisions', 'Hand it over, but keep the key contacts', 'Keep checking in and correcting their choices']),
  q('cl4', 'collaboration', 'In a group task, someone else takes the lead.',
    ['Support them and pick up a part', 'Offer your ideas, then follow their lead', 'Do your part and stay quiet', 'Steer the group back to your plan']),
  q('cl5', 'collaboration', 'A teammate asks for help with something you\'d do faster.',
    ['Show them how, step by step', 'Help, and agree on a quicker way next time', 'Do it for them to save time', 'Tell them they should know this by now']),
  q('cl6', 'collaboration', 'Your manager gives your project a co-lead.',
    ['Agree together how to split the work', 'Admit you\'re surprised, then plan together', 'Agree, but keep the important parts', 'Make sure everyone still sees you as the lead']),
  q('cl7', 'collaboration', 'A decision is made while you\'re on holiday.',
    ['Get the reasons and go with it', 'Share your view, then accept the decision', 'Go along, but keep mentioning you weren\'t asked', 'Quietly carry on your own way']),
  q('cl8', 'collaboration', 'You\'re asked to follow a process you think is slow.',
    ['Follow it and suggest improvements', 'Follow it, and ask why it\'s needed', 'Follow it only when someone is checking', 'Quietly skip it; your way is faster']),
  q('cl9', 'collaboration', 'A colleague takes over a client you used to handle.',
    ['Brief them on what works with that client', 'Offer help if questions come up', 'Wait for them to ask you', 'Keep contacting the client yourself']),
  q('cl10', 'collaboration', 'A teammate fixes something in your work without asking.',
    ['Thank them; it\'s better now', 'Thank them, and ask to be told next time', 'Go through all their other changes', 'Change it back']),

  // ---------- Humility and learning: not knowing, others knowing better ----------
  q('hl1', 'humility', 'The new intern shows you a much faster way to do a daily task.',
    ['Ask them to show you more tricks', 'Thank them and try it tomorrow', 'Stick with your way; it works', 'Explain why your way is actually safer']),
  q('hl2', 'humility', 'Everyone else already knows the new tool you have to use.',
    ['Book an hour with whoever knows it best', 'Learn it on your own, at your pace', 'Keep the old way wherever you can', 'Say the new tool is overrated']),
  q('hl3', 'humility', 'A colleague is clearly better at something you\'re known for.',
    ['Ask them how they do it', 'Admit it, and keep improving', 'Avoid tasks where they shine next to you', 'Point out where they still fall short']),
  q('hl4', 'humility', 'You don\'t know the answer to a client\'s question.',
    ['Say you\'ll find out and follow up', 'Share what you know and check the rest', 'Give a vague answer that sounds right', 'Answer confidently anyway']),
  q('hl5', 'humility', 'A peer suggests a training course for you.',
    ['Ask which one helped them most', 'Look into it, even though you feel experienced', 'Say you\'re too busy right now', 'Say you could teach that course']),
  q('hl6', 'humility', 'You\'re the most senior person, and the team disagrees with you.',
    ['Find out what they see that you don\'t', 'Explain your reasons, then listen', 'Let them try, and wait for it to fail', 'Remind them who has the most experience']),
  q('hl7', 'humility', 'A colleague asks a "basic" question in a meeting.',
    ['Answer kindly; others may wonder too', 'Answer briefly and continue', 'Answer, hinting they should know this', 'Sigh and say it was covered before']),
  q('hl8', 'humility', 'A junior colleague catches a mistake of yours.',
    ['Thank them in front of the team', 'Thank them privately and fix it', 'Fix it and say nothing', 'Explain why it wasn\'t really a mistake']),
  q('hl9', 'humility', 'Someone outside your field questions your expert opinion.',
    ['Find out what makes them think so', 'Explain your reasoning in simple words', 'Switch to jargon to show you know best', 'Dismiss it; they\'re not from the field']),
  q('hl10', 'humility', 'A tool you built is replaced by a better one.',
    ['Help the team switch', 'Share what you learned building yours', 'Keep pointing out what yours did better', 'Warn people the new one will fail']),

  // ---------- Empathy and emotional reactions: other people under pressure ----------
  q('em1', 'empathy', 'A colleague snaps at you during a stressful deadline.',
    ['Check later if they\'re OK', 'Tell them calmly it didn\'t feel good', 'Keep your distance for a few days', 'Snap back; it\'s only fair']),
  q('em2', 'empathy', 'A teammate is in tears after a tough meeting.',
    ['Quietly offer a chat, a coffee or some space', 'Tell them it happens to everyone', 'Look away and get back to your work', 'Tell them they took it too personally']),
  q('em3', 'empathy', 'A client is angry about a delay that wasn\'t your fault.',
    ['Acknowledge their frustration first', 'Explain the cause calmly, then offer options', 'Make clear it wasn\'t your team', 'Tell them they\'re overreacting']),
  q('em4', 'empathy', 'A colleague has been missing deadlines lately.',
    ['Ask if something is making it hard right now', 'Raise it with them kindly and directly', 'Work around them', 'Point it out in front of the team']),
  q('em5', 'empathy', 'A teammate is upset that their idea was rejected.',
    ['Ask what they liked most about it', 'Say you understand, and explain the decision', 'Change the subject', 'Say it wasn\'t a great idea anyway']),
  q('em6', 'empathy', 'A new colleague struggles to follow fast meetings in a second language.',
    ['Share a short summary with them afterwards', 'Slow down when they ask you to', 'Keep your pace; they\'ll catch up', 'Talk only to the people who follow']),
  q('em7', 'empathy', 'Two colleagues are in conflict, and both complain to you.',
    ['Listen to both and suggest they talk', 'Stay neutral and keep out of it', 'Agree with whoever you\'re talking to', 'Pass the story on to others']),
  q('em8', 'empathy', 'Someone shares a personal problem in a private meeting with you.',
    ['Listen and ask what would help', 'Listen, and share a similar experience', 'Give quick advice and move on', 'Turn the talk to your own problems']),
  q('em9', 'empathy', 'Your manager seems stressed and short with everyone.',
    ['Offer to take something off their plate', 'Keep your updates short today', 'Complain about their mood to colleagues', 'Push back sharply when they\'re short with you']),
  q('em10', 'empathy', 'A colleague shares great news while you\'re having a bad day.',
    ['Celebrate with them', 'Congratulate them, and say you\'re a bit flat today', 'Say "nice" and change the subject', 'Turn it into how hard your week has been']),
];

export const INSIGHTS_EN: NonNullable<Experience['insights']> = {
  themes: {
    'self-awareness': { label: 'Self-awareness', strength: 'You notice your own reactions and own them.', growth: 'Your own patterns can be hard to spot in the moment.', habit: 'After a tense moment, ask yourself: what did I just protect?', challenge: 'Next time you get something wrong, acknowledge it without immediately explaining it.' },
    feedback: { label: 'Feedback', strength: 'You take criticism without getting defensive, and say it when you see things differently.', growth: 'Criticism can switch you into defending quickly.', habit: 'When feedback comes, ask one question before you answer.', challenge: 'Ask one more question before you defend your opinion.' },
    recognition: { label: 'Recognition', strength: 'You share credit generously, and ask for fair recognition without keeping score.', growth: 'Being overlooked can stay with you for a while.', habit: 'Name a colleague\'s contribution out loud each week.', challenge: 'Give someone else recognition for their contribution, out loud.' },
    collaboration: { label: 'Collaboration', strength: 'You say what you think, then let the team move forward.', growth: 'Letting others do it their way takes real effort.', habit: 'Before stepping in, ask: does this need my way, or just a good way?', challenge: 'Let one teammate do a task their way tomorrow, and don\'t correct it.' },
    humility: { label: 'Learning', strength: 'You learn from anyone, and say openly when you don\'t know yet.', growth: 'Not knowing can feel like losing face.', habit: 'Practise "I don\'t know yet, I\'ll find out."', challenge: 'Invite a colleague to challenge one of your assumptions.' },
    empathy: { label: 'Empathy', strength: 'You notice how others feel and respond with care.', growth: 'Under pressure, other people\'s feelings can slip out of view.', habit: 'In tense moments, name the other person\'s feeling before the facts.', challenge: 'Before your next tense reply, name what the other person might be feeling.' },
  },
  defaultHabit: 'Keep asking "what am I missing?" in meetings. It keeps you in the driver\'s seat.',
  defaultChallenge: 'Tomorrow, ask one colleague: "What am I missing?"',
};

export const RESULTS_EN: NonNullable<Experience['results']> = [
  { min: 0, max: 25, emoji: '🧘', tone: 'great', title: "You're in the driver's seat!", message: 'Calm hands on the wheel. Your first reflexes stay curious, even when a moment stings.',
    explanation: 'In most situations you chose the open, curious reaction, including the uncomfortable ones.', groupTitle: "We're in the driver's seat!", groupMessage: 'As a group we mostly react with curiosity. Let\'s keep it that way. 🧘' },
  { min: 26, max: 50, emoji: '😎', tone: 'good', title: "You're mostly in control!", message: 'Now and then your ego honks from the back seat, but you keep the wheel.',
    explanation: 'Most of your reactions are open or healthily confident. A few moments pull you towards protecting your position, which is very human.', groupTitle: "We're mostly in control!", groupMessage: 'A few honks from the back seat, but we keep the wheel. 😎' },
  { min: 51, max: 75, emoji: '🦙', tone: 'watch', title: 'Your ego is grabbing the wheel!', message: 'In some moments your first reflex steers. That\'s human, and the wheel is still yours.',
    explanation: 'In several situations your first reflex protected your position or your credit. Noticing that is the hardest part, and you just did.', groupTitle: 'Our egos sometimes grab the wheel!', groupMessage: 'Our reflexes take over now and then. Good thing we\'re noticing. 🦙' },
  { min: 76, max: 100, emoji: '👑', tone: 'grow', title: 'Your ego is driving!', message: 'Today your ego did much of the driving. Good news: reflexes can be retrained, one pause at a time. 💪',
    explanation: 'Today your quick reactions leaned towards defending, convincing or claiming credit. That says more about fast reflexes than about who you are.', groupTitle: 'Let\'s take back the wheel together!', groupMessage: 'Our egos did a lot of the driving today. A great starting point for this conversation. 👑' },
];
