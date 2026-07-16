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

export function logPilotEvent(type, details = {}, options = {}) {
  const event = createLogEvent(type, details, options.severity || "info");
  if (typeof options.sink === "function") return options.sink(event);
  if (typeof console !== "undefined") {
    const method = event.severity === "error" ? "error" : event.severity === "warn" ? "warn" : "debug";
    console[method]("[Alwenda]", event);
  }
  return event;
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
