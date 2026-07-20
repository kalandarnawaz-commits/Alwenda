/**
 * Reads runtime config set by the optional env.js (see env.example.js at
 * the repo root) — the static-site equivalent of environment variables,
 * since there's no build step or server to inject process.env values.
 * Every export defaults to null when env.js hasn't been created, so
 * callers can check "is this configured" without special-casing.
 */
const env = typeof window !== "undefined" ? /** @type {any} */ (window).__ALWENDA_ENV__ || {} : {};

export const SUPABASE_URL = env.SUPABASE_URL || null;
export const SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || null;
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
export const APP_ENV = env.APP_ENV || "development";
export const APP_RELEASE_VERSION = env.APP_RELEASE_VERSION || "local-dev";
export const PUBLIC_FEATURE_FLAGS = Object.freeze(env.PUBLIC_FEATURE_FLAGS || {});
export const ELEVENLABS_TTS_FUNCTION_SLUG = env.ELEVENLABS_TTS_FUNCTION_SLUG || env.ALWENDA_TTS_FUNCTION_SLUG || "elevenlabs-tts";
export const TRANSLATE_TRANSCRIBE_FUNCTION_SLUG =
  env.TRANSLATE_TRANSCRIBE_FUNCTION_SLUG || env.ALWENDA_TRANSLATE_TRANSCRIBE_FUNCTION_SLUG || "translate-transcribe";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getRuntimeConfigDiagnostics() {
  return {
    appEnv: APP_ENV,
    releaseVersion: APP_RELEASE_VERSION,
    supabaseConfigured: isSupabaseConfigured(),
    hasSupabaseUrl: Boolean(SUPABASE_URL),
    hasSupabasePublishableKey: Boolean(SUPABASE_PUBLISHABLE_KEY),
    elevenLabsTtsFunctionSlug: ELEVENLABS_TTS_FUNCTION_SLUG,
    translateTranscribeFunctionSlug: TRANSLATE_TRANSCRIBE_FUNCTION_SLUG,
    featureFlags: Object.keys(PUBLIC_FEATURE_FLAGS)
  };
}

export function validatePublicRuntimeConfig() {
  const diagnostics = getRuntimeConfigDiagnostics();
  const warnings = [];
  if (!diagnostics.hasSupabaseUrl) warnings.push("SUPABASE_URL is missing.");
  if (!diagnostics.hasSupabasePublishableKey) warnings.push("SUPABASE_PUBLISHABLE_KEY is missing.");
  if (!["development", "staging", "production", "test"].includes(APP_ENV)) warnings.push(`APP_ENV '${APP_ENV}' is not recognised.`);
  return { ok: warnings.length === 0, warnings, diagnostics };
}
