// A player's own result, kept only in this phone's browser so it survives refreshes and the end of the game.
// Never sent anywhere. The player can delete it at any time; old entries expire after 30 days.
import type { PersonalResult } from '../engine/scoring';

export interface SavedResult { code: string; title: string; emoji: string; disclaimer: string; r: PersonalResult; at: number }
const KEY = 'pp_results', TTL = 30 * 24 * 3600e3;
const all = (): SavedResult[] => { try { return (JSON.parse(localStorage.getItem(KEY) || '[]') as SavedResult[]).filter(x => Date.now() - x.at < TTL); } catch { return []; } };
const write = (xs: SavedResult[]) => { try { localStorage.setItem(KEY, JSON.stringify(xs.slice(0, 20))); } catch { /* storage blocked: result stays on screen only */ } };
export const savedResult = (code: string) => all().find(x => x.code === code) ?? null;
export const savedResults = () => all();
export function saveResult(x: Omit<SavedResult, 'at'>) { const prev = savedResult(x.code); if (prev && JSON.stringify(prev.r) === JSON.stringify(x.r)) return; write([{ ...x, at: Date.now() }, ...all().filter(y => y.code !== x.code)]); }
export function deleteResult(code: string) { write(all().filter(x => x.code !== code)); }
