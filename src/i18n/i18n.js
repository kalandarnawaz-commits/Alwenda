/**
 * i18n runtime — architecture built to scale from 2 languages to dozens
 * without touching any component code. Adding a language means: drop a
 * new /locales/xx.json file and add one entry to SUPPORTED_LANGUAGES.
 * Nothing else changes.
 *
 * - Translations live in locale JSON files (/locales/xx.json), loaded on
 *   demand via fetch() and cached in memory for the session.
 * - Keys are dot-path namespaced (e.g. "auth.signInCta") and resolved
 *   against a nested object — see buildLocale in the migration script
 *   under scratchpad for how the flat legacy keys were namespaced.
 * - Fallback chain: requested language -> English -> the raw key string,
 *   with a console.warn on every fallback so missing translations are
 *   loud in development instead of silently shipping mixed-language UI.
 * - {param} tokens inside a string are interpolated from the params
 *   object passed to t() — no scattered .replace() calls at call sites.
 * - RTL is handled generically: any language in RTL_LANGUAGES flips
 *   `dir` on <html>; layout mirroring is expected to come from CSS
 *   logical properties, not per-language component branches.
 */

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", bcp47: "en-GB", flag: "🇬🇧" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", bcp47: "lt-LT", flag: "🇱🇹" },
  { code: "de", name: "German", nativeName: "Deutsch", bcp47: "de-DE", flag: "🇩🇪" }
];

export const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

const FALLBACK_LANGUAGE = "en";
const LOCALE_ASSET_VERSION = "elevenlabs-tts-1";
const localeCache = new Map();
let currentLanguage = FALLBACK_LANGUAGE;

function resolvePath(obj, dotPath) {
  let cur = obj;
  for (const segment of dotPath.split(".")) {
    if (cur == null || typeof cur !== "object" || !(segment in cur)) return undefined;
    cur = cur[segment];
  }
  return cur;
}

function interpolate(template, params) {
  if (!params || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Fetches and caches a locale's JSON. Safe to call repeatedly — later
 * calls for an already-loaded language resolve instantly from cache. */
export async function loadLocale(code) {
  if (localeCache.has(code)) return localeCache.get(code);
  try {
    const response = await fetch(`/locales/${code}.json?v=${LOCALE_ASSET_VERSION}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    localeCache.set(code, data);
    return data;
  } catch (error) {
    console.warn(`[i18n] Failed to load locale "${code}":`, error);
    return null;
  }
}

/** Ensures a language is loaded and active. Always guarantees English is
 * also loaded, since it's the fallback for every other language. */
export async function setLanguage(code) {
  await Promise.all([loadLocale(code), loadLocale(FALLBACK_LANGUAGE)]);
  currentLanguage = code;
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
    document.documentElement.dir = RTL_LANGUAGES.has(code) ? "rtl" : "ltr";
  }
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function currentLocaleTag() {
  const entry = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage);
  return entry?.bcp47 || currentLanguage;
}

/**
 * Resolves a namespaced key against the active locale, falling back to
 * English, then to the key itself — always logging a warning when a
 * fallback happens so gaps surface immediately in development instead of
 * shipping a silently mixed-language screen.
 */
export function t(key, params) {
  const active = localeCache.get(currentLanguage);
  const fromActive = active ? resolvePath(active, key) : undefined;
  if (fromActive !== undefined) return interpolate(fromActive, params);

  if (currentLanguage !== FALLBACK_LANGUAGE) {
    const fallback = localeCache.get(FALLBACK_LANGUAGE);
    const fromFallback = fallback ? resolvePath(fallback, key) : undefined;
    if (fromFallback !== undefined) {
      console.warn(`[i18n] Missing "${key}" in "${currentLanguage}" — using English fallback.`);
      return interpolate(fromFallback, params);
    }
  }

  console.warn(`[i18n] Missing translation key "${key}" in every loaded locale.`);
  return key;
}

/** Locale-aware date formatting — follows the active language, not the
 * browser's own locale, so switching in-app language changes date shapes
 * too (July 9, 2026 vs 2026 m. liepos 9 d. vs 09.07.2026). */
/** @param {Intl.DateTimeFormatOptions} [options] */
export function formatDate(value, options = { dateStyle: "medium" }) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(currentLocaleTag(), options).format(date);
}

export function formatNumber(value, options) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(currentLocaleTag(), options).format(value);
}

export function formatCurrency(amount, currency = "EUR") {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat(currentLocaleTag(), { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/** Locale-aware distance formatting — "m"/"km" are the same abbreviation
 * across every currently-supported language, but the number itself isn't
 * (1.6 km in English vs 1,6 km in Lithuanian/German), so this still needs
 * to go through Intl.NumberFormat rather than a hardcoded .toFixed(). */
export function formatDistanceMeters(meters) {
  if (meters == null || !Number.isFinite(meters)) return "";
  if (meters < 1000) return `${formatNumber(Math.round(meters / 10) * 10)} m`;
  return `${formatNumber(meters / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
