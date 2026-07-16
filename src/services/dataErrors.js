export const DATA_ERROR_CODES = Object.freeze({
  NETWORK_UNAVAILABLE: "network_unavailable",
  SUPABASE_UNAVAILABLE: "supabase_unavailable",
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "forbidden",
  MISSING_RECORD: "missing_record",
  INVALID_INPUT: "invalid_input",
  RATE_LIMITED: "rate_limited",
  STALE_SESSION: "stale_session",
  PROVIDER_CONFIG_MISSING: "provider_config_missing",
  UNKNOWN: "unknown"
});

/** @type {Set<string>} */
const RETRYABLE_CODES = new Set([
  DATA_ERROR_CODES.NETWORK_UNAVAILABLE,
  DATA_ERROR_CODES.SUPABASE_UNAVAILABLE,
  DATA_ERROR_CODES.RATE_LIMITED,
  DATA_ERROR_CODES.STALE_SESSION
]);

export class AlwendaDataError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ status?: string | number | null, details?: unknown, retryable?: boolean, cause?: unknown }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = "AlwendaDataError";
    this.code = code;
    this.status = options.status || null;
    this.details = options.details || null;
    this.retryable = options.retryable ?? RETRYABLE_CODES.has(code);
    if (options.cause) this.cause = options.cause;
  }
}

function lower(value) {
  return String(value || "").toLowerCase();
}

/**
 * @param {any} error
 * @param {string} [fallbackCode]
 */
export function toDataError(error, fallbackCode = DATA_ERROR_CODES.UNKNOWN) {
  if (error instanceof AlwendaDataError) return error;

  const status = error?.status || error?.code || null;
  const message = error?.message || "Something went wrong.";
  const text = lower(`${error?.name || ""} ${message} ${error?.details || ""} ${error?.hint || ""}`);
  /** @type {string} */
  let code = fallbackCode;

  if (error?.name === "AuthNotConfiguredError" || text.includes("not_configured")) {
    code = DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING;
  } else if (status === 401 || text.includes("jwt expired") || text.includes("session expired")) {
    code = text.includes("expired") ? DATA_ERROR_CODES.STALE_SESSION : DATA_ERROR_CODES.UNAUTHENTICATED;
  } else if (status === 403 || text.includes("permission denied") || text.includes("rls")) {
    code = DATA_ERROR_CODES.FORBIDDEN;
  } else if (status === 404 || error?.code === "PGRST116" || text.includes("no rows")) {
    code = DATA_ERROR_CODES.MISSING_RECORD;
  } else if (status === 400 || status === 422 || text.includes("invalid")) {
    code = DATA_ERROR_CODES.INVALID_INPUT;
  } else if (status === 429 || text.includes("rate limit")) {
    code = DATA_ERROR_CODES.RATE_LIMITED;
  } else if (error instanceof TypeError || text.includes("failed to fetch") || text.includes("network")) {
    code = DATA_ERROR_CODES.NETWORK_UNAVAILABLE;
  } else if (text.includes("supabase") || text.includes("fetch failed")) {
    code = DATA_ERROR_CODES.SUPABASE_UNAVAILABLE;
  }

  return new AlwendaDataError(code, message, { cause: error, status, retryable: RETRYABLE_CODES.has(code) });
}

export function safeErrorPayload(error) {
  const dataError = toDataError(error);
  return {
    name: dataError.name,
    code: dataError.code,
    message: dataError.message,
    status: dataError.status,
    retryable: dataError.retryable
  };
}
