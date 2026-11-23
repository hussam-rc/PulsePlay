import type { Experience } from '../engine/schema';

const q = (id: string, prompt: string, isFact: boolean, explanation: string) => ({
  id, type: 'choice' as const, prompt, shuffle: false, explanation,
  options: [{ id: 'myth', text: '🧚 Myth', correct: !isFact }, { id: 'fact', text: '✅ Fact', correct: isFact }],
});

export const mythOrFact: Experience = {
  schemaVersion: 1,
  id: 'myth-or-fact',
  title: 'Myth or Fact?',
  tagline: 'Ten claims. Trust your gut, then learn why.',
  emoji: '🧠',
  category: 'trivia',
  description: 'A quick knowledge game: decide whether each statement is a myth or a fact, then see the explanation. The room sees how many got each one right. Nobody is ranked unless they choose to join the optional leaderboard.',
  durationMin: 10,
  players: { min: 1, max: 200 },
  languages: ['en'],
  ageRating: 'all',
  facilitator: 'optional',
  modes: ['live', 'self', 'practice'],
  defaultTiming: { readSec: 4, answerSec: 8 },
  reveal: 'correct',
  privacy: { individualResults: true, groupMinimum: 3, retainResponses: false },
  scoring: { kind: 'correct', minAnsweredRatio: 0.7 },
  disclaimer: 'Explanations are short summaries of widely accepted findings. Scores are private unless you choose to appear on the optional leaderboard.',
  creator: 'PulsePlay',
  status: 'published',
  rounds: [{
    id: 'main',
    activities: [
      q('m1', 'Goldfish only remember things for about three seconds.', false, 'Experiments show goldfish can learn tasks and remember them for weeks or even months.'),
      q('m2', 'Doing several tasks at once makes most people more productive.', false, 'Switching between tasks has a cost: people tend to be slower and make more errors than when they focus on one task at a time.'),
      q('m3', 'The Great Wall of China is easy to see from space with the naked eye.', false, 'Astronauts report it is very hard or impossible to see unaided from orbit: it is long but narrow and similar in colour to its surroundings.'),
      q('m4', 'We only use about 10% of our brains.', false, 'Brain imaging shows activity across virtually all regions, and damage to almost any area has effects.'),
      q('m5', 'Spreading study sessions over several days helps you remember more than cramming.', true, 'This is the "spacing effect", one of the most consistently replicated findings in learning research.'),
      q('m6', 'Napoleon Bonaparte was unusually short for his time.', false, 'He was about 1.69 m, roughly average for a Frenchman of his era. The myth comes partly from confusion between French and English inches.'),
      q('m7', 'The word "bug" for a technical fault was invented after a moth was found in a computer.', false, 'A moth was found in the Harvard Mark II in 1947 and logged as the "first actual case of bug being found", but engineers, including Thomas Edison, used "bug" for faults decades earlier.'),
      q('m8', 'Botanically speaking, bananas are berries.', true, 'In botany a berry develops from a single flower with one ovary, which bananas do. Strawberries, surprisingly, are not true berries.'),
      q('m9', 'Switzerland has four national languages.', true, 'German, French, Italian and Romansh are all national languages of Switzerland.'),
      q('m10', 'Lightning never strikes the same place twice.', false, 'Tall structures are struck repeatedly; the Empire State Building is hit around 20 times a year on average.'),
    ],
  }],
  results: [
    { min: 0, max: 39, emoji: '🧚', tone: 'grow', title: 'Myth magnet!', message: 'Myths are sticky — and now you know ten fewer of them.', explanation: 'Most people believe several of these. Read the explanations again; they are great conversation starters.', groupTitle: 'Our team loves a good myth!', groupMessage: 'Plenty of surprises today. Which one shocked you most?' },
    { min: 40, max: 69, emoji: '🔍', tone: 'watch', title: 'Solid detective!', message: 'You spotted a good share of the myths.', explanation: 'A healthy dose of scepticism with a few surprises along the way.', groupTitle: "We're solid detectives!", groupMessage: 'Good instincts, a few twists. Nice work, team.' },
    { min: 70, max: 89, emoji: '🧠', tone: 'good', title: 'Fact finder!', message: 'Your myth radar is strong.', explanation: 'You sorted most claims correctly. Ask yourself which one you guessed.', groupTitle: "We're fact finders!", groupMessage: 'Strong myth radar across the room.' },
    { min: 90, max: 100, emoji: '🏆', tone: 'great', title: 'Myth buster!', message: 'Nothing gets past you.', explanation: 'Almost a perfect round. Maybe you should write the next quiz?', groupTitle: "We're myth busters!", groupMessage: 'Nothing gets past this team.' },
  ],
  transitions: ['Did that surprise you? 😮', 'Plot twist! 🌀', 'Myth radar check… 📡'],
  closing: { questions: ['Which answer surprised you most?', 'Where did you first hear that myth?'], message: 'Stay curious. 🧠💜' },
};
