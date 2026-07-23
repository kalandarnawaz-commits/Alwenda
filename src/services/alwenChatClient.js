import { SUPABASE_URL, isSupabaseConfigured } from "../config.js";
import { getSupabaseAccessToken } from "./auth/supabaseClient.js";
import { AlwendaDataError, DATA_ERROR_CODES, toDataError } from "./dataErrors.js";
import { logPilotEvent, OBSERVABILITY_EVENTS } from "./observability.js";

const MAX_MESSAGE_LENGTH = 2000;
// The confirm-then-create flow can make two OpenAI calls server-side (each
// with its own 20s cap — see supabase/functions/alwen-chat), plus several
// database writes. A plain fetch() has no timeout of its own, so without
// this a dropped connection or a stuck request left the "Sending..." state
// spinning indefinitely instead of failing with a clear, retryable error.
const REQUEST_TIMEOUT_MS = 45000;

export class AlwenChatError extends AlwendaDataError {}

export function validateAlwenMessage(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    throw new AlwenChatError(DATA_ERROR_CODES.INVALID_INPUT, "Tell Alwen what you need first.", { status: 400, retryable: false });
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new AlwenChatError(DATA_ERROR_CODES.INVALID_INPUT, `Keep your message under ${MAX_MESSAGE_LENGTH} characters.`, {
      status: 400,
      retryable: false
    });
  }
  return trimmed;
}

export async function sendAlwenMessage({ message, language = "en", city = "Vilnius", conversationId = null, mode = "chat", toLanguage = "auto" }) {
  try {
    const trimmed = validateAlwenMessage(message);
    if (!isSupabaseConfigured()) {
      throw new AlwenChatError(DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING, "Alwen is not configured for this build.", { status: 503 });
    }

    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      throw new AlwenChatError(DATA_ERROR_CODES.UNAUTHENTICATED, "Your session has expired. Please sign in again.", { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/alwen-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ message: trimmed, language, city, conversationId, mode, toLanguage }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new AlwenChatError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Alwen is taking too long to respond. Please try again.", {
          status: 504,
          retryable: true
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorCode =
        response.status === 401
          ? DATA_ERROR_CODES.UNAUTHENTICATED
          : response.status === 503
            ? DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING
            : response.status === 429
              ? DATA_ERROR_CODES.RATE_LIMITED
              : response.status >= 500
                ? DATA_ERROR_CODES.SUPABASE_UNAVAILABLE
                : DATA_ERROR_CODES.INVALID_INPUT;
      throw new AlwenChatError(errorCode, payload?.error || "Alwen could not answer right now.", { status: response.status });
    }

    if (payload?.type === "translation") {
      if (!payload.original || !payload.translated || !payload.detectedLanguage || !payload.targetLanguage) {
        throw new AlwenChatError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Alwen returned an incomplete translation.", { status: 502 });
      }
      return {
        type: "translation",
        original: payload.original,
        translated: payload.translated,
        detectedLanguage: payload.detectedLanguage,
        targetLanguage: payload.targetLanguage,
        conversationId: payload.conversationId || conversationId || null
      };
    }

    if (!payload?.answer) {
      throw new AlwenChatError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Alwen returned an empty response.", { status: 502 });
    }

    return {
      answer: payload.answer,
      conversationId: payload.conversationId || conversationId || null,
      createdHelpRequest: payload.createdHelpRequest || null,
      createdListing: payload.createdListing || null
    };
  } catch (error) {
    logPilotEvent(OBSERVABILITY_EVENTS.ALWEN_FAILURE, { context: "sendAlwenMessage", error }, { severity: "error" });
    if (error instanceof AlwenChatError) throw error;
    throw toDataError(error, DATA_ERROR_CODES.SUPABASE_UNAVAILABLE);
  }
}
