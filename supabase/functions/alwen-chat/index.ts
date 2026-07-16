import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_MESSAGE_LENGTH = 2000;
const HELP_REQUEST_URGENCIES = ["today", "thisWeek", "flexible"];

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
  lawyer, translator, and other everyday professions) -> you can actually post a real
  Hire help-request for them with the create_hire_request tool. Gather the category,
  a clear description, and urgency (today, thisWeek, or flexible) conversationally,
  then summarize what you're about to post in plain text and ask them to confirm
  (e.g. "I'll post: need a cleaner this week in Žvėrynas — shall I?"). Only call
  create_hire_request after the user clearly confirms (yes/go ahead/do it) in their
  next message — never call it speculatively, before confirmation, or more than once
  for the same request.
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

const tools = [
  {
    type: "function",
    name: "create_hire_request",
    description:
      "Creates a real Hire help-request post in Alwenda so professionals can respond and the user can book one in-app. Only call this AFTER the user has explicitly confirmed the summary you gave them in plain text — never call it speculatively or before they say yes.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "The kind of professional needed, e.g. plumber, electrician, cleaner, tutor, babysitter, driver, lawyer, translator, personal trainer, painter, carpenter, mechanic, pet sitter, photographer, accountant, hair stylist, makeup artist, tailor, moving help, delivery."
        },
        description: { type: "string", description: "A clear description of what the user needs, written from the conversation." },
        urgency: { type: "string", enum: HELP_REQUEST_URGENCIES },
        area: { type: "string", description: "Neighbourhood or area if the user mentioned one, otherwise omit." }
      },
      required: ["category", "description", "urgency"],
      additionalProperties: false
    }
  }
];

async function callResponses(input: unknown[]) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "gpt-4.1-mini", input, tools, max_output_tokens: 700 })
  });
  const payload = await response.json();
  if (!response.ok) {
    console.error("[alwen-chat] OpenAI request failed", {
      status: response.status,
      type: payload?.error?.type || "unknown"
    });
    throw new Error("OPENAI_REQUEST_FAILED");
  }
  return payload;
}

function extractAnswerText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
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
    const { data: existingConversation } = await supabase.from("alwen_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!existingConversation) {
      await supabase.from("alwen_conversations").insert({ id: conversationId, user_id: authData.user.id, title: message.slice(0, 80) });
    }

    const { data: priorMessages } = await supabase
      .from("alwen_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    await supabase.from("alwen_messages").insert({ conversation_id: conversationId, user_id: authData.user.id, role: "user", content: message });

    const input: unknown[] = [
      { role: "system", content: systemPrompt(language, city) },
      ...(priorMessages || []).map((row) => ({ role: row.role, content: row.content })),
      { role: "user", content: message }
    ];

    let payload = await callResponses(input);
    const functionCall = (payload.output || []).find((item: { type?: string }) => item.type === "function_call") as
      | { type: string; call_id: string; name: string; arguments: string }
      | undefined;

    let createdHelpRequest: Record<string, unknown> | null = null;

    if (functionCall?.name === "create_hire_request") {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(functionCall.arguments || "{}");
      } catch {
        args = {};
      }

      const category = typeof args.category === "string" ? args.category.trim().slice(0, 80) : "";
      const description = typeof args.description === "string" ? args.description.trim().slice(0, 1000) : "";
      const urgency = typeof args.urgency === "string" && HELP_REQUEST_URGENCIES.includes(args.urgency) ? args.urgency : "flexible";
      const area = typeof args.area === "string" && args.area.trim() ? args.area.trim().slice(0, 120) : null;

      let toolOutput: string;
      if (category && description) {
        const { data: inserted, error: insertError } = await supabase
          .from("help_requests")
          .insert({
            requester_user_id: authData.user.id,
            category,
            description,
            urgency,
            area,
            city,
            created_by_alwen: true
          })
          .select("id, category, description, urgency, area, city")
          .single();

        if (insertError || !inserted) {
          console.error("[alwen-chat] Failed to create help request", insertError);
          toolOutput = JSON.stringify({ status: "error", message: "Could not create the request." });
        } else {
          createdHelpRequest = inserted;
          toolOutput = JSON.stringify({ status: "created", requestId: inserted.id });
        }
      } else {
        toolOutput = JSON.stringify({ status: "error", message: "Missing category or description." });
      }

      const followUpInput = [
        ...input,
        ...(payload.output || []),
        { type: "function_call_output", call_id: functionCall.call_id, output: toolOutput }
      ];
      payload = await callResponses(followUpInput);
    }

    const answer = extractAnswerText(payload);
    if (!answer) return safeError("Alwen returned an empty answer. Please try again.", 502);

    await supabase.from("alwen_messages").insert({ conversation_id: conversationId, user_id: authData.user.id, role: "assistant", content: answer });

    return jsonResponse({ answer, conversationId, ...(createdHelpRequest ? { createdHelpRequest } : {}) });
  } catch (error) {
    if (error instanceof Error && error.message === "OPENAI_REQUEST_FAILED") {
      return safeError("Alwen could not answer right now. Please try again.", 502);
    }
    console.error("[alwen-chat] Unexpected failure", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return safeError("Alwen could not answer right now. Please try again.", 500);
  }
});
