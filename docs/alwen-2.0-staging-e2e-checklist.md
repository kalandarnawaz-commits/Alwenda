# Alwen 2.0 — Staging Authenticated E2E Checklist

Run this against the shared Supabase project (`syfahecoodziijlsasum`) after
the Alwen 2.0 migration and `alwen-chat` Edge Function have been deployed
(see [deployment-runbook.md](deployment-runbook.md) for the deploy commands
— both were already applied as of this checklist's creation).

**⚠️ This is not a disposable staging environment.** There is currently
only one Supabase project — see the "There is currently only one Supabase
project" section in [deployment-runbook.md](deployment-runbook.md).
Anything you do here happens against the same project real usage would
run on. In particular:

- Do not intentionally exhaust the daily OpenAI cost cap (item 7 below
  already only asks you to trigger it "if feasible" through normal use —
  don't script a request flood to force it).
- Don't run destructive testing (bulk deletes, load testing, schema
  changes outside a reviewed migration).
- Test accounts you create live in the same `auth.users` table as any
  real users.

This checklist is deliberately manual: it requires two real signed-in
accounts, and account creation / password entry is not something an
automated agent performs on your behalf. Run it yourself or hand it to
whoever owns staging credentials.

## Setup

1. Open the staging app in two separate browser profiles/private windows
   (so sessions don't collide) — call them **User A** and **User B**.
2. Sign up (or sign in) as two distinct accounts, one per window.
3. Keep browser DevTools open in both (Console + Network tabs) — several
   checks below ask you to confirm no unexpected console errors.

## How to record results

For each item: mark **Pass** / **Fail**. For any **Fail**, capture:
- Exact reproduction steps (what you clicked/typed, in what order)
- Screenshot or console/network error if there is one
- Your judgment on severity: **Blocker** (breaks the feature or leaks
  data — must fix before merge), **Required fix** (wrong/confusing
  behavior but not data-unsafe — should fix before merge), or
  **Deferred** (cosmetic/edge-case, can ship and follow up)

---

## 1. Conversation persistence

- [ ] **New conversation creation** — As User A, open Alwen, send a first
  message ("Hello"). Confirm a real answer appears (not stuck loading).
- [ ] **Multi-turn persistence** — Send 2-3 more messages in the same
  conversation. Confirm each appears in order with no duplicates.
- [ ] **History after refresh** — Hard-refresh the page. Confirm the full
  conversation reloads (not just the latest message, not empty).
- [ ] **History after re-login** — Sign out, sign back in as User A.
  Confirm the same conversation and full history are still there.
- [ ] **New-conversation reset** — Tap "New conversation" (+ icon).
  Confirm the timeline clears and the next message starts a genuinely new
  conversation (refresh afterward — the old conversation's history should
  no longer be what loads by default, the new one should).

## 2. Translation

- [ ] **EN→LT** — Send "Translate this into Lithuanian: I need a doctor
  today." Confirm correct Lithuanian output, original text preserved,
  correct "English → Lithuanian" language labels.
- [ ] **LT→EN** — Send "Kaip pasakyti ačiū angliškai?" (or any Lithuanian
  translate-style phrase). Confirm correct English output and correct
  auto-detected direction.
- [ ] **Malformed/edge-case response handling** — Try a request likely to
  confuse the translator (e.g. a very long paste, or mixed EN/LT in one
  message). Confirm you get either a correct translation or a clean
  "Alwen could not translate that. Please try again." — never raw JSON,
  never a stuck loading state.
- [ ] Play / Stop / Copy / Fullscreen all work on a translation card.

## 3. Live two-way translation mode

- [ ] Toggle live-translate mode on (translate icon in the header). Confirm
  the "Live translation" pill and language-pair control appear.
- [ ] Speak/type one turn in English. Confirm it translates to Lithuanian.
- [ ] **Without touching the toggle**, reply in Lithuanian. Confirm it
  auto-translates back to English — direction switched on its own.
- [ ] **Microphone permission denied** — When the browser prompts for mic
  access, click Deny/Block. Confirm a clear "microphone access denied"
  message appears — not a silent failure or crash.
- [ ] **No-speech state** — Tap the mic, record 3+ seconds of silence,
  stop. Confirm a clear "no speech detected" message, and the composer
  remains usable afterward (not stuck).

## 4. Real place search

- [ ] Send "Find a pharmacy open now" (or any real category present in
  Explore for this city). Confirm real pharmacy cards render — name,
  category, address must all be real records, never invented. If hours
  aren't in the data, confirm the card never claims "open now" anyway.
- [ ] Tap **Directions** on a result — confirm it opens a real maps link
  matching that place's actual address.
- [ ] **Honest no-results** — Search something with no real matches (e.g.
  a category+area combination you know is empty). Confirm an honest
  "No matching results" message with an "Open Explore" fallback — never a
  fabricated alternative place.

## 5. Real professional search

- [ ] Send "I need a plumber today" (or another real Hire category).
  Confirm real professional cards render.
- [ ] Tap **View profile** — confirms it opens the correct real public
  profile for that professional.
- [ ] Tap **Message** — confirm it opens a real conversation thread (via
  the existing "start professional conversation" flow) and previews as a
  *request*, never as a confirmed booking.

## 6. Explore/Hire filter isolation

- [ ] Go to Explore directly, set a specific filter (pick a category, an
  area, and toggle "open now"). Note the exact filter state.
- [ ] Go to Alwen, run any place search (e.g. "find a bakery"). Go back to
  Explore. Confirm your original category/area/open-now filter is
  **unchanged** — Alwen's search must never leak into your own browsing
  state.
- [ ] Same check for Hire: set a category chip on Hire, run an Alwen hire
  search, go back to Hire, confirm the chip is unchanged.

## 7. Rate limiting and safety

- [ ] **Per-minute rate limit** — Send messages faster than the configured
  limit (default 8/minute unless overridden via
  `ALWEN_CHAT_RATE_LIMIT_PER_MINUTE`). Confirm you get "You're sending
  messages faster than Alwen can keep up..." (HTTP 429) — a clear,
  retryable error, not a crash.
- [ ] **Daily cost ceiling messaging** — do **not** deliberately drive usage
  up to trigger this (this project has no separate disposable staging
  environment, and the cap exists to protect real OpenAI spend). Only
  check this if normal testing above happens to cross the cap
  (default $2/day, overridable via `ALWEN_CHAT_DAILY_COST_CAP_USD`): if
  it does, confirm you saw the distinct "You've reached today's usage
  limit for Alwen..." text, not the generic rate-limit text. Otherwise
  mark this item **Deferred** with a note — don't force it.
- [ ] **alwen_chat_usage logging** — After a chat-mode message and a
  translate-mode message, confirm both produced a row in
  `alwen_chat_usage` (ask whoever has DB access to check, or query via
  the Supabase dashboard's Table Editor) — both modes must log usage.

## 8. RLS isolation between users

- [ ] As User A, note your conversation's id (visible in DevTools Network
  tab — inspect the request/response body of any `alwen-chat` call, or
  the `conversationId` field returned).
- [ ] As User B, in DevTools Console, attempt to query User A's
  conversation directly via the authenticated Supabase client (using
  User B's own session): confirm it returns **empty**, never User A's
  data.
- [ ] Confirm User B never sees User A's conversation in their own Alwen
  timeline on normal use (no account-switching bleed-through).

> Baseline already confirmed by automated check: unauthenticated (no
> session) requests to `alwen_conversations`/`alwen_messages` return an
> empty array (HTTP 200, `[]`) — RLS is active. This item is the
> additional check that two *different authenticated* users are isolated
> from each other, which requires two real accounts to verify.

## 9. Mobile keyboard and safe-area behavior

Test at **375×812** and **430×932** (or real iOS/Android devices at
equivalent sizes):

- [ ] Tap the composer — confirm the on-screen keyboard doesn't obscure
  it, and the page doesn't unexpectedly zoom/jump.
- [ ] Confirm the composer stays above the safe-area/home-indicator on a
  notched device, in both chat mode and live-translate mode (the
  language-pair control shouldn't push the composer off-screen).
- [ ] Confirm no horizontal scroll/overflow with the keyboard open.
- [ ] Send a long message, confirm the composer grows sensibly and stays
  usable rather than clipping text.

---

## Reporting back

Once run, report: pass/fail per item above, and for every failure the
repro steps + your blocker/required-fix/deferred judgment. That feeds
directly into the PR #23 merge decision — see the PR description for
current status.
