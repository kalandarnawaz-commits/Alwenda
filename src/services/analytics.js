/**
 * The typed product-analytics event schema. A fixed enum of event names,
 * each mapped to its required payload shape — every trackEvent() call is
 * validated against this before it ships anywhere, so a typo'd event name
 * or a malformed payload is caught at the call site instead of silently
 * producing unusable analytics data later.
 *
 * Every event name below is a real, already-existing call site in
 * src/main.js (found by grep across the whole file), plus two new ones
 * this task added: business_contacted and session_started — needed to
 * answer "was an onboarded business viewed/contacted" and "did a user
 * come back in week 2", which nothing previously tracked at all.
 *
 * Field types: "string" | "number" | "boolean". A field name suffixed
 * with "?" is optional. Extra keys not listed for an event are rejected —
 * this is what makes the schema a real contract, not just documentation.
 */
export const ANALYTICS_EVENTS = Object.freeze({
  PUBLIC_PROFILE_VIEWED: "public_profile_viewed",
  BUSINESS_EDITED: "business_edited",
  BUSINESS_BOOST_ENABLED: "business_boost_enabled",
  BUSINESS_BOOST_DISABLED: "business_boost_disabled",
  BUSINESS_VIEWED: "business_viewed",
  BUSINESS_CONTACTED: "business_contacted",
  BUSINESS_CLAIM_SUBMITTED: "business_claim_submitted",
  APP_INSTALLED: "app_installed",
  SESSION_STARTED: "session_started",
  SIGN_UP_STARTED: "sign_up_started",
  SIGN_IN_STARTED: "sign_in_started",
  SIGN_IN: "sign_in",
  SIGN_OUT: "sign_out",
  PROFILE_COMPLETED: "profile_completed",
  ALWEN_CHAT_SUCCEEDED: "alwen_chat_succeeded",
  ALWEN_CHAT_FAILED: "alwen_chat_failed",
  HELP_REQUEST_POSTED: "help_request_posted",
  LISTING_CREATED: "listing_created",
  TRANSLATION_COMPLETED: "translation_completed",
  IDENTITY_VERIFICATION_PREPARED: "identity_verification_prepared",
  SEARCH_PERFORMED: "search_performed",
  TYT_OPENED: "tyt_opened",
  PLACE_SAVED: "place_saved",
  PLACE_SHARED: "place_shared",
  POST_SHARED: "post_shared",
  COMMUNITY_POST_CREATED: "community_post_created",
  PROFILE_SHARED: "profile_shared",
  CALL_CLICKED: "call_clicked",
  DIRECTIONS_CLICKED: "directions_clicked",
  WEBSITE_CLICKED: "website_clicked"
});

const SCHEMA = {
  [ANALYTICS_EVENTS.PUBLIC_PROFILE_VIEWED]: { context: "string" },
  [ANALYTICS_EVENTS.BUSINESS_EDITED]: { businessId: "string" },
  [ANALYTICS_EVENTS.BUSINESS_BOOST_ENABLED]: { businessId: "string" },
  [ANALYTICS_EVENTS.BUSINESS_BOOST_DISABLED]: { businessId: "string" },
  [ANALYTICS_EVENTS.BUSINESS_VIEWED]: { businessId: "string", category: "string?" },
  [ANALYTICS_EVENTS.BUSINESS_CONTACTED]: { businessId: "string" },
  [ANALYTICS_EVENTS.BUSINESS_CLAIM_SUBMITTED]: { businessId: "string" },
  [ANALYTICS_EVENTS.APP_INSTALLED]: {},
  [ANALYTICS_EVENTS.SESSION_STARTED]: {},
  [ANALYTICS_EVENTS.SIGN_UP_STARTED]: { provider: "string" },
  [ANALYTICS_EVENTS.SIGN_IN_STARTED]: { provider: "string" },
  [ANALYTICS_EVENTS.SIGN_IN]: { method: "string" },
  [ANALYTICS_EVENTS.SIGN_OUT]: {},
  [ANALYTICS_EVENTS.PROFILE_COMPLETED]: {},
  [ANALYTICS_EVENTS.ALWEN_CHAT_SUCCEEDED]: { messageLength: "number" },
  [ANALYTICS_EVENTS.ALWEN_CHAT_FAILED]: { code: "string" },
  [ANALYTICS_EVENTS.HELP_REQUEST_POSTED]: { hasCategory: "boolean", urgency: "string", source: "string?" },
  [ANALYTICS_EVENTS.LISTING_CREATED]: { category: "string", hasPrice: "boolean" },
  [ANALYTICS_EVENTS.TRANSLATION_COMPLETED]: { from: "string", to: "string", length: "number", chunkCount: "number" },
  [ANALYTICS_EVENTS.IDENTITY_VERIFICATION_PREPARED]: { provider: "string" },
  [ANALYTICS_EVENTS.SEARCH_PERFORMED]: { queryLength: "number", destination: "string?" },
  [ANALYTICS_EVENTS.TYT_OPENED]: {},
  [ANALYTICS_EVENTS.PLACE_SAVED]: { placeId: "string?", listingId: "string?" },
  [ANALYTICS_EVENTS.PLACE_SHARED]: { placeId: "string?", listingId: "string?" },
  [ANALYTICS_EVENTS.POST_SHARED]: { postId: "string" },
  [ANALYTICS_EVENTS.COMMUNITY_POST_CREATED]: { type: "string" },
  [ANALYTICS_EVENTS.PROFILE_SHARED]: {},
  [ANALYTICS_EVENTS.CALL_CLICKED]: { businessId: "string" },
  [ANALYTICS_EVENTS.DIRECTIONS_CLICKED]: { businessId: "string" },
  [ANALYTICS_EVENTS.WEBSITE_CLICKED]: { businessId: "string" }
};

export class AnalyticsSchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "AnalyticsSchemaError";
  }
}

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Validates `props` against the declared shape for `name`. Returns
 * { ok: true } or { ok: false, reason }. Pure — no throwing, no
 * environment-dependent behavior — so callers decide how strict to be.
 */
export function validateEventPayload(name, props = {}) {
  const shape = SCHEMA[name];
  if (!shape) return { ok: false, reason: `Unknown analytics event name "${name}".` };

  for (const [field, type] of Object.entries(shape)) {
    const optional = type.endsWith("?");
    const baseType = optional ? type.slice(0, -1) : type;
    const value = props[field];
    if (value === undefined || value === null) {
      if (!optional) return { ok: false, reason: `"${name}" is missing required field "${field}".` };
      continue;
    }
    if (typeOf(value) !== baseType) {
      return { ok: false, reason: `"${name}" field "${field}" must be a ${baseType}, got ${typeOf(value)}.` };
    }
  }

  const allowedFields = new Set(Object.keys(shape));
  const extra = Object.keys(props).filter((key) => !allowedFields.has(key));
  if (extra.length) return { ok: false, reason: `"${name}" has undeclared field(s): ${extra.join(", ")}.` };

  return { ok: true };
}

const ANONYMOUS_ID_KEY = "alwenda:analytics-anonymous-id";
const SESSION_ID_KEY = "alwenda:analytics-session-id";

function randomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Persists across sessions/tabs on this device — the identity used to
 * cohort pre-login and cross-session activity for retention analysis. */
export function getOrCreateAnonymousId() {
  try {
    const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(ANONYMOUS_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

/** One id per tab/session (sessionStorage, not localStorage) — groups
 * events from a single visit without needing a server-side session table. */
export function getOrCreateSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const created = randomId();
    window.sessionStorage.setItem(SESSION_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

/**
 * Builds the exact row shape public.analytics_events expects. Does not
 * itself write anywhere — callers pass this to recordAnalyticsEvent().
 * @param {string} name @param {object} props
 * @param {{userId?: string|null, appEnv?: string, appRelease?: string}} [options]
 */
export function buildAnalyticsEventRecord(name, props, { userId = null, appEnv, appRelease } = {}) {
  return {
    name,
    props,
    user_id: userId,
    anonymous_id: getOrCreateAnonymousId(),
    session_id: getOrCreateSessionId(),
    app_env: appEnv || null,
    app_release: appRelease || null
  };
}
