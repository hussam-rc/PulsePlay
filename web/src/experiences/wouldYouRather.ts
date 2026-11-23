import type { Experience } from '../engine/schema';

const p = (id: string, prompt: string, a: [string, string], b: [string, string]) => ({
  id, type: 'poll' as const, prompt,
  options: [{ id: 'a', emoji: a[0], text: a[1] }, { id: 'b', emoji: b[0], text: b[1] }],
});

export const wouldYouRather: Experience = {
  schemaVersion: 1,
  id: 'would-you-rather',
  title: 'Would You Rather?',
  tagline: 'Funny, surprising, work-safe choices.',
  emoji: '🤔',
  category: 'icebreaker',
  description: 'Ten quick dilemmas with no right answers. Everyone picks on their phone, then the room sees how the group split. A warm-up that gets people talking in under ten minutes.',
  durationMin: 8,
  players: { min: 3, max: 200 },
  languages: ['en'],
  ageRating: 'all',
  facilitator: 'optional',
  modes: ['live', 'self', 'practice'],
  defaultTiming: { readSec: 3, answerSec: 10 },
  reveal: 'distribution',
  privacy: { individualResults: false, groupMinimum: 3, retainResponses: false },
  scoring: { kind: 'aggregate', minAnsweredRatio: 0 },
  disclaimer: 'Just for fun. No scores and no right answers. Only group totals are shown.',
  creator: 'PulsePlay',
  status: 'published',
  rounds: [{
    id: 'main',
    activities: [
      p('w1', 'Would you rather…', ['🗂️', 'Meetings with no slides'], ['📎', 'Emails with no attachments']),
      p('w2', 'Would you rather…', ['🎤', 'Present to 500 strangers'], ['🎂', 'Sing happy birthday alone to your team']),
      p('w3', 'Would you rather…', ['🌅', 'Start every workday at 6:00'], ['🌙', 'Finish every workday at 21:00']),
      p('w4', 'Would you rather…', ['📵', 'One week without your phone'], ['☕', 'One week without coffee or tea']),
      p('w5', 'Would you rather…', ['🧠', 'Know every programming language'], ['🗣️', 'Speak every human language']),
      p('w6', 'Would you rather…', ['📹', 'Camera always on'], ['🔇', 'Always be the one who forgot to unmute']),
      p('w7', 'Would you rather…', ['🏖️', 'Four-day week, longer days'], ['🕐', 'Five-day week, short days']),
      p('w8', 'Would you rather…', ['🐌', 'Slow Wi-Fi forever'], ['🔋', 'Laptop battery that lasts one hour']),
      p('w9', 'Would you rather…', ['🦸', 'Have a mentor for life'], ['🧭', 'Mentor someone for life']),
      p('w10', 'Would you rather…', ['🍕', 'Pick the team lunch forever'], ['🎵', 'Pick the office playlist forever']),
    ],
  }],
  transitions: ['The room is split! 🤯', 'Who saw that coming? 👀', 'Strong opinions in here. 💬', 'Interesting choice, team. 🤔'],
  closing: { questions: ['Which answer surprised you most?', 'Find someone who voted differently and ask why.'], message: 'Different choices, one team. 💜' },
};
