// Public client configuration only. The publishable key can call nothing but the pp_* / egocheck_* game functions.
// Override at build time with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (see web/.env.example).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://uowmfxqrbwxfklvywcac.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_TxLEFsUy69lZSRbaKGeE9g_0V_5CPQ6';
