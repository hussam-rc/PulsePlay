import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The publish Edge Function validates with a copy of the engine schema (Deno needs an npm: import).
// This test fails if the two drift, so the server can never accept what the app would reject or vice versa.
describe('publish function schema', () => {
  it('matches the engine schema apart from the zod import', () => {
    const engine = readFileSync(resolve(__dirname, '../src/engine/schema.ts'), 'utf8');
    const fn = readFileSync(resolve(__dirname, '../../supabase/functions/publish/schema.ts'), 'utf8');
    expect(fn.replace("from 'npm:zod@3.25.76'", "from 'zod'")).toBe(engine);
  });
});
