import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_MESSAGE_LENGTH = 2000;

// Per-user throttling beyond Supabase's own platform-level Edge Function
// limits — both configurable via Edge Function secrets so they can be
// tuned without a redeploy of the function's logic.
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get("ALWEN_CHAT_RATE_LIMIT_PER_MINUTE")) || 8;
const DAILY_COST_CAP_USD = Number(Deno.env.get("ALWEN_CHAT_DAILY_COST_CAP_USD")) || 2;

// gpt-4.1-mini pricing verified against OpenAI's published rates on
// 2026-04-18: $0.40 / 1M input tokens, $1.60 / 1M output tokens. Re-verify
// against the OpenAI dashboard before relying on this for real budgeting —
// token pricing changes over time and this is not fetched live.
const INPUT_TOKEN_USD_PER_MILLION = 0.40;
const OUTPUT_TOKEN_USD_PER_MILLION = 1.60;

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_TOKEN_USD_PER_MILLION + (outputTokens / 1_000_000) * OUTPUT_TOKEN_USD_PER_MILLION;
}

// A basic, explicitly-not-a-guarantee heuristic screen for the clearest
// prompt-injection attempts, run on the raw user message before it ever
// reaches OpenAI. High-confidence matches are rejected outright rather
// than silently stripped, so the user gets a clear "please rephrase"
// instead of a subtly-altered request.
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|prior\s+)?instructions/i,
  /disregard\s+(all\s+|the\s+)?(rules|instructions|guidelines)/i,
  /reveal\s+(your\s+|the\s+)?(system\s+prompt|instructions)/i,
  /you\s+are\s+(now|no\s+longer)\s+/i,
  /act\s+as\s+(if\s+you\s+(are|were)|a)\s+/i,
  /\bdan\s+mode\b/i,
  /developer\s+mode/i,
  /\bjailbreak\b/i
];

function looksLikePromptInjection(message: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

// Alwen 2.0 — translation is a native Alwen-chat capability (mode:
// "translate"), not a second AI backend. A translate-mode call never
// injects prior conversation history (each translation is a self-
// contained request) and never exposes the create_hire_request/
// create_marketplace_listing tools — it asks for one thing only.
const SUPPORTED_TRANSLATE_LANGUAGES = ["en", "lt"];

// Phase 13 context control — chat mode never sends unbounded history to
// OpenAI, only the most recent turns.
const MAX_CONTEXT_MESSAGES = 10;

function normalizeTranslateLanguage(value: unknown): string {
  return typeof value === "string" && SUPPORTED_TRANSLATE_LANGUAGES.includes(value) ? value : "auto";
}

function translateSystemPrompt(toLanguage: string): string {
  const target = toLanguage === "auto" ? "the other of English or Lithuanian (whichever the message is NOT already in)" : toLanguage === "lt" ? "Lithuanian" : "English";
  return `
You are Alwen's translation engine inside Alwenda, serving the Vilnius pilot — English and Lithuanian only.

Detect the language of the user's message automatically (it will be English or Lithuanian). Translate it into ${target}. Never translate a message into the same language it is already written in.

Respond with ONLY a single JSON object — no prose, no markdown code fences, no explanation before or after it — in exactly this shape:
{"type":"translation","original":"<the user's exact original text, unchanged>","translated":"<your translation>","detectedLanguage":"<'en' or 'lt'>","targetLanguage":"<'en' or 'lt'>"}
`;
}

function parseTranslationResponse(rawText: string): { original: string; translated: string; detectedLanguage: string; targetLanguage: string } | null {
  const cleaned = rawText.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed.original === "string" &&
      typeof parsed.translated === "string" &&
      SUPPORTED_TRANSLATE_LANGUAGES.includes(parsed.detectedLanguage) &&
      SUPPORTED_TRANSLATE_LANGUAGES.includes(parsed.targetLanguage)
    ) {
      return { original: parsed.original, translated: parsed.translated, detectedLanguage: parsed.detectedLanguage, targetLanguage: parsed.targetLanguage };
    }
    return null;
  } catch {
    return null;
  }
}

const HELP_REQUEST_URGENCIES = ["today", "thisWeek", "flexible"];
const LISTING_CATEGORIES = ["buy_sell", "rentals", "jobs", "local_services", "vehicles", "property"];
const LISTING_PRICE_PERIODS = ["one_time", "hour", "day", "month", "quote"];
const LISTING_CONDITIONS = ["new", "likeNew", "good", "fair", "used"];

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
- Wants to buy, sell, or rent something -> you can actually post a real Marketplace
  listing for them with the create_marketplace_listing tool, using the exact same
  gather-summarize-confirm pattern as create_hire_request above. Never call it before
  the user has explicitly confirmed the summary.
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
  },
  {
    type: "function",
    name: "create_marketplace_listing",
    description:
      "Creates a real Marketplace listing in Alwenda so buyers/renters can find and contact the seller in-app. Only call this AFTER the user has explicitly confirmed the summary you gave them in plain text — never call it speculatively or before they say yes.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "A short, clear listing title, e.g. 'Trek mountain bike, barely used'." },
        description: { type: "string", description: "A fuller description written from the conversation — condition, size, reason for selling, etc." },
        category: {
          type: "string",
          enum: LISTING_CATEGORIES,
          description: "buy_sell (general items), rentals, jobs, local_services, vehicles, or property."
        },
        priceAmount: { type: "number", description: "The asking price as a plain number, e.g. 150. Omit if the user wants to ask for quotes instead." },
        pricePeriod: { type: "string", enum: LISTING_PRICE_PERIODS, description: "one_time for a sale, hour/day/month for a rental rate, quote if no fixed price." },
        area: { type: "string", description: "Neighbourhood or area if the user mentioned one, otherwise omit." },
        condition: { type: "string", enum: LISTING_CONDITIONS, description: "Only for physical items being sold — omit for rentals/jobs/services." },
        pickupAvailable: { type: "boolean", description: "True if the user said the buyer can pick it up in person." },
        deliveryAvailable: { type: "boolean", description: "True if the user said they can deliver it." },
        offerorStatus: { type: "string", enum: ["private", "trader"], description: "Required declaration from the user: private for a private seller/provider, trader for a trader/business. Ask the user and do not infer it." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "A few short keywords buyers might search for, e.g. ['bike', 'mountain', 'trek']. Omit if nothing obvious."
        }
      },
      required: ["title", "description", "category", "offerorStatus"],
      additionalProperties: false
    }
  }
];

const OPENAI_TIMEOUT_MS = 20000;

// This confirm-then-create flow can make this call twice in one request
// (once to decide whether to call create_hire_request, once more with the
// tool's result to get the final confirmation text), and a plain fetch()
// has no timeout of its own — if OpenAI ever stalls, the whole request
// would otherwise hang indefinitely with no feedback to the user instead
// of failing with a clear, bounded error.
async function callResponses(input: unknown[], toolsForCall: unknown[] | undefined = tools) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: "gpt-4.1-mini", input, ...(toolsForCall ? { tools: toolsForCall } : {}), max_output_tokens: 700 }),
      signal: controller.signal
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
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[alwen-chat] OpenAI request timed out", { timeoutMs: OPENAI_TIMEOUT_MS });
      throw new Error("OPENAI_REQUEST_FAILED");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
    mode?: unknown;
    toLanguage?: unknown;
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
  const mode = body.mode === "translate" ? "translate" : "chat";
  const toLanguage = normalizeTranslateLanguage(body.toLanguage);

  if (!message) return safeError("A message is required.", 400);
  if (message.length > MAX_MESSAGE_LENGTH) return safeError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, 400);

  // A basic heuristic, not a guarantee — high-confidence matches are
  // rejected before any OpenAI call is made (and before any quota is
  // spent), and logged to alwen_chat_usage with flagged_injection=true
  // for later review.
  if (looksLikePromptInjection(message)) {
    await supabase.from("alwen_chat_usage").insert({ user_id: authData.user.id, conversation_id: conversationId, flagged_injection: true }).then(() => {}, () => {});
    return safeError("Alwen couldn't process that message. Please rephrase what you need help with.", 400);
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentRequestCount } = await supabase
    .from("alwen_chat_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authData.user.id)
    .gte("created_at", oneMinuteAgo);
  if ((recentRequestCount || 0) >= RATE_LIMIT_PER_MINUTE) {
    return safeError("You're sending messages faster than Alwen can keep up. Please wait a moment and try again.", 429);
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: todaysUsage } = await supabase
    .from("alwen_chat_usage")
    .select("estimated_cost_usd")
    .eq("user_id", authData.user.id)
    .gte("created_at", todayStart.toISOString());
  const spentTodayUsd = (todaysUsage || []).reduce((sum, row) => sum + (Number(row.estimated_cost_usd) || 0), 0);
  if (spentTodayUsd >= DAILY_COST_CAP_USD) {
    return safeError("You've reached today's usage limit for Alwen. Please try again tomorrow.", 429);
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const trackUsage = (payload: { usage?: { input_tokens?: number; output_tokens?: number } }) => {
    totalInputTokens += payload.usage?.input_tokens || 0;
    totalOutputTokens += payload.usage?.output_tokens || 0;
  };

  try {
    const { data: existingConversationForMode } = await supabase.from("alwen_conversations").select("id").eq("id", conversationId).maybeSingle();

    // Translation is a native Alwen-chat capability, not a second AI
    // backend or a separate architecture — same edge function, same
    // rate-limit/cost-ceiling/injection-screen/usage-logging above, just a
    // different, single-purpose system prompt and no prior-turn context
    // (each translation is a self-contained request, unlike chat mode).
    if (mode === "translate") {
      // A translate-mode call is a single self-contained turn, not
      // necessarily live two-way mode (that's a client-side conversation
      // toggle, set explicitly via updateAlwenConversationMode) — so a
      // brand-new conversation created here keeps the normal "chat" mode
      // default rather than assuming liveTranslate.
      const persistUserTurn = Promise.all([
        existingConversationForMode
          ? Promise.resolve()
          : supabase.from("alwen_conversations").insert({ id: conversationId, user_id: authData.user.id, title: message.slice(0, 80) }),
        supabase.from("alwen_messages").insert({ conversation_id: conversationId, user_id: authData.user.id, role: "user", content: message, message_type: "translation" })
      ]);

      const translateInput: unknown[] = [
        { role: "system", content: translateSystemPrompt(toLanguage) },
        { role: "user", content: message }
      ];
      const translatePayload = await callResponses(translateInput, undefined);
      trackUsage(translatePayload);
      await persistUserTurn;

      const parsed = parseTranslationResponse(extractAnswerText(translatePayload));
      await supabase.from("alwen_chat_usage").insert({
        user_id: authData.user.id,
        conversation_id: conversationId,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        estimated_cost_usd: estimateCostUsd(totalInputTokens, totalOutputTokens),
        model: "gpt-4.1-mini"
      });

      if (!parsed) {
        return safeError("Alwen could not translate that. Please try again.", 502);
      }

      await supabase.from("alwen_messages").insert({
        conversation_id: conversationId,
        user_id: authData.user.id,
        role: "assistant",
        content: parsed.translated,
        message_type: "translation",
        original_text: parsed.original,
        translated_text: parsed.translated,
        detected_language: parsed.detectedLanguage
      });

      return jsonResponse({
        type: "translation",
        original: parsed.original,
        translated: parsed.translated,
        detectedLanguage: parsed.detectedLanguage,
        targetLanguage: parsed.targetLanguage,
        conversationId
      });
    }

    const existingConversation = existingConversationForMode;
    // Phase 13 context control — only the most recent MAX_CONTEXT_MESSAGES
    // turns are ever sent to OpenAI, never the full unbounded history.
    const { data: recentMessagesDesc } = await supabase
      .from("alwen_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);
    const priorMessages = (recentMessagesDesc || []).slice().reverse();

    const input: unknown[] = [
      { role: "system", content: systemPrompt(language, city) },
      ...(priorMessages || []).map((row) => ({ role: row.role, content: row.content })),
      { role: "user", content: message }
    ];

    // Persisting this turn doesn't need to finish before we ask OpenAI —
    // there's nothing in `input` that depends on these writes completing —
    // so let it run concurrently with the (much slower) model call instead
    // of adding its latency on top.
    const persistUserTurn = Promise.all([
      existingConversation
        ? Promise.resolve()
        : supabase.from("alwen_conversations").insert({ id: conversationId, user_id: authData.user.id, title: message.slice(0, 80) }),
      supabase.from("alwen_messages").insert({ conversation_id: conversationId, user_id: authData.user.id, role: "user", content: message })
    ]);

    let payload = await callResponses(input);
    trackUsage(payload);
    await persistUserTurn;
    const functionCall = (payload.output || []).find((item: { type?: string }) => item.type === "function_call") as
      | { type: string; call_id: string; name: string; arguments: string }
      | undefined;

    let createdHelpRequest: Record<string, unknown> | null = null;
    let createdListing: Record<string, unknown> | null = null;

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
      trackUsage(payload);
    } else if (functionCall?.name === "create_marketplace_listing") {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(functionCall.arguments || "{}");
      } catch {
        args = {};
      }

      const title = typeof args.title === "string" ? args.title.trim().slice(0, 120) : "";
      const description = typeof args.description === "string" ? args.description.trim().slice(0, 1000) : "";
      const category = typeof args.category === "string" && LISTING_CATEGORIES.includes(args.category) ? args.category : "buy_sell";
      const priceAmount = typeof args.priceAmount === "number" && Number.isFinite(args.priceAmount) && args.priceAmount >= 0 ? args.priceAmount : null;
      const pricePeriod = typeof args.pricePeriod === "string" && LISTING_PRICE_PERIODS.includes(args.pricePeriod) ? args.pricePeriod : priceAmount ? "one_time" : null;
      const area = typeof args.area === "string" && args.area.trim() ? args.area.trim().slice(0, 120) : null;
      const condition = typeof args.condition === "string" && LISTING_CONDITIONS.includes(args.condition) ? args.condition : null;
      const offerorStatus = args.offerorStatus === "private" || args.offerorStatus === "trader" ? args.offerorStatus : null;
      const tags = Array.isArray(args.tags) ? args.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10) : [];

      let toolOutput: string;
      if (title && description && offerorStatus) {
        const { error: classificationError } = await supabase.rpc("set_offeror_status", {
          p_status: offerorStatus,
          p_terms_version: "ALWENDA_LEGAL_POLICIES_EN-2026-07-18",
          p_confirmed: true,
          p_reason: "Explicitly confirmed in Alwen listing conversation"
        });
        if (classificationError) {
          console.error("[alwen-chat] Failed to record offeror classification", classificationError.code);
          toolOutput = JSON.stringify({ status: "error", message: "Confirm your private or trader status in Marketplace settings before publishing." });
        } else {
        const { data: inserted, error: insertError } = await supabase
          .from("listings")
          .insert({
            owner_user_id: authData.user.id,
            title,
            description,
            category,
            status: "published",
            price_amount: priceAmount,
            price_period: pricePeriod,
            location_label: area,
            neighbourhood: area,
            tags,
            metadata: {
              ...(condition ? { condition } : {}),
              pickupAvailable: Boolean(args.pickupAvailable),
              deliveryAvailable: Boolean(args.deliveryAvailable)
            },
            published_at: new Date().toISOString()
          })
          .select("id, title, description, category, price_amount, price_currency, price_period, neighbourhood, location_label, metadata, tags")
          .single();

        if (insertError || !inserted) {
          console.error("[alwen-chat] Failed to create listing", insertError);
          toolOutput = JSON.stringify({ status: "error", message: "Could not create the listing." });
        } else {
          createdListing = inserted;
          toolOutput = JSON.stringify({ status: "created", listingId: inserted.id });
        }
        }
      } else {
        toolOutput = JSON.stringify({ status: "error", message: "Missing title, description, or offeror status." });
      }

      const followUpInput = [
        ...input,
        ...(payload.output || []),
        { type: "function_call_output", call_id: functionCall.call_id, output: toolOutput }
      ];
      payload = await callResponses(followUpInput);
      trackUsage(payload);
    }

    const answer = extractAnswerText(payload);
    if (!answer) return safeError("Alwen returned an empty answer. Please try again.", 502);

    await supabase.from("alwen_messages").insert({ conversation_id: conversationId, user_id: authData.user.id, role: "assistant", content: answer });
    await supabase.from("alwen_chat_usage").insert({
      user_id: authData.user.id,
      conversation_id: conversationId,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalInputTokens + totalOutputTokens,
      estimated_cost_usd: estimateCostUsd(totalInputTokens, totalOutputTokens),
      model: "gpt-4.1-mini"
    });

    return jsonResponse({
      answer,
      conversationId,
      ...(createdHelpRequest ? { createdHelpRequest } : {}),
      ...(createdListing ? { createdListing } : {})
    });
  } catch (error) {
    // Log whatever OpenAI usage was actually incurred before the failure —
    // a request that spent real tokens on one call and then failed on a
    // later step must still count against the cost ceiling, or a user
    // could repeatedly trigger partial failures to spend past it unlogged.
    if (totalInputTokens || totalOutputTokens) {
      await supabase.from("alwen_chat_usage").insert({
        user_id: authData.user.id,
        conversation_id: conversationId,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
        estimated_cost_usd: estimateCostUsd(totalInputTokens, totalOutputTokens),
        model: "gpt-4.1-mini"
      }).then(() => {}, () => {});
    }
    if (error instanceof Error && error.message === "OPENAI_REQUEST_FAILED") {
      return safeError("Alwen could not answer right now. Please try again.", 502);
    }
    console.error("[alwen-chat] Unexpected failure", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return safeError("Alwen could not answer right now. Please try again.", 500);
  }
});
