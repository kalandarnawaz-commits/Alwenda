import { SUPABASE_ANON_KEY, SUPABASE_URL, TRANSLATE_TRANSCRIBE_FUNCTION_SLUG, isSupabaseConfigured } from "../config.js";
import { getSupabaseAccessToken } from "./auth/supabaseClient.js";
import { AlwendaDataError, DATA_ERROR_CODES, toDataError } from "./dataErrors.js";

export const MAX_TRANSLATION_AUDIO_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;

export class TranslationTranscriptionError extends AlwendaDataError {}

export function getTranslateTranscribeEndpoint() {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/functions/v1/${TRANSLATE_TRANSCRIBE_FUNCTION_SLUG}`;
}

function transcriptionErrorForStatus(status, message) {
  const code =
    status === 401
      ? DATA_ERROR_CODES.UNAUTHENTICATED
      : status === 403
        ? DATA_ERROR_CODES.FORBIDDEN
        : status === 429
          ? DATA_ERROR_CODES.RATE_LIMITED
          : status === 503
            ? DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING
            : status >= 500
              ? DATA_ERROR_CODES.SUPABASE_UNAVAILABLE
              : DATA_ERROR_CODES.INVALID_INPUT;
  return new TranslationTranscriptionError(code, message || "Could not understand the recording. Please try again.", { status });
}

async function readErrorPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function filenameForAudio(audioBlob) {
  const type = String(audioBlob?.type || "");
  if (type.includes("mp4")) return "translation.m4a";
  if (type.includes("mpeg")) return "translation.mp3";
  if (type.includes("wav")) return "translation.wav";
  return "translation.webm";
}

/**
 * @param {{ audioBlob?: Blob, language?: string }} options
 */
export async function transcribeTranslationAudio(options = {}) {
  const { audioBlob, language = "en" } = options;
  try {
    if (!(audioBlob instanceof Blob) || !audioBlob.size) {
      throw new TranslationTranscriptionError(DATA_ERROR_CODES.INVALID_INPUT, "No voice recording was captured.", {
        status: 400,
        retryable: true
      });
    }
    if (audioBlob.size > MAX_TRANSLATION_AUDIO_BYTES) {
      throw new TranslationTranscriptionError(DATA_ERROR_CODES.INVALID_INPUT, "Voice recording is too long. Please try a shorter phrase.", {
        status: 400,
        retryable: true
      });
    }
    if (!isSupabaseConfigured()) {
      throw new TranslationTranscriptionError(DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING, "Voice translation is not configured for this build.", { status: 503 });
    }
    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      throw new TranslationTranscriptionError(DATA_ERROR_CODES.UNAUTHENTICATED, "Please sign in to use voice translation.", { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const formData = new FormData();
    formData.append("audio", audioBlob, filenameForAudio(audioBlob));
    formData.append("language", language);

    let response;
    try {
      response = await fetch(getTranslateTranscribeEndpoint(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {})
        },
        body: formData,
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new TranslationTranscriptionError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Voice translation is taking too long. Please try again.", {
          status: 504,
          retryable: true
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const payload = await readErrorPayload(response);
      throw transcriptionErrorForStatus(response.status, payload?.error);
    }

    const payload = await response.json();
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) {
      throw new TranslationTranscriptionError(DATA_ERROR_CODES.INVALID_INPUT, "Didn't catch that. Please try again.", {
        status: 422,
        retryable: true
      });
    }
    return text;
  } catch (error) {
    if (error instanceof TranslationTranscriptionError) throw error;
    throw toDataError(error, DATA_ERROR_CODES.SUPABASE_UNAVAILABLE);
  }
}
