import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_TEXT_LENGTH = 1000;
const ELEVENLABS_TIMEOUT_MS = 20000;

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

function speechProviderError(status: number) {
  if (status === 401 || status === 403) {
    return jsonError("Speech provider credentials need attention.", 502);
  }
  if (status === 404) {
    return jsonError("Speech voice is not available. Check the configured voice.", 502);
  }
  if (status === 422) {
    return jsonError("Speech provider could not use this text or voice.", 502);
  }
  if (status === 429) {
    return jsonError("Speech playback is busy. Please try again in a moment.", 429);
  }
  return jsonError("Could not generate speech right now.", 502);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed.", 405);

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    return jsonError("Speech playback is not configured yet.", 503);
  }

  const auth = await requireAuthenticatedUser(req.headers.get("Authorization") || "");
  if (auth.response) return auth.response;

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("Text is required.", 400);
  if (text.length > MAX_TEXT_LENGTH) return jsonError(`Text must be ${MAX_TEXT_LENGTH} characters or fewer.`, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        Accept: "audio/mpeg",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2"
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error("[elevenlabs-tts] ElevenLabs request failed", { status: response.status });
      return speechProviderError(response.status);
    }

    const audio = await response.arrayBuffer();
    if (!audio.byteLength) return jsonError("Speech service returned no audio.", 502);

    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return jsonError("Speech playback timed out. Please try again.", 504);
    }
    console.error("[elevenlabs-tts] Unexpected failure", { message: error instanceof Error ? error.message : "unknown" });
    return jsonError("Could not generate speech right now.", 500);
  } finally {
    clearTimeout(timeout);
  }
});
