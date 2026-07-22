import { APP_ENV, APP_RELEASE_VERSION } from "../config.js";
import { safeErrorPayload } from "./dataErrors.js";

export const OBSERVABILITY_EVENTS = Object.freeze({
  ROUTE_ERROR: "route_error",
  SUPABASE_FAILURE: "supabase_failure",
  AUTH_EVENT: "auth_event",
  OAUTH_ERROR: "oauth_error",
  PROFILE_BOOTSTRAP_FAILURE: "profile_bootstrap_failure",
  BUSINESS_IMPORT_FAILURE: "business_import_failure",
  ALWEN_FAILURE: "alwen_failure",
  JS_EXCEPTION: "js_exception",
  UNHANDLED_REJECTION: "unhandled_rejection"
});

const SENSITIVE_KEY_PATTERN = /(password|otp|token|secret|authorization|cookie|session|key|message|body)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\s().-]?){7,}\d/g;

function redactString(value) {
  return value.replace(EMAIL_PATTERN, "[redacted-email]").replace(PHONE_PATTERN, "[redacted-phone]");
}

export function sanitizeDetails(value, depth = 0) {
  if (depth > 5) return "[redacted-depth]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) return safeErrorPayload(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeDetails(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 50)
      .map(([key, item]) => [key, SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeDetails(item, depth + 1)])
  );
}

export function createLogEvent(type, details = {}, severity = "info") {
  return {
    type,
    severity,
    app: "Alwenda",
    environment: APP_ENV,
    releaseVersion: APP_RELEASE_VERSION,
    occurredAt: new Date().toISOString(),
    details: sanitizeDetails(details)
  };
}

let activeSink = null;

/** Set once at boot (see main.js) so every logPilotEvent() call across the
 * app reaches Sentry without every call site having to pass its own sink.
 * Left null when SENTRY_DSN isn't configured — logPilotEvent then falls
 * back to console, unchanged from before this integration existed. */
export function configureErrorSink(sink) {
  activeSink = typeof sink === "function" ? sink : null;
}

export function logPilotEvent(type, details = {}, options = {}) {
  const event = createLogEvent(type, details, options.severity || "info");
  const sink = options.sink || activeSink;
  if (typeof sink === "function") {
    Promise.resolve(sink(event)).catch(() => {
      /* the error sink must never itself crash the app or create a report loop */
    });
    return event;
  }
  if (typeof console !== "undefined") {
    const method = event.severity === "error" ? "error" : event.severity === "warn" ? "warn" : "debug";
    console[method]("[Alwenda]", event);
  }
  return event;
}

/**
 * A minimal Sentry ingestion client using plain fetch — no SDK dependency,
 * matching this repo's zero-npm-runtime-dependency convention (see
 * googlePlacesApiClient.js, translateSpeechClient.js). Implements Sentry's
 * documented envelope endpoint directly: https://develop.sentry.dev/sdk/data-model/envelopes/
 *
 * `dsn` is the standard `https://<publicKey>@<host>/<projectId>` string —
 * safe to expose client-side by Sentry's own design (same trust tier as a
 * Supabase publishable key), so it's read from env.js like SUPABASE_URL,
 * never treated as a server-only secret.
 */
/** @param {{dsn?: string|null, fetchImpl?: typeof fetch, release?: string, environment?: string}} [options] */
export function createSentrySink({ dsn, fetchImpl = typeof fetch === "function" ? fetch : undefined, release, environment } = {}) {
  if (!dsn) return null;
  let parsed;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) throw new Error("malformed DSN");
    parsed = { publicKey: url.username, host: url.host, projectId };
  } catch {
    console.warn("[Alwenda] SENTRY_DSN is set but not a valid Sentry DSN — error events will only log to console.");
    return null;
  }

  const ingestUrl = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  return async function sentrySink(event) {
    if (!fetchImpl) return;
    const eventId = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, "");
    const sentAt = new Date().toISOString();
    const sentryEvent = {
      event_id: eventId,
      timestamp: Math.floor(Date.now() / 1000),
      platform: "javascript",
      level: event.severity === "error" ? "error" : event.severity === "warn" ? "warning" : "info",
      environment: environment || event.environment,
      release: release || event.releaseVersion,
      logger: "alwenda.observability",
      message: { formatted: event.type },
      extra: { details: event.details, app: event.app, occurredAt: event.occurredAt }
    };
    const body = [
      JSON.stringify({ event_id: eventId, sent_at: sentAt }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(sentryEvent)
    ].join("\n");

    try {
      await fetchImpl(ingestUrl, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body });
    } catch {
      /* a failed error report must never itself throw */
    }
  };
}

export function bindGlobalErrorObservers(logger = logPilotEvent) {
  if (typeof window === "undefined" || /** @type {any} */ (window).__ALWENDA_OBSERVABILITY_BOUND__) return () => {};
  /** @type {any} */ (window).__ALWENDA_OBSERVABILITY_BOUND__ = true;

  const onError = (event) =>
    logger(OBSERVABILITY_EVENTS.JS_EXCEPTION, {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error
    }, { severity: "error" });

  const onRejection = (event) =>
    logger(OBSERVABILITY_EVENTS.UNHANDLED_REJECTION, { reason: event.reason }, { severity: "error" });

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    /** @type {any} */ (window).__ALWENDA_OBSERVABILITY_BOUND__ = false;
  };
}
