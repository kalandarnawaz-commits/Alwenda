import { ELEVENLABS_TTS_FUNCTION_SLUG, SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "../config.js";
import { getSupabaseAccessToken } from "./auth/supabaseClient.js";
import { AlwendaDataError, DATA_ERROR_CODES, toDataError } from "./dataErrors.js";

export const MAX_TRANSLATION_SPEECH_CHARACTERS = 1000;
const REQUEST_TIMEOUT_MS = 25000;

let activeAudio = null;
let activeObjectUrl = null;
let activeController = null;
let activeRequest = null;

export class TranslationVoiceError extends AlwendaDataError {}

export function getElevenLabsTtsEndpoint() {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/functions/v1/${ELEVENLABS_TTS_FUNCTION_SLUG}`;
}

export function validateTranslationSpeechText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new TranslationVoiceError(DATA_ERROR_CODES.INVALID_INPUT, "There is no translated text to speak.", {
      status: 400,
      retryable: false
    });
  }
  if (trimmed.length > MAX_TRANSLATION_SPEECH_CHARACTERS) {
    throw new TranslationVoiceError(DATA_ERROR_CODES.INVALID_INPUT, `Keep spoken translations under ${MAX_TRANSLATION_SPEECH_CHARACTERS} characters.`, {
      status: 400,
      retryable: false
    });
  }
  return trimmed;
}

function cleanupActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load?.();
  }
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeAudio = null;
  activeObjectUrl = null;
}

export function stopTranslationSpeech() {
  activeController?.abort();
  activeController = null;
  activeRequest = null;
  cleanupActiveAudio();
}

function voiceErrorForStatus(status, message) {
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
  return new TranslationVoiceError(code, message || "Could not play this translation right now.", { status });
}

async function readErrorPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function playAudioElement(audio, onStateChange) {
  return new Promise((resolve, reject) => {
    const finish = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      cleanupActiveAudio();
      onStateChange?.("stopped");
      resolve(null);
    };
    const onEnded = () => finish();
    const onError = () => {
      cleanupActiveAudio();
      onStateChange?.("error");
      reject(new TranslationVoiceError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Browser playback failed. Please try again.", { status: 502 }));
    };
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    onStateChange?.("playing");
    audio.play().catch((error) => {
      cleanupActiveAudio();
      onStateChange?.("error");
      reject(new TranslationVoiceError(DATA_ERROR_CODES.INVALID_INPUT, "Playback was blocked by the browser. Tap Speak again.", {
        status: "playback_blocked",
        retryable: true,
        cause: error
      }));
    });
  });
}

/**
 * @param {{ text?: string, onStateChange?: (status: "loading" | "playing" | "stopped" | "error") => void }} [options]
 */
export async function speakTranslatedText(options = {}) {
  const { text, onStateChange } = options;
  try {
    const trimmed = validateTranslationSpeechText(text);
    if (activeRequest) {
      throw new TranslationVoiceError(DATA_ERROR_CODES.RATE_LIMITED, "Speech is already being prepared.", { status: 429 });
    }
    if (!isSupabaseConfigured()) {
      throw new TranslationVoiceError(DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING, "Speech playback is not configured for this build.", { status: 503 });
    }
    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      throw new TranslationVoiceError(DATA_ERROR_CODES.UNAUTHENTICATED, "Please sign in to hear translations aloud.", { status: 401 });
    }

    stopTranslationSpeech();
    activeController = new AbortController();
    const controller = activeController;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    onStateChange?.("loading");

    activeRequest = fetch(getElevenLabsTtsEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {})
      },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal
    });

    let response;
    try {
      response = await activeRequest;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new TranslationVoiceError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Speech playback is taking too long. Please try again.", {
          status: 504,
          retryable: true
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      activeRequest = null;
      activeController = null;
    }

    if (!response.ok) {
      const payload = await readErrorPayload(response);
      throw voiceErrorForStatus(response.status, payload?.error);
    }

    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().startsWith("audio/")) {
      throw new TranslationVoiceError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Speech service returned an invalid response.", { status: 502 });
    }

    const blob = await response.blob();
    if (!blob.size) {
      throw new TranslationVoiceError(DATA_ERROR_CODES.SUPABASE_UNAVAILABLE, "Speech service returned no audio.", { status: 502 });
    }

    activeObjectUrl = URL.createObjectURL(blob);
    activeAudio = new Audio(activeObjectUrl);
    await playAudioElement(activeAudio, onStateChange);
  } catch (error) {
    activeRequest = null;
    activeController = null;
    if (error instanceof TranslationVoiceError) throw error;
    throw toDataError(error, DATA_ERROR_CODES.SUPABASE_UNAVAILABLE);
  }
}
