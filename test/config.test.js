import { test } from "node:test";
import assert from "node:assert/strict";

test("isSupabaseConfigured() is false when window.__ALWENDA_ENV__ is absent", async () => {
  const { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } = await import("../src/config.js");
  assert.equal(isSupabaseConfigured(), false);
  assert.equal(SUPABASE_URL, null);
  assert.equal(SUPABASE_ANON_KEY, null);
});

test("getCurrentSession() and onAuthStateChange() no-op instead of throwing when not configured", async () => {
  const { getCurrentSession, onAuthStateChange } = await import("../src/services/auth/supabaseClient.js");
  assert.equal(await getCurrentSession(), null);
  const unsubscribe = await onAuthStateChange(() => {});
  assert.equal(typeof unsubscribe, "function");
  assert.doesNotThrow(() => unsubscribe());
});

test("auth functions that require a real project throw AuthNotConfiguredError instead of faking success", async () => {
  const { signInWithOAuthProvider, AuthNotConfiguredError } = await import("../src/services/auth/supabaseClient.js");
  await assert.rejects(() => signInWithOAuthProvider("google"), AuthNotConfiguredError);
});

test("mapSupabaseUserToAccount returns null for a null user and never fabricates one", async () => {
  const { mapSupabaseUserToAccount } = await import("../src/services/auth/supabaseClient.js");
  assert.equal(mapSupabaseUserToAccount(null), null);
});

test("mapSupabaseUserToAccount maps a real Supabase user shape onto the app's account shape", async () => {
  const { mapSupabaseUserToAccount } = await import("../src/services/auth/supabaseClient.js");
  const account = mapSupabaseUserToAccount({
    id: "uuid-123",
    email: "user@example.com",
    phone: null,
    created_at: "2026-01-01T00:00:00.000Z",
    email_confirmed_at: "2026-01-02T00:00:00.000Z",
    phone_confirmed_at: null,
    user_metadata: { name: "Test User", avatar_url: "https://example.com/a.png" },
    app_metadata: { provider: "google" }
  });
  assert.equal(account.id, "uuid-123");
  assert.equal(account.name, "Test User");
  assert.equal(account.email, "user@example.com");
  assert.equal(account.emailVerified, true);
  assert.equal(account.phoneVerified, false);
  assert.equal(account.profileComplete, true);
  assert.equal(account.provider, "google");
  assert.equal(account.isSupabaseAccount, true);
});
