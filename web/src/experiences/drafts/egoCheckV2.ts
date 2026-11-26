// DRAFT (Release 3.0B): the English v2 experience assembled from the bank. Not registered in the catalogue.
import type { Experience } from '../../engine/schema';
import { egoCheck } from '../egoCheck';
import { BANK_EN, INSIGHTS_EN, RESULTS_EN } from './egoCheckV2.en';

export const egoCheckV2Draft: Experience = {
  ...egoCheck,
  description: 'Everyday work moments, a few seconds each. Go with your first instinct, then look in a private mirror: are you behind the wheel, or are your reflexes driving? The group sees only an anonymous team result.',
  disclaimer: 'A playful self-reflection exercise, not a scientific assessment of personality or performance. The score reflects this game only. Feelings never count against you, only reactions do.',
  status: 'review',
  scoring: { kind: 'behaviour', minAnsweredRatio: 0.7, version: 2, showScore: true },
  insights: INSIGHTS_EN,
  results: RESULTS_EN,
  bank: { strategy: 'dimension', lengths: [10, 15, 20], defaultLength: 10 },
  rounds: [{ id: 'main', activities: BANK_EN }],
};
