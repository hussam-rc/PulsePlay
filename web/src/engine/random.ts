// Deterministic helpers so a player's option order is stable across reloads.
export function hash(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}

export function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded permutation of 0..n-1 for one player and one activity. */
export function order(seed: string, key: string, n: number): number[] {
  const r = rng(hash(seed + ':' + key));
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function randomId(n = 10): string {
  const c = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = new Uint32Array(n); crypto.getRandomValues(b);
  return Array.from(b, x => c[x % c.length]).join('');
}
