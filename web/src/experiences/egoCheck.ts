import type { Experience } from '../engine/schema';

// Points: 0 = reflective/collaborative, 3 = most defensive, controlling or credit-seeking.
// Feelings never score; only the behaviour that follows a feeling does. Same rubric as the live Ego Check backend.
const c = (id: string, theme: string, prompt: string, o: [string, number][]) => ({
  id, type: 'choice' as const, theme, prompt, shuffle: true,
  options: o.map(([text, points], i) => ({ id: 'abcd'[i], text, points })),
});

export const egoCheck: Experience = {
  schemaVersion: 1,
  id: 'ego-check',
  title: 'Who is in Control?',
  tagline: "Who's driving today: you, or your ego?",
  emoji: '🪞🚗',
  category: 'reflection',
  description: 'Ten everyday work moments, a few seconds each. Go with your first instinct, then look in a private mirror: are you behind the wheel, or are your reflexes driving? The group sees only an anonymous team score.',
  durationMin: 12,
  players: { min: 5, max: 80 },
  languages: ['en'],
  ageRating: '16+',
  facilitator: 'optional',
  modes: ['live', 'self', 'practice'],
  defaultTiming: { readSec: 4, answerSec: 15 },
  reveal: 'none',
  privacy: { individualResults: true, groupMinimum: 5, retainResponses: false },
  scoring: { kind: 'behaviour', minAnsweredRatio: 0.7 },
  disclaimer: 'A light-hearted reflection game, not a psychological assessment or a performance tool. Feelings never count against you, only reactions do.',
  creator: 'Remotecoders',
  status: 'published',
  rounds: [{
    id: 'main',
    activities: [
      c('q1', 'feedback', 'Your slide gets roasted in a meeting. First reaction?', [['I launch a 12-slide counter-presentation. 🛡️', 3], ['I smile, nod and quietly decide they have no taste.', 2], ['Ouch. But I hear them out.', 0], ['"Fair! What would you change?"', 0]]),
      c('q2', 'credit', 'Your colleague gets a round of applause for the thing you helped build.', [['I replay it in my head all evening. 🎬', 2], ['"Fun fact: that was partly me!" 🙋', 3], ['I clap the loudest. 👏', 0], ['A tiny "hmm", then I get a coffee.', 0]]),
      c('q3', 'mistake', 'Oops. You just spotted your own mistake.', [['I raise my hand: "My bad, fixing it!"', 0], ['I first check who else touched it. 🕵️', 2], ['I fix it at 11 pm and tell nobody. 🥷', 3], ['I explain what happened and own it.', 0]]),
      c('q4', 'disagree', 'Someone disagrees with your brilliant idea.', [['I explain it again. Louder. 📢', 2], ['"Interesting! What do you see that I don\'t?"', 0], ['Inner sigh, outer open mind.', 0], ['Clearly they just didn\'t get it yet.', 3]]),
      c('q5', 'idea', 'A colleague suggests an approach that is… actually better than yours.', [['Switch! Best idea wins. 🏆', 0], ['Give me a moment to grieve, then I\'m in.', 0], ['I defend my idea like it\'s my firstborn.', 3], ['"Great!" (I\'m already hunting for its flaws.) 🔍', 2]]),
      c('q6', 'change', 'Your manager wants changes to something you polished for days.', [['I take it personally. 💔', 2], ['"Sure, what outcome do you need?"', 0], ['I say "but…" before they finish the sentence.', 3], ['Disappointed, but I hear them out.', 0]]),
      c('q7', 'interrupt', 'You get interrupted mid-sentence. Again.', [['My eyebrows do all the talking. 🤨', 2], ['"Let me finish this thought, then I\'m all ears."', 0], ['I interrupt them back. Fair is fair. 🎤', 3], ['I let them finish, then calmly pick up my thread.', 0]]),
      c('q8', 'teamwin', 'The team wins big, and nobody mentions your part.', [['The cake suddenly tastes worse. 🍰', 2], ['A win is a win. Party time! 🎉', 0], ['I send a recap email listing my contributions.', 3], ['I notice, shrug and enjoy the cake.', 0]]),
      c('q9', 'unknown', 'Someone asks you something you have no idea about.', [['"No idea, but I\'ll find out!"', 0], ['I answer confidently anyway. Sounds legit. 🤓', 3], ['"Let\'s ask someone who really knows."', 0], ['I change the subject to the weather. ☀️', 2]]),
      c('q10', 'decision', 'You\'re 100% sure you\'re right, but the team picks another direction.', [['I keep arguing until the meeting ends. ⏰', 3], ['I share my concerns, then fully back it.', 0], ['I go along, but I\'m secretly waiting for "I told you so".', 1], ['I stay curious and help make it work.', 0]]),
    ],
  }],
  results: [
    { min: 0, max: 25, emoji: '🥳', tone: 'great', title: "Cool, calm and in the driver's seat!", message: "Your ego is napping in the back seat. 😴 You're driving. Keep it up!", explanation: 'Your answers show curiosity, humility and openness, even in moments that sting.', groupTitle: 'Our team is cool, calm and in control!', groupMessage: 'Our egos are napping. We choose how we react. 😴' },
    { min: 26, max: 50, emoji: '😎', tone: 'good', title: "You're mostly in control!", message: 'Now and then your ego honks from the back seat. 📯 But you usually keep the wheel.', explanation: 'Most of your reactions are open and collaborative. A few situations pull you towards defending or proving yourself, which is very human.', groupTitle: "We're mostly in control!", groupMessage: 'A few honks from the back seat, but we keep the wheel. 📯' },
    { min: 51, max: 75, emoji: '🚦', tone: 'watch', title: 'Your ego sometimes grabs the wheel', message: "In some moments your first reflex steers. That's human, and the wheel is still yours.", explanation: 'In several situations your first reflex protected your position or your credit. Noticing that is the hardest part, and you just did.', groupTitle: 'Our egos sometimes grab the wheel', groupMessage: "Our reflexes take over now and then. Good thing we're noticing. 🚦" },
    { min: 76, max: 100, emoji: '🏎️', tone: 'grow', title: 'Time to take back the wheel!', message: 'Today your ego did a lot of the driving. Good news: reflexes can be retrained, one pause at a time. 💪', explanation: 'Today your quick reactions leaned towards defending, convincing or claiming credit. That says more about fast reflexes than about who you are, and reflexes can be retrained.', groupTitle: 'Let\'s take back the wheel together!', groupMessage: 'Our egos did a lot of the driving today. A great starting point for this conversation. 🏎️' },
  ],
  insights: {
    defaultHabit: 'Keep asking "what am I missing?" in meetings. It keeps you in the driver\'s seat.',
    defaultChallenge: 'Ask one colleague how you could support them better this week.',
    themes: {
      feedback: { label: 'Feedback', strength: 'You stay open when your work is criticised.', growth: 'Criticism can put you on the defensive quickly.', habit: 'When feedback comes, ask one question before you answer.', challenge: 'Ask one colleague: "What\'s one thing I could do better?" Just listen.' },
      credit: { label: 'Recognition', strength: "You can celebrate a colleague's win without keeping score.", growth: 'Credit for shared work matters a lot to you.', habit: "Name one colleague's contribution out loud each week.", challenge: 'Thank someone publicly for help they gave you this month.' },
      mistake: { label: 'Mistakes', strength: 'You own your mistakes openly.', growth: 'A mistake can make you look elsewhere first.', habit: 'Say "that one\'s on me" early, then share the fix.', challenge: 'Share one small mistake with your team and what you learned.' },
      disagree: { label: 'Disagreement', strength: 'You get curious when people disagree with you.', growth: 'Disagreement can switch you into convincing mode.', habit: 'Before you reply, sum up their view in one sentence.', challenge: 'In your next disagreement, ask "What am I missing?" first.' },
      idea: { label: 'Better ideas', strength: 'You let the best idea win, whoever had it.', growth: 'Letting go of your own idea is hard.', habit: 'Ask "which option is best for the client?" instead of "whose idea?"', challenge: "Build on someone else's idea in your next meeting." },
      change: { label: 'Change requests', strength: 'You focus on the outcome, not on your pride.', growth: 'Change requests can feel personal.', habit: 'Ask "what outcome do you need?" before defending the work.', challenge: 'When asked for a change, ask about the goal before you react.' },
      interrupt: { label: 'Interruptions', strength: 'You hold your ground calmly when interrupted.', growth: 'Interruptions can trigger a counter-attack.', habit: 'Try "Let me finish this thought, then I\'m all ears."', challenge: 'Notice one moment you want to interrupt — and wait three seconds.' },
      teamwin: { label: 'Team wins', strength: 'Shared wins are enough for you.', growth: 'Being left unmentioned can spoil a good moment.', habit: 'Celebrate the team result first; raise credit 1:1 later if it matters.', challenge: 'Congratulate the team on a win and leave yourself out of it.' },
      unknown: { label: 'Not knowing', strength: 'You are comfortable saying "I don\'t know".', growth: 'Not knowing can feel like losing face.', habit: 'Practise "I don\'t know yet — I\'ll find out."', challenge: 'Say "I don\'t know" at least once tomorrow — and follow up.' },
      decision: { label: 'Team decisions', strength: 'You commit once the team decides.', growth: 'Letting go after a decision takes real effort.', habit: "Once a decision is made, write down one way you'll help it work.", challenge: "Help move forward one decision you didn't agree with." },
    },
  },
  transitions: ['Some reflexes just woke up… 👀', 'The mirror saw that. 🪞', 'Hands on the wheel, everyone! 🚗', 'Was that you or your ego? 🤔', 'Green light, keep going! 🚦', 'Somebody check the rear-view mirror. 😏', 'The llama is watching. 🦙', 'Seatbelts on, this one is spicy. 🌶️', 'Nobody saw your answer. Only you. 🤫', 'Finish line! 🏁'],
  closing: { questions: ['When does my ego take the wheel?', 'How can I notice it earlier?', 'What can I do differently tomorrow?'], message: "Reflexes are human. Just don't let them drive every meeting. 🚗💜" },
};
