// Starter templates for Creator Studio. Each is a complete, valid draft that plays end to end,
// so a creator starts from something that already works and only replaces the content.
// Team Challenge is intentionally absent: it needs team mechanics (see docs/CREATOR_STUDIO_PLAN.md, slice C5).
import type { Draft, GameKind } from './model';
import { blankDraft } from './model';

export interface Template { id: string; emoji: string; name: string; blurb: string; players: string; kind: GameKind; minutes: number; build: () => Draft }

const poll = (id: string, prompt: string, opts: [string, string?][]) =>
  ({ id, type: 'poll' as const, prompt, options: opts.map(([text, emoji], i) => ({ id: 'abcdef'[i], text, ...(emoji ? { emoji } : {}) })) });

function base(kind: GameKind, p: Partial<Draft>): Draft {
  const d = blankDraft(kind);
  return { ...d, ...p, id: 'my-game', status: 'draft', creator: 'PulsePlay creator' } as Draft;
}

export const TEMPLATES: Template[] = [
  {
    id: 'trivia', emoji: '🧠', name: 'Trivia Quiz', kind: 'quiz', minutes: 8, players: 'Everyone answers, scores stay private',
    blurb: 'Questions with one right answer and a short explanation. Optional nickname leaderboard.',
    build: () => base('quiz', {
      title: 'Team Trivia', tagline: 'Five quick questions. Trust your gut.', emoji: '🧠', category: 'trivia', durationMin: 8,
      description: 'A short knowledge quiz. Everyone answers on their phone, then the room sees how many got it right and why.',
      defaultTiming: { readSec: 3, answerSec: 15 }, reveal: 'correct',
      rounds: [{ id: 'main', activities: [
        { id: 'q1', type: 'choice', prompt: 'Which planet is known as the Red Planet?', shuffle: false, explanation: 'Iron oxide (rust) in its soil gives Mars its reddish colour.',
          options: [{ id: 'a', text: 'Mars', correct: true }, { id: 'b', text: 'Venus', correct: false }, { id: 'c', text: 'Jupiter', correct: false }] },
        { id: 'q2', type: 'choice', prompt: 'What is the largest ocean on Earth?', shuffle: false, explanation: 'The Pacific covers about a third of the planet’s surface.',
          options: [{ id: 'a', text: 'Atlantic', correct: false }, { id: 'b', text: 'Pacific', correct: true }, { id: 'c', text: 'Indian', correct: false }] },
        { id: 'q3', type: 'choice', prompt: 'What does H₂O stand for?', shuffle: false, explanation: 'Two hydrogen atoms and one oxygen atom: water.',
          options: [{ id: 'a', text: 'Salt', correct: false }, { id: 'b', text: 'Oxygen', correct: false }, { id: 'c', text: 'Water', correct: true }] },
        { id: 'q4', type: 'choice', prompt: 'How many minutes are there in a full day?', shuffle: false, explanation: '24 hours × 60 minutes = 1,440 minutes.',
          options: [{ id: 'a', text: '1,440', correct: true }, { id: 'b', text: '1,240', correct: false }, { id: 'c', text: '2,400', correct: false }] },
        { id: 'q5', type: 'choice', prompt: 'Which of these is a prime number?', shuffle: false, explanation: '13 can only be divided by 1 and itself.',
          options: [{ id: 'a', text: '15', correct: false }, { id: 'b', text: '21', correct: false }, { id: 'c', text: '13', correct: true }] },
      ] }],
      results: [
        { min: 0, max: 39, emoji: '🌱', title: 'Warming up!', message: 'Every expert started here.', explanation: 'Read the explanations again: they are great conversation starters.', groupTitle: 'We are warming up!', groupMessage: 'Lots of surprises today.', tone: 'grow' },
        { min: 40, max: 79, emoji: '🔍', title: 'Sharp mind!', message: 'You got most of them.', explanation: 'A good mix of knowledge and good guesses.', groupTitle: 'Sharp minds in this room!', groupMessage: 'Good instincts all round.', tone: 'good' },
        { min: 80, max: 100, emoji: '🏆', title: 'Trivia champion!', message: 'Nothing gets past you.', explanation: 'Maybe you should write the next quiz?', groupTitle: 'A room of champions!', groupMessage: 'Impressive, team.', tone: 'great' },
      ],
      closing: { questions: ['Which answer surprised you most?', 'What should the next quiz be about?'], message: 'Thanks for playing!' },
      disclaimer: 'Scores are private unless you choose to appear on the optional leaderboard.',
    }),
  },
  {
    id: 'icebreaker', emoji: '🧊', name: 'Icebreaker', kind: 'poll', minutes: 5, players: 'Great for groups who don’t know each other yet',
    blurb: 'Light, quick questions with no wrong answers. The room sees how everyone voted.',
    build: () => base('poll', {
      title: 'Quick Icebreaker', tagline: 'Five light questions to get everyone talking.', emoji: '🧊', category: 'icebreaker', durationMin: 5,
      description: 'Everyone picks an answer on their phone, then the room sees the split. No names, no scores, just conversation starters.',
      defaultTiming: { readSec: 3, answerSec: 10 }, reveal: 'distribution',
      rounds: [{ id: 'main', activities: [
        poll('i1', 'Morning person or night owl?', [['Morning person', '🌅'], ['Night owl', '🦉'], ['Depends on the coffee', '☕']]),
        poll('i2', 'Best way to recharge after a long day?', [['Sport', '🏃'], ['Friends or family', '🫶'], ['A good series', '📺'], ['Sleep', '😴']]),
        poll('i3', 'Your ideal holiday?', [['Beach', '🏖️'], ['Mountains', '🏔️'], ['City trip', '🏙️'], ['Staying home', '🛋️']]),
        poll('i4', 'Pick a superpower for work.', [['Never-ending energy', '⚡'], ['Instant translation', '🗣️'], ['Pause time', '⏸️']]),
        poll('i5', 'What do you bring to a team?', [['Ideas', '💡'], ['Calm', '🧘'], ['Humour', '😄'], ['Snacks', '🍪']]),
      ] }],
      closing: { questions: ['Find someone who answered differently and ask why.'], message: 'Now you know each other a little better. 💜' },
      disclaimer: 'Just for fun. Only group totals are shown.',
    }),
  },
  {
    id: 'wyr', emoji: '🤔', name: 'Would You Rather?', kind: 'poll', minutes: 6, players: 'Any group, any size',
    blurb: 'Two options per question. Watch the room split, then talk about it.',
    build: () => base('poll', {
      title: 'Would You Rather: Our Edition', tagline: 'Two options. One choice. Lots of opinions.', emoji: '🤔', category: 'fun', durationMin: 6,
      description: 'Each question has two options. Everyone picks one, then the room sees how it split.',
      defaultTiming: { readSec: 3, answerSec: 10 }, reveal: 'distribution',
      rounds: [{ id: 'main', activities: [
        poll('r1', 'Would you rather…', [['Always be 10 minutes early', '⏰'], ['Always be 5 minutes late', '🏃']]),
        poll('r2', 'Would you rather…', [['Work from a beach', '🏝️'], ['Work from a mountain cabin', '🏔️']]),
        poll('r3', 'Would you rather…', [['Have a robot do your emails', '🤖'], ['Have a robot do your cooking', '🍳']]),
        poll('r4', 'Would you rather…', [['Give a speech to 100 people', '🎤'], ['Write a 20-page report', '📄']]),
        poll('r5', 'Would you rather…', [['Learn any language instantly', '🗣️'], ['Learn any instrument instantly', '🎸']]),
      ] }],
      closing: { questions: ['Which question split the room most?'], message: 'Different choices, one team. 💜' },
      disclaimer: 'Just for fun. Only group totals are shown.',
    }),
  },
  {
    id: 'opinion', emoji: '📊', name: 'Opinion Poll', kind: 'poll', minutes: 7, players: 'Teams, classes, communities',
    blurb: 'Ask what the group really thinks, with choices and 1–5 scales. Anonymous group results.',
    build: () => base('poll', {
      title: 'Team Pulse', tagline: 'What does the group really think?', emoji: '📊', category: 'community', durationMin: 7,
      description: 'A short anonymous poll. Everyone answers on their phone; the room only sees group totals.',
      defaultTiming: { readSec: 4, answerSec: 15 }, reveal: 'distribution',
      rounds: [{ id: 'main', activities: [
        { id: 'p1', type: 'scale', prompt: 'How energised do you feel this week?', min: 1, max: 5, minLabel: 'Running on empty', maxLabel: 'Full of energy' },
        poll('p2', 'What should we spend more time on?', [['Learning together', '📚'], ['Planning ahead', '🗺️'], ['Celebrating wins', '🎉'], ['Focus time', '🎧']]),
        { id: 'p3', type: 'scale', prompt: 'How clear are our priorities right now?', min: 1, max: 5, minLabel: 'Not clear', maxLabel: 'Crystal clear' },
        poll('p4', 'Best format for our next get-together?', [['Lunch', '🍝'], ['Outdoor activity', '🌳'], ['Workshop', '🛠️'], ['Game night', '🎲']]),
      ] }],
      closing: { questions: ['What is one thing we could change based on these results?'], message: 'Thanks for sharing your view. 💜' },
      disclaimer: 'Anonymous. Only group totals are shown, and only when enough people answered.',
    }),
  },
  {
    id: 'reflection', emoji: '🪞', name: 'Personal Reflection', kind: 'score', minutes: 8, players: '5 or more people (private results)',
    blurb: 'Situations with honest answer options. Everyone gets a private result; the room sees only an anonymous average.',
    build: () => {
      const choice = (id: string, prompt: string, opts: [string, number][]) =>
        ({ id, type: 'choice' as const, prompt, shuffle: true, options: opts.map(([text, points], i) => ({ id: 'abcd'[i], text, points })) });
      return base('score', {
        title: 'How Do I Learn?', tagline: 'A private look at your learning habits.', emoji: '🪞', category: 'reflection', durationMin: 8,
        description: 'Five everyday situations. Go with your first instinct; your result stays on your phone and the group sees only an anonymous average.',
        defaultTiming: { readSec: 4, answerSec: 15 }, reveal: 'none',
        privacy: { individualResults: true, groupMinimum: 5, retainResponses: false },
        rounds: [{ id: 'main', activities: [
          choice('s1', 'You receive critical feedback on your work.', [['I ask questions to understand it', 0], ['I listen, then think about it later', 1], ['I explain why I did it that way', 2], ['I feel it was unfair', 3]]),
          choice('s2', 'You have to learn a new tool quickly.', [['I try it straight away and learn by doing', 0], ['I watch a short tutorial first', 1], ['I wait until someone shows me', 2], ['I avoid it as long as I can', 3]]),
          choice('s3', 'A colleague knows more about a topic than you.', [['I ask them to show me', 0], ['I read up on it myself first', 1], ['I keep quiet about what I don’t know', 2], ['I feel a bit threatened', 3]]),
          choice('s4', 'Something you tried did not work.', [['I note what I learned and try again', 0], ['I take a break, then try again', 1], ['I try something completely different', 2], ['I drop it', 3]]),
          choice('s5', 'You finish a project.', [['I reflect on what to do better next time', 0], ['I celebrate and move on', 1], ['I move straight on to the next thing', 2], ['I hope nobody asks about the details', 3]]),
        ] }],
        results: [
          { min: 0, max: 25, emoji: '🚀', title: 'Curious learner', message: 'You turn most situations into learning.', explanation: 'You ask, try and reflect. Keep sharing that habit with others.', groupTitle: 'A room of curious learners', groupMessage: 'Learning is part of how this group works.', tone: 'great' },
          { min: 26, max: 50, emoji: '🌿', title: 'Growing steadily', message: 'You learn well, especially when there is time.', explanation: 'A few situations still feel uncomfortable. That is normal.', groupTitle: 'Growing steadily together', groupMessage: 'Good habits with room to grow.', tone: 'good' },
          { min: 51, max: 75, emoji: '🧭', title: 'Finding your way', message: 'Some moments make learning harder for you.', explanation: 'Notice which situation felt hardest: that is your best next step.', groupTitle: 'Finding our way', groupMessage: 'Let’s make learning feel safer here.', tone: 'watch' },
          { min: 76, max: 100, emoji: '🌱', title: 'Ready for a new habit', message: 'Learning often feels risky right now.', explanation: 'Start small: ask one question this week that you would normally keep to yourself.', groupTitle: 'Ready for new habits', groupMessage: 'Small steps, together.', tone: 'grow' },
        ],
        closing: { questions: ['Which situation felt hardest?', 'What is one small thing you will try this week?'], message: 'Thanks for reflecting honestly. 💜' },
        disclaimer: 'A light-hearted reflection, not an assessment. Results are private.',
      });
    },
  },
];

/** Session key for a template chosen before signing in; survives the sign-in step in the same tab. */
export const PENDING_TEMPLATE = 'pp_pending_template';
export const templateById = (id: string) => TEMPLATES.find(t => t.id === id);
