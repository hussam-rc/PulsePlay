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
  tagline: "Who's driving today — you or your ego?",
  emoji: '🪞🚗',
  category: 'reflection',
  description: 'Ten everyday work moments, a few seconds each. Go with your first instinct, then look in a private mirror: are you behind the wheel, or is your ego driving? The group sees only an anonymous team score.',
  durationMin: 12,
  players: { min: 5, max: 80 },
  languages: ['en'],
  ageRating: '16+',
  facilitator: 'optional',
  modes: ['live', 'self', 'practice'],
  defaultTiming: { readSec: 5, answerSec: 5 },
  reveal: 'none',
  privacy: { individualResults: true, groupMinimum: 5, retainResponses: false },
  scoring: { kind: 'behaviour', minAnsweredRatio: 0.7 },
  disclaimer: 'A light-hearted reflection game, not a psychological assessment or a performance tool. Feelings never count against you, only reactions do.',
  creator: 'Remotecoders',
  status: 'published',
  rounds: [{
    id: 'main',
    activities: [
      c('q1', 'feedback', 'Someone criticises your work in a meeting. What happens first?', [['I defend it straight away.', 3], ['I nod, but quietly decide they are wrong.', 2], ['It stings, but I hear them out.', 0], ['I ask what they would change.', 0]]),
      c('q2', 'credit', 'A colleague is praised for something you helped with.', [['It bothers me for the rest of the day.', 2], ['I jump in to mention my part.', 3], ["I'm genuinely happy for them.", 0], ['A bit disappointed, then I move on.', 0]]),
      c('q3', 'mistake', 'You realise you made a mistake.', [['I flag it and start fixing it.', 0], ['I first check who else was involved.', 2], ['I fix it quietly and hope nobody notices.', 3], ['I explain what happened and own it.', 0]]),
      c('q4', 'disagree', 'Someone disagrees with your idea.', [['I push harder to convince them.', 2], ["I ask what they see that I don't.", 0], ["I'm frustrated, but I stay open.", 0], ["I assume they haven't understood it.", 3]]),
      c('q5', 'idea', 'A colleague suggests a better approach than yours.', [['I switch to it happily.', 0], ['I need a moment, then I come around.', 0], ['I keep defending my original idea.', 3], ['I agree, but keep looking for its flaws.', 2]]),
      c('q6', 'change', 'Your manager asks you to change something you worked hard on.', [['I take it personally.', 2], ['I ask what outcome they need.', 0], ['I push back before I hear the reason.', 3], ["I'm disappointed, but I consider it.", 0]]),
      c('q7', 'interrupt', 'Someone interrupts you in a meeting.', [['I get irritated and it shows.', 2], ['I calmly ask to finish my point.', 0], ['I interrupt them back.', 3], ['I let them finish, then return to my point.', 0]]),
      c('q8', 'teamwin', 'Your team succeeds, but nobody mentions you.', [['It spoils the moment for me.', 2], ['The shared win is enough for me.', 0], ['I remind everyone what I did.', 3], ['I notice it, then let it go.', 0]]),
      c('q9', 'unknown', "Someone asks you a question and you don't know the answer.", [["I say I don't know and offer to find out.", 0], ['I answer anyway and sound sure.', 3], ['I ask someone who knows more.', 0], ['I steer the conversation elsewhere.', 2]]),
      c('q10', 'decision', "You're sure you're right, but the team chooses another direction.", [['I keep arguing my point.', 3], ['I share my concerns, then back the decision.', 0], ['I go along, but struggle to let it go.', 1], ['I stay curious and help it succeed.', 0]]),
    ],
  }],
  results: [
    { min: 0, max: 25, emoji: '🧘', tone: 'great', title: "You're in the driver's seat!", message: 'Your ego knows when to take a back seat. Great job — keep it up!', explanation: 'Your answers show curiosity, humility and openness — even in moments that sting.', groupTitle: "We're in the driver's seat!", groupMessage: 'Our egos are happily riding in the back seat.' },
    { min: 26, max: 50, emoji: '😎', tone: 'good', title: "You're mostly in control!", message: 'Your ego sometimes reaches for the steering wheel, but you usually stay in charge.', explanation: 'Most of your reactions are open and collaborative. A few situations pull you towards defending or proving yourself — which is very human.', groupTitle: "We're mostly in control!", groupMessage: "Looks like our egos usually know who's boss." },
    { min: 51, max: 75, emoji: '🦙', tone: 'watch', title: 'Your ego is grabbing the wheel!', message: 'Your ego is strong in some situations. The good news? You can take back control.', explanation: 'In several situations your first reflex protected your position or your credit. Noticing that is the hardest part — and you just did.', groupTitle: 'Our egos are grabbing the wheel!', groupMessage: "Our egos grab the wheel now and then. Good thing we're noticing." },
    { min: 76, max: 100, emoji: '👑', tone: 'grow', title: 'Your ego is in control!', message: 'Your ego may be driving more often than you realise. Time to take back the wheel!', explanation: 'Today your quick reactions leaned towards defending, convincing or claiming credit. That says more about fast reflexes than about who you are — and reflexes can be retrained.', groupTitle: 'Our egos are in control!', groupMessage: "Our egos have been doing a lot of the driving. Let's take back the wheel together." },
  ],
  insights: {
    defaultHabit: 'Keep asking "what am I missing?" in meetings — it is why your ego stays in the back seat.',
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
  transitions: ['Interesting… some egos are getting nervous! 👀', 'The mirror saw that. 🪞', 'Hands on the wheel, everyone. 🚗', 'Hmm… was that you or your ego? 🤔', 'Green light — keep going! 🚦', 'Somebody check the rear-view mirror. 👀', 'The llama is watching. 🦙', 'Seatbelts on — next one is tricky. 🔒', 'Nobody saw your answer. Only you. 🤫', 'Finish line! 🏁'],
  closing: { questions: ['When does my ego take the wheel?', 'How can I notice it earlier?', 'What can I do differently tomorrow?'], message: "Your ego is part of you. Just don't let it drive every meeting. 🚗💜" },
};
