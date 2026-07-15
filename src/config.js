/**
 * Reads runtime config set by the optional env.js (see env.example.js at
 * the repo root) — the static-site equivalent of environment variables,
 * since there's no build step or server to inject process.env values.
 * Every export defaults to null when env.js hasn't been created, so
 * callers can check "is this configured" without special-casing.
 */
const env = typeof window !== "undefined" ? /** @type {any} */ (window).__ALWENDA_ENV__ || {} : {};

export const SUPABASE_URL = env.SUPABASE_URL || null;
export const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || null;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
