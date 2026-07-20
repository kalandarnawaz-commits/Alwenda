import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const OPENAI_TIMEOUT_MS = 30000;
const SUPPORTED_LANGUAGES = new Set(["lt", "en", "ru", "pl", "de", "fr"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function requireAuthenticatedUser(authorization: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { response: jsonError("Supabase authentication is not configured for this function.", 503), user: null };
  }
  if (!authorization.startsWith("Bearer ")) {
    return { response: jsonError("Authentication required.", 401), user: null };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { response: jsonError("Authentication required.", 401), user: null };
  }
  return { response: null, user: data.user };
}

function normalizeLanguage(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.toLowerCase().slice(0, 16) : "en";
  const base = raw.split("-")[0];
  return SUPPORTED_LANGUAGES.has(base) ? base : "en";
}

function openAiError(status: number) {
  if (status === 401 || status === 403) return jsonError("Voice transcription credentials need attention.", 502);
  if (status === 413 || status === 422) return jsonError("Could not use this voice recording. Please try a shorter phrase.", 422);
  if (status === 429) return jsonError("Voice translation is busy. Please try again in a moment.", 429);
  return jsonError("Could not understand the recording right now.", 502);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed.", 405);

  if (!OPENAI_API_KEY) {
    return jsonError("Voice transcription is not configured yet.", 503);
  }

  const auth = await requireAuthenticatedUser(req.headers.get("Authorization") || "");
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError("Request body must be multipart form data.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File) || !audio.size) return jsonError("Audio recording is required.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return jsonError("Audio recording is too large.", 400);

  const language = normalizeLanguage(formData.get("language"));
  const openAiBody = new FormData();
  openAiBody.append("file", audio, audio.name || "translation.webm");
  openAiBody.append("model", "whisper-1");
  openAiBody.append("language", language);
  openAiBody.append("response_format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: openAiBody,
      signal: controller.signal
    });

    let payload: { text?: string; error?: { type?: string } } = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      console.error("[translate-transcribe] OpenAI request failed", {
        status: response.status,
        type: payload?.error?.type || "unknown"
      });
      return openAiError(response.status);
    }

    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) return jsonError("Didn't catch that. Please try again.", 422);
    return jsonResponse({ text });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError("Voice transcription timed out. Please try again.", 504);
    }
    console.error("[translate-transcribe] Unexpected failure", { message: error instanceof Error ? error.message : "unknown" });
    return jsonError("Could not understand the recording right now.", 500);
  } finally {
    clearTimeout(timeout);
  }
});
