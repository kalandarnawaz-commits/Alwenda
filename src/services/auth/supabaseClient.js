/**
 * Real authentication via Supabase Auth — the only auth backend this app
 * talks to. Every function here either makes a real network call to the
 * user's own Supabase project, or (when SUPABASE_URL/SUPABASE_ANON_KEY
 * aren't configured, see src/config.js) throws NOT_CONFIGURED so callers
 * can show a clear message instead of ever fabricating a signed-in user.
 *
 * The SDK is loaded from an ESM CDN (esm.sh) rather than npm, since this
 * is a zero-build static site — no bundler step exists to resolve a
 * node_modules import.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "../../config.js?v=production-sprint-1";

export { isSupabaseConfigured };

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("NOT_CONFIGURED");
    this.name = "AuthNotConfiguredError";
  }
}

let clientPromise = null;

/** Lazily imports the SDK and creates the client — only ever runs the
 * network import when a project is actually configured, so the app never
 * pays for or depends on Supabase when running without credentials. */
function getClient() {
  if (!isSupabaseConfigured()) throw new AuthNotConfiguredError();
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    );
  }
  return clientPromise;
}

export async function signInWithOAuthProvider(provider) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin }
  });
  if (error) throw error;
}

export async function signUpWithEmail({ email, password, name }) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo: window.location.origin }
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function resetPasswordForEmail(email) {
  const supabase = await getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const supabase = await getClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Merges into the Supabase user's user_metadata (name, avatar_url, role) so
 * profile-completion state survives future session restores — without this,
 * mapSupabaseUserToAccount() would keep reporting profileComplete: false on
 * every subsequent sign-in since it derives that from user_metadata. */
export async function updateUserMetadata(metadata) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.updateUser({ data: metadata });
  if (error) throw error;
  return data;
}

export async function signInWithPhoneOtp(phone) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyPhoneOtp({ phone, token }) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throw error;
  return data;
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Fires immediately with the current state, then on every future change
 * (sign-in, sign-out, token refresh, or a PASSWORD_RECOVERY session created
 * by following the reset-password email link) — the real replacement for
 * the old hand-rolled hydrateAuthFromStorage() localStorage read. */
export async function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = await getClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}

/** scope: "local" (this device only) | "global" (every device — the
 * "sign out everywhere" feature) | "others" (every device except this
 * one). Supabase supports this natively; no server code needed. */
export async function signOutSupabase(scope = "local") {
  const supabase = await getClient();
  const { error } = await supabase.auth.signOut({ scope });
  if (error) throw error;
}

/** Maps a Supabase auth user into this app's existing state.auth.user
 * shape, so every render function that already consumes that shape
 * (renderProfile, renderProfileQuickActions, etc.) keeps working
 * unchanged — only the identity/session source of truth changes. */
export function mapSupabaseUserToAccount(supabaseUser) {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  return {
    id: supabaseUser.id,
    name: meta.name || meta.full_name || supabaseUser.email?.split("@")[0] || "",
    email: supabaseUser.email || "",
    phone: supabaseUser.phone || null,
    avatar: meta.avatar_url || meta.picture || null,
    role: meta.role || "",
    provider: supabaseUser.app_metadata?.provider || "email",
    emailVerified: Boolean(supabaseUser.email_confirmed_at),
    phoneVerified: Boolean(supabaseUser.phone_confirmed_at),
    profileComplete: Boolean(meta.name && meta.avatar_url),
    createdAt: supabaseUser.created_at || new Date().toISOString(),
    isSupabaseAccount: true
  };
}
