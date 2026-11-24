import { describe, it, expect } from 'vitest';
import engine from '../src/engine/schema.ts?raw';
import fn from '../../supabase/functions/publish/schema.ts?raw';
import fn2 from '../../supabase/functions/draft-questions/schema.ts?raw';

// The publish Edge Function validates with a copy of the engine schema (Deno needs an npm: import).
// This test fails if the two drift, so the server can never accept what the app would reject or vice versa.
describe('publish function schema', () => {
  it('matches the engine schema apart from the zod import', () => {
    expect(fn.replace("from 'npm:zod@3.25.76'", "from 'zod'")).toBe(engine);
    expect(fn2.replace("from 'npm:zod@3.25.76'", "from 'zod'")).toBe(engine);
  });
});
