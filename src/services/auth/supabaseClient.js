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
import { logPilotEvent, OBSERVABILITY_EVENTS } from "../observability.js";

export { isSupabaseConfigured };

/** Every Supabase query in this file goes through here on failure — the
 * single choke point that makes "every failed Supabase call reaches
 * observability" true without instrumenting every call site in main.js.
 * Same throw behavior as the old `if (error) throw error;`, just logged
 * first. `context` is the exported function name, so a Sentry/console
 * event always says which query failed. */
function throwIfError(error, context) {
  if (!error) return;
  logPilotEvent(OBSERVABILITY_EVENTS.SUPABASE_FAILURE, { context, error }, { severity: "error" });
  throw error;
}

/** Same observability call throwIfError makes, without the throw — for
 * lower-stakes public "browse" fetches like fetchListingsByOwner that fail
 * closed to [] by design (a public profile's listing count silently
 * degrading to 0 on a transient error is an acceptable, pre-existing
 * tradeoff), while still reaching observability like every other failed
 * Supabase call in this file. fetchOpenHelpRequests/fetchPublicListings
 * (the opportunity-feed sources) deliberately do NOT use this — their
 * caller needs to tell a real failure apart from a genuinely empty result,
 * so they throw through throwIfError instead. */
function logFetchFailure(error, context) {
  logPilotEvent(OBSERVABILITY_EVENTS.SUPABASE_FAILURE, { context, error }, { severity: "error" });
}

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

function authStorageKey() {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return "sb-alwenda-auth-token";
  }
}

function getStoredSession() {
  try {
    const raw = window.localStorage.getItem(authStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.currentSession || parsed?.session || parsed;
  } catch {
    return null;
  }
}

function storeSession(session) {
  if (!session) return;
  window.localStorage.setItem(authStorageKey(), JSON.stringify({ currentSession: session, expiresAt: session.expires_at || null }));
}

function clearStoredSession() {
  window.localStorage.removeItem(authStorageKey());
}

function sessionFromUrl() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  const expiresIn = Number(params.get("expires_in") || "3600");
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get("token_type") || "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn
  };
  storeSession(session);
  if (window.history?.replaceState) {
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  }
  return session;
}

async function apiJson(path, { method = "GET", token = null, body = undefined, headers = {} } = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }
  if (!response.ok) return { data: null, error: data?.error_description || data?.msg || data?.message || response.statusText };
  return { data, error: null };
}

async function refreshSessionIfNeeded(session) {
  if (!session?.refresh_token) return session || null;
  if (session.expires_at && session.expires_at - 60 > Math.floor(Date.now() / 1000)) return session;
  const { data, error } = await apiJson("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: session.refresh_token }
  });
  if (error || !data?.access_token) {
    clearStoredSession();
    return null;
  }
  storeSession(data);
  return data;
}

async function fallbackSession() {
  return refreshSessionIfNeeded(sessionFromUrl() || getStoredSession());
}

class RestQuery {
  constructor(table, operation = "select", payload = null) {
    this.table = table;
    this.operation = operation;
    this.payload = payload;
    this.columns = "*";
    this.filters = [];
    this.ordering = null;
    this.rowLimit = null;
    this.expectSingle = false;
    this.expectMaybeSingle = false;
    this.onConflict = null;
  }

  select(columns = "*") {
    this.columns = columns;
    return this;
  }

  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.operation = "upsert";
    this.payload = payload;
    this.onConflict = options.onConflict || null;
    return this;
  }

  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  eq(column, value) {
    this.filters.push([column, `eq.${value}`]);
    return this;
  }

  in(column, values) {
    this.filters.push([column, `in.(${values.join(",")})`]);
    return this;
  }

  order(column, options = {}) {
    this.ordering = `${column}.${options.ascending === false ? "desc" : "asc"}`;
    return this;
  }

  limit(value) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.expectSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.expectMaybeSingle = true;
    return this.execute();
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    const session = await fallbackSession();
    const params = new URLSearchParams();
    params.set("select", this.columns);
    this.filters.forEach(([key, value]) => params.append(key, value));
    if (this.ordering) params.set("order", this.ordering);
    if (this.rowLimit) params.set("limit", String(this.rowLimit));
    if (this.onConflict) params.set("on_conflict", this.onConflict);
    const path = `/rest/v1/${this.table}?${params.toString()}`;
    const method = this.operation === "select" ? "GET" : this.operation === "update" ? "PATCH" : "POST";
    const prefer = [
      this.operation === "upsert" ? "resolution=merge-duplicates" : null,
      this.operation !== "select" ? "return=representation" : null
    ].filter(Boolean).join(",");
    const { data, error } = await apiJson(path, {
      method,
      token: session?.access_token || SUPABASE_ANON_KEY,
      body: this.operation === "select" ? undefined : this.payload,
      headers: prefer ? { Prefer: prefer } : {}
    });
    if (error) return { data: null, error };
    if (this.expectSingle) return { data: Array.isArray(data) ? data[0] || null : data, error: null };
    if (this.expectMaybeSingle) return { data: Array.isArray(data) ? data[0] || null : data, error: null };
    return { data, error: null };
  }
}

function createFallbackClient() {
  return {
    auth: {
      async signInWithOAuth({ provider, options = /** @type {any} */ ({}) }) {
        const redirectTo = options.redirectTo || authRedirectUrl();
        window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
        return { data: null, error: null };
      },
      async signInWithOtp({ email, phone, options = /** @type {any} */ ({}) }) {
        const body = email
          ? { email, create_user: options.shouldCreateUser !== false, email_redirect_to: options.emailRedirectTo || authRedirectUrl() }
          : { phone };
        return apiJson("/auth/v1/otp", { method: "POST", body });
      },
      async signInWithPassword({ email, password }) {
        const result = await apiJson("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
        if (result.data?.access_token) storeSession(result.data);
        return { data: result.data ? { session: result.data, user: result.data.user || null } : null, error: result.error };
      },
      async signUp({ email, password, options = /** @type {any} */ ({}) }) {
        const result = await apiJson("/auth/v1/signup", { method: "POST", body: { email, password, redirect_to: options.emailRedirectTo || authRedirectUrl() } });
        // GoTrue returns a full session (access_token present) only when
        // email confirmation is disabled project-side — otherwise it
        // returns just the created user, and the user must confirm by
        // email before a session exists, same as the magic-link flow.
        if (result.data?.access_token) storeSession(result.data);
        const session = result.data?.access_token ? result.data : null;
        const user = result.data?.user || (result.data && !result.data.access_token ? result.data : null);
        return { data: result.data ? { session, user } : null, error: result.error };
      },
      async resetPasswordForEmail(email, options = {}) {
        return apiJson("/auth/v1/recover", { method: "POST", body: { email, redirect_to: options.redirectTo || authRedirectUrl() } });
      },
      async updateUser(payload) {
        const session = await fallbackSession();
        if (!session?.access_token) return { data: null, error: "Authentication required." };
        return apiJson("/auth/v1/user", { method: "PUT", token: session.access_token, body: payload });
      },
      async verifyOtp(payload) {
        const result = await apiJson("/auth/v1/verify", { method: "POST", body: payload });
        if (result.data?.access_token) storeSession(result.data);
        return result;
      },
      async getSession() {
        const session = await fallbackSession();
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = await fallbackSession();
        if (!session?.access_token) return { data: { user: null }, error: null };
        const { data, error } = await apiJson("/auth/v1/user", { token: session.access_token });
        return { data: { user: data }, error };
      },
      onAuthStateChange(callback) {
        window.setTimeout(async () => callback("INITIAL_SESSION", await fallbackSession()), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signOut() {
        const session = await fallbackSession();
        if (session?.access_token) await apiJson("/auth/v1/logout", { method: "POST", token: session.access_token, body: {} });
        clearStoredSession();
        return { error: null };
      }
    },
    from(table) {
      return new RestQuery(table);
    },
    rpc(name, args) {
      return apiJson(`/rest/v1/rpc/${name}`, { method: "POST", token: getStoredSession()?.access_token || SUPABASE_ANON_KEY, body: args });
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, file, options = {}) {
            const session = await fallbackSession();
            const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
                "Content-Type": options.contentType || file.type || "application/octet-stream"
              },
              body: file
            });
            return { data: response.ok ? { path } : null, error: response.ok ? null : await response.text() };
          },
          async remove(paths) {
            const session = await fallbackSession();
            return apiJson(`/storage/v1/object/${bucket}`, {
              method: "DELETE",
              token: session?.access_token || SUPABASE_ANON_KEY,
              body: { prefixes: paths }
            });
          },
          getPublicUrl(path) {
            return { data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` } };
          }
        };
      }
    }
  };
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
        console.warn("[auth] Supabase SDK import failed; using REST auth fallback.", { message: error?.message || "unknown" });
        return createFallbackClient();
      })
      .catch((error) => {
        // Don't cache a failed attempt — the next call (e.g. the user
        // tapping "sign in" again) should get a fresh try instead of being
        // stuck replaying the same rejected promise for the rest of the
        // page's lifetime.
        clientPromise = null;
        logPilotEvent(OBSERVABILITY_EVENTS.SUPABASE_FAILURE, { context: "getClient.sdkImport", error }, { severity: "error" });
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
  if (error) throwIfError(error, "signInWithOAuthProvider");
}

export async function signInWithEmailOtp(email) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true }
  });
  if (error) throwIfError(error, "signInWithEmailOtp");
}

export const signUpWithEmail = signInWithEmailOtp;
export const signInWithEmail = ({ email }) => signInWithEmailOtp(email);

/** Real password sign-in via supabase.auth.signInWithPassword() — the
 * email/password counterpart to signInWithEmail() (magic link) above.
 * Returns { session, user } so callers can apply the session immediately
 * (there's no redirect to wait for, unlike magic link/OAuth). */
export async function signInWithPassword({ email, password }) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throwIfError(error, "signInWithPassword");
  return data;
}

/** Real password sign-up via supabase.auth.signUp(). If the project has
 * email confirmations enabled (the default), `data.session` comes back
 * null — the user must confirm by email first, exactly like the
 * magic-link sign-up flow's "check your email" step. */
export async function signUpWithPassword({ email, password }) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectUrl() }
  });
  if (error) throwIfError(error, "signUpWithPassword");
  return data;
}

export async function resetPasswordForEmail(email) {
  const supabase = await getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
  if (error) throwIfError(error, "resetPasswordForEmail");
}

export async function updatePassword(newPassword) {
  const supabase = await getClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throwIfError(error, "updatePassword");
}

/** Merges into the Supabase user's user_metadata (name, avatar_url, role) so
 * profile-completion state survives future session restores — without this,
 * mapSupabaseUserToAccount() would keep reporting profileComplete: false on
 * every subsequent sign-in since it derives that from user_metadata. */
export async function updateUserMetadata(metadata) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.updateUser({ data: metadata });
  if (error) throwIfError(error, "updateUserMetadata");
  return data;
}

export async function signInWithPhoneOtp(phone) {
  const supabase = await getClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throwIfError(error, "signInWithPhoneOtp");
}

export async function verifyPhoneOtp({ phone, token }) {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throwIfError(error, "verifyPhoneOtp");
  return data;
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throwIfError(error, "getCurrentSession");
  return data.session;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throwIfError(error, "getCurrentUser");
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
  if (error) throwIfError(error, "signOutSupabase");
}

export async function loadUserProfiles() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return { user: null, publicProfile: null, privateProfile: null };

  const [publicResult, privateResult] = await Promise.all([
    supabase.from("public_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("private_profiles").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  if (publicResult.error) throwIfError(publicResult.error, "loadUserProfiles.publicProfiles");
  if (privateResult.error) throwIfError(privateResult.error, "loadUserProfiles.privateProfiles");

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
 * so there's nothing to check client-side beyond having a signed-in user.
 * condition/pickupAvailable/deliveryAvailable have no dedicated columns —
 * they live in the existing free-form `metadata` jsonb column. */
export async function createListing({
  title,
  description,
  category,
  categoryId,
  priceAmount,
  priceCurrency,
  pricePeriod,
  neighbourhood,
  condition,
  pickupAvailable,
  deliveryAvailable,
  tags
}) {
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
      category_id: categoryId || null,
      status: "published",
      price_amount: priceAmount || null,
      price_currency: priceCurrency || "EUR",
      price_period: pricePeriod || null,
      location_label: neighbourhood || null,
      neighbourhood: neighbourhood || null,
      tags: tags && tags.length ? tags : [],
      metadata: {
        ...(condition ? { condition } : {}),
        pickupAvailable: Boolean(pickupAvailable),
        deliveryAvailable: Boolean(deliveryAvailable)
      },
      published_at: now
    })
    .select("*")
    .single();

  if (error) throwIfError(error, "createListing");
  return data;
}

export async function getMyOfferorStatus() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user.");
  const { data, error } = await supabase.from("user_offeror_status").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throwIfError(error, "getMyOfferorStatus");
  return data;
}

export async function confirmOfferorStatus({ status, termsVersion, reason = null }) {
  if (!["private", "trader"].includes(status)) throw new Error("Choose private or trader status.");
  const supabase = await getClient();
  const { data, error } = await supabase.rpc("set_offeror_status", {
    p_status: status,
    p_terms_version: termsVersion,
    p_confirmed: true,
    p_reason: reason
  });
  if (error) throwIfError(error, "confirmOfferorStatus");
  return data;
}

export async function getMyTraderVerification() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user.");
  const { data, error } = await supabase.from("trader_verifications").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throwIfError(error, "getMyTraderVerification");
  return data;
}

export async function saveTraderVerificationDraft(fields, existingId = null) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user.");
  const payload = { ...fields, user_id: user.id, status: "draft", updated_at: new Date().toISOString() };
  const query = existingId
    ? supabase.from("trader_verifications").update(payload).eq("id", existingId).eq("user_id", user.id)
    : supabase.from("trader_verifications").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throwIfError(error, "saveTraderVerificationDraft");
  return data;
}

export async function submitTraderVerification({ id, confirmationVersion }) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc("submit_trader_verification", { p_id: id, p_confirmation_version: confirmationVersion });
  if (error) throwIfError(error, "submitTraderVerification");
  return data;
}

const TRADER_DOCUMENT_TYPES = new Set(["identity", "representative_authority", "registration_evidence", "address_evidence"]);
const TRADER_DOCUMENT_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const TRADER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadTraderVerificationDocument({ verificationId, documentType, file }) {
  if (!TRADER_DOCUMENT_TYPES.has(documentType)) throw new Error("Unsupported document type.");
  if (!TRADER_DOCUMENT_MIME_TYPES.has(file?.type) || !file.size || file.size > TRADER_DOCUMENT_MAX_BYTES) {
    throw new Error("Use a JPEG, PNG, or PDF no larger than 10 MB.");
  }
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user.");
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const storagePath = `${verificationId}/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("trader-verification-documents").upload(storagePath, file, { contentType: file.type });
  if (uploadError) throwIfError(uploadError, "uploadTraderVerificationDocument.upload");
  const { data, error } = await supabase.from("trader_verification_documents").insert({
    verification_id: verificationId,
    owner_user_id: user.id,
    document_type: documentType,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    byte_size: file.size
  }).select("id,document_type,original_filename,mime_type,byte_size,malware_scan_status,created_at").single();
  if (error) {
    await supabase.storage.from("trader-verification-documents").remove([storagePath]);
    throwIfError(error, "uploadTraderVerificationDocument.insert");
  }
  return data;
}

export async function fetchTraderVerificationQueue() {
  const supabase = await getClient();
  const { data, error } = await supabase.from("trader_verifications")
    .select("id,user_id,status,legal_name,trading_name,country_of_establishment,trade_register_name,registration_number,submitted_at,user_visible_reason,created_at")
    .in("status", ["submitted", "under_review", "more_information_required", "suspended"])
    .order("submitted_at", { ascending: true });
  if (error) throwIfError(error, "fetchTraderVerificationQueue");
  return data || [];
}

export async function reviewTraderVerification({ id, newStatus, userReason, internalNotes, expiresAt = null }) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc("review_trader_verification", {
    p_id: id,
    p_new_status: newStatus,
    p_user_reason: userReason,
    p_internal_notes: internalNotes,
    p_expires_at: expiresAt
  });
  if (error) throwIfError(error, "reviewTraderVerification");
  return data;
}

export async function recordTraderRegisterCheck({ verificationId, sourceName, result, reference = null, notes = null }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("No authenticated user.");
  const { data, error } = await supabase.from("trader_register_checks").insert({
    verification_id: verificationId,
    provider_key: "manual",
    source_name: sourceName,
    result,
    checked_by: user.id,
    reference,
    notes
  }).select("*").single();
  if (error) throwIfError(error, "recordTraderRegisterCheck");
  return data;
}

export async function fetchTraderPublicProfile(userId) {
  const supabase = await getClient();
  const { data, error } = await supabase.from("trader_public_profiles").select("*").eq("user_id", userId).eq("verification_status", "verified").maybeSingle();
  if (error) throwIfError(error, "fetchTraderPublicProfile");
  return data;
}

/** Uploads a photo the user attached in the create-listing form into the
 * (public, owner-write-only) listing-photos storage bucket and links it via
 * a listing_images row — both already covered by RLS scoped to the listing
 * owner. Path is "<user_id>/<listing_id>/<uuid>.<ext>", matching the storage
 * policies' expectation that the first path segment is the uploader's own
 * user id. */
export async function uploadListingPhoto({ listingId, file, sortOrder = 0 }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();

  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const storagePath = `${user.id}/${listingId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("listing-photos").upload(storagePath, file, { contentType: file.type });
  if (uploadError) throwIfError(uploadError, "uploadListingPhoto.upload");

  const { data, error } = await supabase
    .from("listing_images")
    .insert({ listing_id: listingId, storage_path: storagePath, sort_order: sortOrder })
    .select("id, storage_path, sort_order")
    .single();
  if (error) throwIfError(error, "uploadListingPhoto.insert");

  return { ...data, publicUrl: supabase.storage.from("listing-photos").getPublicUrl(storagePath).data.publicUrl };
}

export async function fetchListingImages(listingId) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, storage_path, sort_order")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });
  if (error) throwIfError(error, "fetchListingImages");
  return (data || []).map((row) => ({ ...row, publicUrl: supabase.storage.from("listing-photos").getPublicUrl(row.storage_path).data.publicUrl }));
}

export async function fetchMyListings() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase.from("listings").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false });
  if (error) throwIfError(error, "fetchMyListings");

  const withImages = await Promise.all(
    (data || []).map(async (listing) => ({ ...listing, images: await fetchListingImages(listing.id).catch(() => []) }))
  );
  return withImages;
}

/** Real backing insert for a Hire "post a request" — mirrors createListing.
 * Used by both the manual Need Help form and (via the create_hire_request
 * tool in supabase/functions/alwen-chat) Alwen's own request creation, so
 * a request either path creates is the same real, RLS-scoped row. */
export async function createHelpRequest({ category, categoryId, description, urgency, area, city }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();

  const { data, error } = await supabase
    .from("help_requests")
    .insert({
      requester_user_id: user.id,
      category,
      category_id: categoryId || null,
      description,
      urgency: urgency || "flexible",
      area: area || null,
      city: city || "Vilnius"
    })
    .select("*")
    .single();
  if (error) throwIfError(error, "createHelpRequest");
  return data;
}

/** Public "what's live right now" feed — every requester's open help_requests,
 * not just the signed-in user's own (contrast fetchMyHelpRequests below).
 * RLS already permits this (see "Open help requests are public readable" in
 * 202607160001_alwen_help_requests.sql), so no auth is required. Column list
 * excludes nothing sensitive — every selected field is already visible to
 * anyone via that same public RLS policy. Bounded, deterministic. Throws
 * through the same throwIfError choke point as every other query in this
 * file (rather than swallowing) so the caller (main.js's opportunity-feed
 * loader) can tell "query genuinely failed" apart from "loaded, zero rows"
 * and show a retry action instead of a false empty state. `!isSupabaseConfigured()`
 * is the one case that still resolves to [] rather than throwing — there is
 * no backend to query at all, which the caller treats as "no real data
 * available" rather than a transient failure. */
const OPEN_HELP_REQUESTS_DEFAULT_LIMIT = 30;
const OPEN_HELP_REQUESTS_MAX_LIMIT = 100;

export async function fetchOpenHelpRequests({ limit = OPEN_HELP_REQUESTS_DEFAULT_LIMIT } = {}) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getClient();
  const boundedLimit = Math.min(Math.max(1, Number(limit) || OPEN_HELP_REQUESTS_DEFAULT_LIMIT), OPEN_HELP_REQUESTS_MAX_LIMIT);
  const { data, error } = await supabase
    .from("help_requests")
    .select("id, category, category_id, description, urgency, area, city, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  if (error) throwIfError(error, "fetchOpenHelpRequests");
  return data || [];
}

export async function fetchMyHelpRequests() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("help_requests")
    .select("*")
    .eq("requester_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throwIfError(error, "fetchMyHelpRequests");
  return data || [];
}

/** Best-effort write to the real analytics destination (see
 * src/services/analytics.js for the typed event schema this record must
 * already satisfy). A no-op when Supabase isn't configured, and callers
 * are expected to swallow failures — analytics must never break the app,
 * matching the standing rule already documented on trackEvent() in
 * main.js. Still logs to observability via throwIfError so a broken
 * analytics pipeline is visible, just never user-facing. */
export async function recordAnalyticsEvent(record) {
  if (!isSupabaseConfigured()) return;
  const supabase = await getClient();
  const { error } = await supabase.from("analytics_events").insert(record);
  if (error) throwIfError(error, "recordAnalyticsEvent");
}

export async function recordLegalAcceptance({ policyVersion, acceptedAt, marketingConsent }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { error } = await supabase.from("legal_acceptances").upsert({ user_id: user.id, policy_version: policyVersion, accepted_at: acceptedAt, marketing_consent: Boolean(marketingConsent) }, { onConflict: "user_id,policy_version" });
  if (error) throwIfError(error, "recordLegalAcceptance");
}

export async function createModerationReport(report) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  const { data, error } = await supabase.from("legal_reports").insert({ ...report, reporter_user_id: user?.id || null }).select("id,status,created_at").single();
  if (error) throwIfError(error, "createModerationReport");
  return data;
}

export async function createPrivacyRequest(requestType) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { data, error } = await supabase.from("privacy_requests").insert({ user_id: user.id, request_type: requestType }).select("id,status,created_at").single();
  if (error) throwIfError(error, "createPrivacyRequest");
  return data;
}

/* ---- Alwen 2.0 — persistence for the unified conversation (Phase 11).
   The alwen-chat edge function already writes chat/translation turns
   itself (it runs with the user's own JWT, same RLS as here) — these
   functions cover what the edge function never sees: place/professional
   search turns, which are deterministic and local and never reach it,
   plus loading history back on screen open/refresh. RLS on both tables
   is already owner-scoped (see 202607150001_production_foundation.sql). ---- */

export async function createAlwenConversation({ title = null, mode = "chat" } = {}) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { data, error } = await supabase
    .from("alwen_conversations")
    .insert({ user_id: user.id, title, mode })
    .select("id, title, mode, created_at")
    .single();
  if (error) throwIfError(error, "createAlwenConversation");
  return data;
}

/** This app models one continuing Alwen conversation per user, not a
 * conversation list — so "the" conversation is simply the most recent
 * one, matching how resetAlwenConversation() in main.js starts a fresh
 * one (there is no separate history/browse-past-conversations UI). */
export async function fetchAlwenConversation() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("alwen_conversations")
    .select("id, title, mode, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwIfError(error, "fetchAlwenConversation");
  return data || null;
}

export async function fetchAlwenMessages(conversationId) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("alwen_messages")
    .select("id, conversation_id, role, content, message_type, detected_language, original_text, translated_text, result_type, result_payload, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throwIfError(error, "fetchAlwenMessages");
  return data || [];
}

export async function createAlwenMessage({ conversationId, role, content, messageType = "text", resultType = null, resultPayload = null }) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { data, error } = await supabase
    .from("alwen_messages")
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role,
      content,
      message_type: messageType,
      ...(resultType ? { result_type: resultType } : {}),
      ...(resultPayload ? { result_payload: resultPayload } : {})
    })
    .select("id, created_at")
    .single();
  if (error) throwIfError(error, "createAlwenMessage");
  return data;
}

/** Deletes exactly the one conversation row named — never "all of this
 * user's conversations" — so if the product ever grows a real saved/
 * archived conversation list later, this can't accidentally take it out
 * too. alwen_messages.conversation_id references this table with
 * `on delete cascade` (see the production_foundation migration), so its
 * messages are removed for free; RLS on both tables is already
 * owner-scoped, so this can never touch another user's row. */
export async function deleteAlwenConversation(conversationId) {
  const supabase = await getClient();
  const { error } = await supabase.from("alwen_conversations").delete().eq("id", conversationId);
  if (error) throwIfError(error, "deleteAlwenConversation");
}

export async function updateAlwenConversationMode(conversationId, mode) {
  const supabase = await getClient();
  const { error } = await supabase.from("alwen_conversations").update({ mode }).eq("id", conversationId);
  if (error) throwIfError(error, "updateAlwenConversationMode");
}

/** For a public profile's "Active listings" section — anyone's published
 * listings are readable by RLS regardless of who's asking, so no auth
 * check is needed here (unlike fetchMyListings, which is about the
 * signed-in user's own listings). Returns [] harmlessly for a mock
 * seller id (not a real UUID) rather than erroring. */
export async function fetchListingsByOwner(ownerId, limit = 3) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, category, price_amount, price_period, price_currency, status")
    .eq("owner_user_id", ownerId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logFetchFailure(error, "fetchListingsByOwner");
    return [];
  }
  return data || [];
}

/** Public "what's live right now" feed over listings — anyone's published,
 * trader-eligible listings (RLS: "Eligible published listings are public
 * readable", 202607180004_trader_verification.sql), not just one owner's
 * (contrast fetchListingsByOwner above). Used by Live Around You (Part 4)
 * to combine with fetchOpenHelpRequests into one broader activity feed.
 * dbCategories narrows to the listings.category enum values relevant to a
 * given life-category (CATEGORY_CONFIG[id].listingDbCategory) — omit to
 * fetch across all categories. Bounded, deterministic. Throws through
 * throwIfError like fetchOpenHelpRequests, for the same reason: the caller
 * needs to distinguish a real query failure from a genuinely empty result. */
const PUBLIC_LISTINGS_DEFAULT_LIMIT = 30;
const PUBLIC_LISTINGS_MAX_LIMIT = 100;

export async function fetchPublicListings({ dbCategories = null, limit = PUBLIC_LISTINGS_DEFAULT_LIMIT } = {}) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getClient();
  const boundedLimit = Math.min(Math.max(1, Number(limit) || PUBLIC_LISTINGS_DEFAULT_LIMIT), PUBLIC_LISTINGS_MAX_LIMIT);
  let query = supabase
    .from("listings")
    .select("id, title, description, category, category_id, price_amount, price_period, price_currency, neighbourhood, location_label, status, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  if (Array.isArray(dbCategories) && dbCategories.length) query = query.in("category", dbCategories);
  const { data, error } = await query;
  if (error) throwIfError(error, "fetchPublicListings");
  return data || [];
}

/** Public "what's live right now" feed over Community posts — real,
 * published posts from any author (RLS: "Published community posts are
 * readable", 202607150001_production_foundation.sql — `status =
 * 'published'` is already public, no auth required). This is the Home
 * redesign's Unified Home Feed's Community source (see
 * HOME_FEED_SOURCE_ADAPTERS.community, main.js) — Community's own page
 * still renders from the local feedPosts fixture for now (see that
 * file's comment for why), this function only backs Home's real-data
 * feed slice. Bounded, deterministic, explicit column list (no `select
 * *`) — no private field is ever selected.
 *
 * Two-step fetch (post rows, then a batched profile lookup via the same
 * fetchProfilesByIds() fetchFollowers/fetchFollowing already use below),
 * NOT a Supabase embedded-resource join — verified live against this
 * project's actual schema cache that a join here throws "Could not find a
 * relationship between 'community_posts' and 'public_profiles' in the
 * schema cache": both tables have their own independent FK to auth.users,
 * but there is no direct FK from community_posts to public_profiles for
 * PostgREST to auto-detect. public_profiles' own "readable by anyone" RLS
 * policy (`using (true)`) already covers this second query, so it exposes
 * nothing the author's real name/avatar isn't already public via. */
const COMMUNITY_POSTS_DEFAULT_LIMIT = 20;
const COMMUNITY_POSTS_MAX_LIMIT = 60;

export async function fetchCommunityPosts({ limit = COMMUNITY_POSTS_DEFAULT_LIMIT } = {}) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getClient();
  const boundedLimit = Math.min(Math.max(1, Number(limit) || COMMUNITY_POSTS_DEFAULT_LIMIT), COMMUNITY_POSTS_MAX_LIMIT);
  const { data, error } = await supabase
    .from("community_posts")
    .select("id, title, body, category, neighbourhood, media, created_at, author_user_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  if (error) throwIfError(error, "fetchCommunityPosts");
  const posts = data || [];
  const authorIds = [...new Set(posts.map((post) => post.author_user_id).filter(Boolean))];
  const profiles = await fetchProfilesByIds(authorIds);
  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  return posts.map((post) => ({ ...post, author: profileByUserId.get(post.author_user_id) || null }));
}

// ---------------------------------------------------------------------
// Profile social identity — handles, follow relationships, trust score,
// person-directed reviews, and per-user listing/block lookups. Backed by
// supabase/migrations/202607240001_profile_social_identity.sql.
// ---------------------------------------------------------------------

/** Client-side mirror of the public_profiles_handle_format DB constraint,
 * so the settings form can reject an invalid handle before round-tripping
 * to Postgres. The DB constraint (not this function) is the real guard. */
export function validateHandleFormat(handle) {
  return typeof handle === "string" && /^[a-z][a-z0-9_]{2,23}$/.test(handle);
}

export async function fetchProfileByHandle(handle) {
  const supabase = await getClient();
  const { data, error } = await supabase.from("public_profiles").select("*").ilike("handle", handle).maybeSingle();
  if (error) throwIfError(error, "fetchProfileByHandle");
  return data;
}

export async function fetchProfileById(userId) {
  const supabase = await getClient();
  const { data, error } = await supabase.from("public_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throwIfError(error, "fetchProfileById");
  return data;
}

export async function updateOwnHandle(handle) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { data, error } = await supabase
    .from("public_profiles")
    .update({ handle, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throwIfError(error, "updateOwnHandle");
  return data;
}

export async function fetchFollowCounts(userId) {
  const supabase = await getClient();
  const [followers, following] = await Promise.all([
    supabase.from("profile_follows").select("follower_user_id", { count: "exact", head: true }).eq("followed_user_id", userId),
    supabase.from("profile_follows").select("followed_user_id", { count: "exact", head: true }).eq("follower_user_id", userId)
  ]);
  if (followers.error) throwIfError(followers.error, "fetchFollowCounts.followers");
  if (following.error) throwIfError(following.error, "fetchFollowCounts.following");
  return { followers: followers.count || 0, following: following.count || 0 };
}

/** Two-step fetch (relationship rows, then a batched profile lookup) rather
 * than a Supabase embedded-resource join — a join needs the exact
 * auto-generated foreign-key constraint name, which can't be verified
 * without a live database in this environment (confirmed live for
 * fetchCommunityPosts above: community_posts and public_profiles have no
 * direct FK PostgREST can auto-detect, only independent FKs to
 * auth.users). verification_status is included so callers like
 * fetchCommunityPosts can show a real verified badge without a second
 * round-trip. */
async function fetchProfilesByIds(userIds) {
  if (!userIds.length) return [];
  const supabase = await getClient();
  const { data, error } = await supabase.from("public_profiles").select("user_id, display_name, avatar_url, handle, verification_status").in("user_id", userIds);
  if (error) throwIfError(error, "fetchProfilesByIds");
  return data || [];
}

export async function fetchFollowers(userId, { limit = 20, offset = 0 } = {}) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_user_id, created_at")
    .eq("followed_user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throwIfError(error, "fetchFollowers");
  const rows = data || [];
  const byId = new Map((await fetchProfilesByIds(rows.map((row) => row.follower_user_id))).map((profile) => [profile.user_id, profile]));
  return rows.map((row) => ({ userId: row.follower_user_id, followedAt: row.created_at, profile: byId.get(row.follower_user_id) || null }));
}

export async function fetchFollowing(userId, { limit = 20, offset = 0 } = {}) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select("followed_user_id, created_at")
    .eq("follower_user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throwIfError(error, "fetchFollowing");
  const rows = data || [];
  const byId = new Map((await fetchProfilesByIds(rows.map((row) => row.followed_user_id))).map((profile) => [profile.user_id, profile]));
  return rows.map((row) => ({ userId: row.followed_user_id, followedAt: row.created_at, profile: byId.get(row.followed_user_id) || null }));
}

export async function isFollowingUser(followedUserId) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_user_id")
    .eq("follower_user_id", user.id)
    .eq("followed_user_id", followedUserId)
    .maybeSingle();
  if (error) throwIfError(error, "isFollowingUser");
  return Boolean(data);
}

export async function followUser(followedUserId) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { error } = await supabase.from("profile_follows").insert({ follower_user_id: user.id, followed_user_id: followedUserId });
  if (error) throwIfError(error, "followUser");
}

export async function unfollowUser(followedUserId) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { error } = await supabase.from("profile_follows").delete().eq("follower_user_id", user.id).eq("followed_user_id", followedUserId);
  if (error) throwIfError(error, "unfollowUser");
}

export async function fetchTrustScore(userId) {
  const supabase = await getClient();
  const { data, error } = await supabase.from("trust_scores").select("*").eq("user_id", userId).maybeSingle();
  if (error) throwIfError(error, "fetchTrustScore");
  return data;
}

/** Triggers a real recalculation via the SECURITY DEFINER refresh_trust_score
 * RPC — the only write path for trust_scores. Never sends a score value. */
export async function refreshTrustScore(userId) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc("refresh_trust_score", { p_user_id: userId });
  if (error) throwIfError(error, "refreshTrustScore");
  return data;
}

export async function fetchProfileReviews(userId) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("profile_reviews")
    .select("id, reviewer_user_id, rating, body, created_at")
    .eq("reviewee_user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throwIfError(error, "fetchProfileReviews");
  return data || [];
}

/** statuses defaults to every status a listing grid may ever display —
 * "draft" and "removed" are excluded by default since drafts are private
 * and removed listings are soft-deleted; pass statuses explicitly (e.g.
 * including "draft") for an owner's own-profile view. */
export async function fetchListingsForUser(userId, { statuses = ["published", "paused", "sold", "expired"] } = {}) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("owner_user_id", userId)
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) throwIfError(error, "fetchListingsForUser");
  return data || [];
}

export async function fetchBlockedUserIds() {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", user.id);
  if (error) throwIfError(error, "fetchBlockedUserIds");
  return (data || []).map((row) => row.blocked_user_id);
}

export async function blockUser(userId) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { error } = await supabase.from("user_blocks").insert({ blocker_user_id: user.id, blocked_user_id: userId });
  if (error) throwIfError(error, "blockUser");
}

export async function unblockUser(userId) {
  const supabase = await getClient();
  const user = await getCurrentUser();
  if (!user) throw new AuthNotConfiguredError();
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_user_id", user.id).eq("blocked_user_id", userId);
  if (error) throwIfError(error, "unblockUser");
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

  if (publicResult.error) throwIfError(publicResult.error, "completeUserProfile.publicProfile");
  if (privateResult.error) throwIfError(privateResult.error, "completeUserProfile.privateProfile");

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
    appRole: supabaseUser.app_metadata?.role || "user",
    traderPermissions: Array.isArray(supabaseUser.app_metadata?.trader_permissions) ? supabaseUser.app_metadata.trader_permissions : [],
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
