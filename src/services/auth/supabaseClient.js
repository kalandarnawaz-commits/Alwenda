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
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "../../config.js";
import { bootstrapAuthenticatedProfile, buildProfileBootstrapPayloads } from "./profileBootstrap.js";

export { isSupabaseConfigured };

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("NOT_CONFIGURED");
    this.name = "AuthNotConfiguredError";
  }
}

let clientPromise = null;

export const AUTH_CALLBACK_PATH = "/auth/callback";

function authRedirectUrl() {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A blip on the esm.sh CDN (not Supabase itself) throws the browser's own
 * "Failed to fetch dynamically imported module" — raw, unfriendly, and
 * previously shown to users verbatim. Retrying a couple of times with a
 * short backoff self-heals most of these without the user having to do
 * anything. */
async function importSupabaseSdk() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // @ts-ignore Remote ESM import is intentional for this zero-build static app.
      return await import("https://esm.sh/@supabase/supabase-js@2");
    } catch (error) {
      if (attempt === attempts) {
        throw new Error("Alwenda couldn't reach its sign-in service. Check your connection and try again.", { cause: error });
      }
      await wait(400 * attempt);
    }
  }
  throw new Error("Alwenda couldn't reach its sign-in service. Check your connection and try again.");
}

/** Lazily imports the SDK and creates the client — only ever runs the
 * network import when a project is actually configured, so the app never
 * pays for or depends on Supabase when running without credentials. */
function getClient() {
  if (!isSupabaseConfigured()) throw new AuthNotConfiguredError();
  if (!clientPromise) {
    clientPromise = importSupabaseSdk()
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        })
      )
      .catch((error) => {
        // Don't cache a failed attempt — the next call (e.g. the user
        // tapping "sign in" again) should get a fresh try instead of being
        // stuck replaying the same rejected promise for the rest of the
        // page's lifetime.
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export async function getSupabaseAccessToken() {
  const session = await getCurrentSession();
  return session?.access_token || null;
}

export async function signInWithOAuthProvider(provider) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirectUrl() }
  });
  if (error) throw error;
}

export async function signInWithEmailOtp(email) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true }
  });
  if (error) throw error;
}

export const signUpWithEmail = signInWithEmailOtp;
export const signInWithEmail = ({ email }) => signInWithEmailOtp(email);

export async function resetPasswordForEmail(email) {
  const supabase = await getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
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

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
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

export async function loadUserProfiles() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return { user: null, publicProfile: null, privateProfile: null };

  const [publicResult, privateResult] = await Promise.all([
    supabase.from("public_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("private_profiles").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  if (publicResult.error) throw publicResult.error;
  if (privateResult.error) throw privateResult.error;

  return { user, publicProfile: publicResult.data, privateProfile: privateResult.data };
}

export async function ensureUserProfiles() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return { user: null, publicProfile: null, privateProfile: null };
  return bootstrapAuthenticatedProfile({ supabase, user });
}

/** Creates a real row in the listings table — published immediately, since
 * this is a direct "Publish" action, not a draft-then-publish flow. RLS
 * ("Owners create listings") already enforces owner_user_id = auth.uid(),
 * so there's nothing to check client-side beyond having a signed-in user. */
export async function createListing({ title, description, category, priceAmount, priceCurrency, pricePeriod, neighbourhood }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("listings")
    .insert({
      owner_user_id: user.id,
      title,
      description: description || null,
      category,
      status: "published",
      price_amount: priceAmount || null,
      price_currency: priceCurrency || "EUR",
      price_period: pricePeriod || null,
      location_label: neighbourhood || null,
      neighbourhood: neighbourhood || null,
      published_at: now
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMyListings() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase.from("listings").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function completeUserProfile({ displayName, profession, avatarUrl }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user.");
  const now = new Date().toISOString();
  const { publicPayload, privatePayload } = buildProfileBootstrapPayloads({ user, now });

  const [publicResult, privateResult] = await Promise.all([
    supabase
      .from("public_profiles")
      .upsert(
        {
          ...publicPayload,
          display_name: displayName,
          avatar_url: avatarUrl || null,
          profession: profession || "",
          updated_at: now
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single(),
    supabase
      .from("private_profiles")
      .upsert(
        {
          ...privatePayload,
          onboarding_complete: true,
          updated_at: now
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single()
  ]);

  if (publicResult.error) throw publicResult.error;
  if (privateResult.error) throw privateResult.error;

  await updateUserMetadata({ name: displayName, role: profession || "", avatar_url: avatarUrl || null });
  return { user, publicProfile: publicResult.data, privateProfile: privateResult.data };
}

/** Maps a Supabase auth user into this app's existing state.auth.user
 * shape, so every render function that already consumes that shape
 * (renderProfile, renderProfileQuickActions, etc.) keeps working
 * unchanged — only the identity/session source of truth changes. */
export function mapSupabaseUserToAccount(supabaseUser, profiles = {}) {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  const publicProfile = profiles.publicProfile || null;
  const privateProfile = profiles.privateProfile || null;
  return {
    id: supabaseUser.id,
    name: publicProfile?.display_name || meta.name || meta.full_name || supabaseUser.email?.split("@")[0] || "",
    email: supabaseUser.email || "",
    phone: supabaseUser.phone || null,
    avatar: publicProfile?.avatar_url || meta.avatar_url || meta.picture || null,
    role: publicProfile?.profession || meta.role || "",
    provider: supabaseUser.app_metadata?.provider || "email",
    emailVerified: Boolean(supabaseUser.email_confirmed_at),
    phoneVerified: Boolean(supabaseUser.phone_confirmed_at),
    profileComplete: Boolean(privateProfile?.onboarding_complete),
    publicProfile,
    privateProfile,
    createdAt: supabaseUser.created_at || new Date().toISOString(),
    isSupabaseAccount: true
  };
}
