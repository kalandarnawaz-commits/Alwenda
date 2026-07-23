/**
 * Reads runtime config set by the optional env.js (see env.example.js at
 * the repo root) — the static-site equivalent of environment variables,
 * since there's no build step or server to inject process.env values.
 * Every export defaults to null when env.js hasn't been created, so
 * callers can check "is this configured" without special-casing.
 */
const env = typeof window !== "undefined" ? /** @type {any} */ (window).__ALWENDA_ENV__ || {} : {};
// Node has no window/env.js — this only ever matters for test files that
// explicitly opt in (process.env.APP_ENV=development|test) before
// importing a module that reads APP_ENV; it is never reached in a browser.
const nodeEnv = typeof process !== "undefined" && process.env ? process.env : {};

export const SUPABASE_URL = env.SUPABASE_URL || null;
export const SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || null;
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;

export const RECOGNISED_APP_ENVS = ["development", "staging", "production", "test"];
const FIXTURE_PERMITTING_APP_ENVS = ["development", "test"];

/** A fixture-permitting environment must be named explicitly — this is the
 * one value read before mockData.js decides whether to load any seeded/
 * demo fixture content, so getting the fallback wrong here would let fake
 * activity slip into production. Anything unset, misspelled, or simply not
 * one of the recognised names resolves to "production": the fail-safe
 * default the whole gating scheme depends on. Exported as a pure function
 * (rather than only the pre-resolved APP_ENV constant below) so the exact
 * fallback behaviour is directly unit-testable without simulating window/
 * process.env or fighting ES module import caching. */
export function resolveAppEnv(browserValue, nodeValue) {
  if (RECOGNISED_APP_ENVS.includes(browserValue)) return browserValue;
  if (RECOGNISED_APP_ENVS.includes(nodeValue)) return nodeValue;
  return "production";
}

/** Same fail-safe rule as resolveAppEnv, phrased as the yes/no fixtures
 * question every call site actually cares about — an unrecognised or
 * missing environment must always come out "not allowed", never "allowed
 * because we couldn't tell". */
export function computeIsFixturesAllowed(appEnv) {
  return FIXTURE_PERMITTING_APP_ENVS.includes(appEnv);
}

export const APP_ENV = resolveAppEnv(env.APP_ENV, nodeEnv.APP_ENV);
export const APP_ENV_WAS_EXPLICIT = RECOGNISED_APP_ENVS.includes(env.APP_ENV) || RECOGNISED_APP_ENVS.includes(nodeEnv.APP_ENV);
export const APP_RELEASE_VERSION = env.APP_RELEASE_VERSION || "local-dev";
export const PUBLIC_FEATURE_FLAGS = Object.freeze(env.PUBLIC_FEATURE_FLAGS || {});
// A Sentry DSN is safe to expose client-side by Sentry's own design (the
// public half of a project identifier, not a secret — see
// https://docs.sentry.io/product/sentry-basics/dsn-explainer/), so it lives
// here alongside SUPABASE_URL rather than being treated as a server-only
// secret the way Edge-Function-only API keys are. Left null disables error
// reporting entirely.
export const SENTRY_DSN = env.SENTRY_DSN || null;
export const ELEVENLABS_TTS_FUNCTION_SLUG = env.ELEVENLABS_TTS_FUNCTION_SLUG || env.ALWENDA_TTS_FUNCTION_SLUG || "elevenlabs-tts";
export const TRANSLATE_TRANSCRIBE_FUNCTION_SLUG =
  env.TRANSLATE_TRANSCRIBE_FUNCTION_SLUG || env.ALWENDA_TRANSLATE_TRANSCRIBE_FUNCTION_SLUG || "translate-transcribe";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** The single production-data-safety gate: every seeded/demo/mock fixture
 * export in src/data/mockData.js is conditioned on this, never on a
 * comment or a developer remembering to strip demo content before
 * shipping. False for every environment except an explicitly-configured
 * "development" or "test". */
export function isFixturesAllowed() {
  return computeIsFixturesAllowed(APP_ENV);
}

export function isProductionEnvironment() {
  return APP_ENV === "production";
}

export function getRuntimeConfigDiagnostics() {
  return {
    appEnv: APP_ENV,
    appEnvWasExplicit: APP_ENV_WAS_EXPLICIT,
    fixturesAllowed: isFixturesAllowed(),
    releaseVersion: APP_RELEASE_VERSION,
    supabaseConfigured: isSupabaseConfigured(),
    hasSupabaseUrl: Boolean(SUPABASE_URL),
    hasSupabasePublishableKey: Boolean(SUPABASE_PUBLISHABLE_KEY),
    sentryConfigured: Boolean(SENTRY_DSN),
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
  if (!diagnostics.appEnvWasExplicit) warnings.push(`APP_ENV was not explicitly set and defaulted to '${APP_ENV}'. Set APP_ENV explicitly in env.js.`);
  return { ok: warnings.length === 0, warnings, diagnostics };
}
