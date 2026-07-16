import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_MESSAGE_LENGTH = 2000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function safeError(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

function systemPrompt(language: string, city: string) {
  return `
You are Alwen, the secure city intelligence layer inside Alwenda, a city super-app.
Current city: ${city || "Vilnius"}.
Preferred language: ${language || "en"}.

Alwenda is the only place you help the user act — never send them to an outside site,
app, or search engine (no Google Maps, no Skelbiu.lt/Paslaugos.lt, no generic "search
online for..."). Everything the user might need has an equivalent inside Alwenda:

- Needs a service done (plumber, electrician, cleaner, tutor, babysitter, driver,
  lawyer, translator, and other everyday professions) -> point them to Hire, and offer
  to help them post a request there (describe the need, pros respond, then book/pay
  in-app).
- Wants to buy, sell, or rent something -> point them to Marketplace.
- Wants to ask neighbours a question, share a recommendation, offer something for
  free, or post a lost & found alert -> point them to Community.
- Wants to earn money with small paid tasks, or offer their own time/skills -> point
  them to TYT (Trade Your Time).
- Wants a real nearby place — pharmacy, restaurant, café, clinic, gym, shop, etc. ->
  these are real imported places already in Alwenda's Explore data for this city;
  answer directly from what you know about the city instead of deferring elsewhere,
  and mention they can open Explore for the full, filterable list.

If you don't have enough detail to answer well (e.g. their exact neighbourhood), ask
one clarifying question rather than guessing or suggesting they look it up elsewhere.

Keep answers concise, useful, and warm.
If the user writes in Lithuanian, answer in Lithuanian.
Do not claim you booked, paid, reserved, contacted, or changed anything unless an integrated tool confirms it.
Do not ask for passwords, OTPs, private keys, full payment details, or unnecessary sensitive information.
`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return safeError("Method not allowed.", 405);

  if (!OPENAI_API_KEY) {
    return safeError("Alwen is not configured yet.", 503);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return safeError("Supabase authentication is not configured for this function.", 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return safeError("Authentication required.", 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return safeError("Authentication required.", 401);
  }

  let body: {
    message?: unknown;
    language?: unknown;
    city?: unknown;
    conversationId?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return safeError("Request body must be valid JSON.", 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const language = typeof body.language === "string" ? body.language.slice(0, 24) : "en";
  const city = typeof body.city === "string" ? body.city.slice(0, 80) : "Vilnius";
  const conversationId = typeof body.conversationId === "string" && body.conversationId.trim() ? body.conversationId.trim() : crypto.randomUUID();

  if (!message) return safeError("A message is required.", 400);
  if (message.length > MAX_MESSAGE_LENGTH) return safeError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, 400);

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: systemPrompt(language, city) },
          { role: "user", content: message }
        ],
        max_output_tokens: 700
      })
    });

    const openaiPayload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      console.error("[alwen-chat] OpenAI request failed", {
        status: openaiResponse.status,
        type: openaiPayload?.error?.type || "unknown"
      });
      return safeError("Alwen could not answer right now. Please try again.", 502);
    }

    const answer =
      typeof openaiPayload.output_text === "string"
        ? openaiPayload.output_text
        : openaiPayload.output
            ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
            .map((content: { text?: string }) => content.text || "")
            .join("")
            .trim();

    if (!answer) return safeError("Alwen returned an empty answer. Please try again.", 502);

    return jsonResponse({ answer, conversationId });
  } catch (error) {
    console.error("[alwen-chat] Unexpected failure", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return safeError("Alwen could not answer right now. Please try again.", 500);
  }
});
