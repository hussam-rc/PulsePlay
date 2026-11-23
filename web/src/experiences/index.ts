import { egoCheck } from './egoCheck';
import { wouldYouRather } from './wouldYouRather';
import { mythOrFact } from './mythOrFact';
import type { Experience } from '../engine/schema';

export const EXPERIENCES: Experience[] = [egoCheck, wouldYouRather, mythOrFact];
export const byId = (id: string) => EXPERIENCES.find(e => e.id === id);

export const CATEGORY_LABEL: Record<Experience['category'], string> = {
  icebreaker: 'Icebreakers', 'team-building': 'Team building', reflection: 'Personal reflection', 'workplace-culture': 'Workplace culture',
  communication: 'Communication', leadership: 'Leadership', collaboration: 'Collaboration', trivia: 'Knowledge & trivia',
  education: 'Education & training', community: 'Community engagement', intercultural: 'Diversity & intercultural', creative: 'Creative thinking',
  'problem-solving': 'Problem solving', fun: 'Just for fun',
};

/** Planned experiences (roadmap). Shown as "in development", never as playable. */
export const PLANNED: { emoji: string; title: string; tagline: string; phase: string }[] = [
  { emoji: '🧪', title: 'The Team Chemistry Lab', tagline: 'What makes us work better together?', phase: 'Phase 2' },
  { emoji: '🪞', title: 'The Feedback Mirror', tagline: 'How we give, receive and read feedback.', phase: 'Phase 2' },
  { emoji: '👑', title: 'The Leadership Dilemma', tagline: 'Real choices, facilitated discussion.', phase: 'Phase 2' },
  { emoji: '🌍', title: 'Culture Clash', tagline: 'Assumptions, etiquette and working styles.', phase: 'Phase 3' },
  { emoji: '😂', title: "Who's Most Likely To…?", tagline: 'Playful appreciation, opt-in only.', phase: 'Phase 3' },
  { emoji: '🕵️', title: 'Guess the Team!', tagline: 'Fun facts, with consent controls.', phase: 'Phase 3' },
  { emoji: '🤝', title: 'The Collaboration Challenge', tagline: 'Solve it together, win together.', phase: 'Phase 3' },
  { emoji: '🎤', title: 'Community Voices', tagline: 'Polls, rankings and word clouds.', phase: 'Phase 3' },
  { emoji: '⚡', title: 'The Creative Storm', tagline: 'Generate, group and prioritise ideas.', phase: 'Phase 3' },
];
