/**
 * Deterministic-first intent classification for the unified Alwen
 * conversation. Pure and side-effect-free — no DOM, no app state, no
 * network — so it's trivially unit-testable and reusable from both the
 * composer's send flow and (later) any other entry point. Intent names
 * are internal only and must never be shown to the user.
 *
 * Ordering matters: patterns are checked live_conversation -> translation
 * -> hire_service -> place_search -> general_conversation, since a few
 * keywords could otherwise ambiguously match more than one bucket (e.g.
 * "clinic" is a place, not a hire-service profession).
 */

export const ALWEN_INTENTS = Object.freeze({
  GENERAL_CONVERSATION: "general_conversation",
  TRANSLATION: "translation",
  LIVE_CONVERSATION: "live_conversation",
  PLACE_SEARCH: "place_search",
  HIRE_SERVICE: "hire_service"
});

const LIVE_CONVERSATION_PATTERNS = [
  /help me speak (to|with)/i,
  /translate both ways/i,
  /start (lithuanian|english) conversation mode/i,
  /talk (to|with) (this|the|that) (person|pharmacist|doctor|officer|landlord|driver|waiter|receptionist)/i,
  /live translat/i
];

const TRANSLATION_PATTERNS = [
  /\btranslate\b/i,
  /\btranslation\b/i,
  /how do (i|you) say/i,
  /what does .* mean/i,
  /\bin lithuanian\b/i,
  /\bin english\b/i,
  /į lietuvių/i,
  /į anglų/i,
  /išvers/i
];

const HIRE_SERVICE_PATTERNS = [
  /\b(plumber|electrician|cleaner|babysitter|tutor|handyman|painter|carpenter|mechanic|photographer|driver|lawyer|accountant|hairstylist|hair stylist|makeup artist|tailor|pet ?sitter|personal trainer)\b/i,
  /\bneed (a|an|someone to)\b.*\b(fix|clean|repair|paint|move|assemble|install)\b/i,
  /\bhire (a|an|someone)\b/i,
  /\bfind (a|an) (plumber|electrician|cleaner|professional|handyman|tutor)\b/i
];

const PLACE_SEARCH_PATTERNS = [
  /\b(pharmacy|restaurant|cafe|café|clinic|museum|bakery|gym|hotel|bank|supermarket|shop|store)\b/i,
  /\bopen now\b/i,
  /\b(find|show|is there)\b.*\b(nearby|near me|close by)\b/i,
  /\bfind (a|an|the)\b.*\b(place|spot|location)\b/i
];

function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}

/** @param {string} message @returns {string} one of ALWEN_INTENTS */
export function classifyAlwenIntent(message) {
  const text = String(message || "").trim();
  if (!text) return ALWEN_INTENTS.GENERAL_CONVERSATION;
  if (matchesAny(LIVE_CONVERSATION_PATTERNS, text)) return ALWEN_INTENTS.LIVE_CONVERSATION;
  if (matchesAny(TRANSLATION_PATTERNS, text)) return ALWEN_INTENTS.TRANSLATION;
  if (matchesAny(HIRE_SERVICE_PATTERNS, text)) return ALWEN_INTENTS.HIRE_SERVICE;
  if (matchesAny(PLACE_SEARCH_PATTERNS, text)) return ALWEN_INTENTS.PLACE_SEARCH;
  return ALWEN_INTENTS.GENERAL_CONVERSATION;
}

/** True when the raw text explicitly asks for "open now" — the one
 * deterministic filter refinement place_search applies beyond the plain
 * text-match search, since the app already has a real openNow filter. */
export function wantsOpenNowOnly(message) {
  return /\bopen now\b|\bcurrently open\b|\bis .* open\b/i.test(String(message || ""));
}
