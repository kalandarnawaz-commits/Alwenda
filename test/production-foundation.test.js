import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

test("runtime config exposes public diagnostics without secrets", async () => {
  const { getRuntimeConfigDiagnostics, validatePublicRuntimeConfig, PUBLIC_FEATURE_FLAGS } = await import("../src/config.js");
  const diagnostics = getRuntimeConfigDiagnostics();
  const validation = validatePublicRuntimeConfig();

  // No window.__ALWENDA_ENV__ and no process.env.APP_ENV are set in this
  // process, so this is exactly the "missing environment" case — it must
  // resolve to the production-safe default, not silently to "development".
  assert.equal(diagnostics.appEnv, "production");
  assert.equal(diagnostics.appEnvWasExplicit, false);
  assert.equal(diagnostics.fixturesAllowed, false);
  assert.equal(diagnostics.releaseVersion, "local-dev");
  assert.equal(diagnostics.supabaseConfigured, false);
  assert.deepEqual(PUBLIC_FEATURE_FLAGS, {});
  assert.equal(validation.ok, false);
  assert.ok(validation.warnings.some((warning) => warning.includes("SUPABASE_URL")));
  assert.ok(validation.warnings.some((warning) => warning.includes("APP_ENV was not explicitly set")));
  assert.ok(!JSON.stringify(diagnostics).toLowerCase().includes("service_role"));
});

test("resolveAppEnv: an unknown or missing environment always fails safe to production", async () => {
  const { resolveAppEnv } = await import("../src/config.js");
  assert.equal(resolveAppEnv(undefined, undefined), "production");
  assert.equal(resolveAppEnv(null, null), "production");
  assert.equal(resolveAppEnv("", ""), "production");
  assert.equal(resolveAppEnv("banana", undefined), "production");
  assert.equal(resolveAppEnv("staging", undefined), "staging");
  assert.equal(resolveAppEnv("development", undefined), "development");
  assert.equal(resolveAppEnv("test", undefined), "test");
  // A recognised Node-side value is honoured only when the browser-side
  // value (env.js) did not already supply a recognised one.
  assert.equal(resolveAppEnv(undefined, "test"), "test");
  assert.equal(resolveAppEnv("production", "development"), "production");
});

test("computeIsFixturesAllowed: only development and test permit fixtures, everything else — including unrecognised values — does not", async () => {
  const { computeIsFixturesAllowed } = await import("../src/config.js");
  assert.equal(computeIsFixturesAllowed("development"), true);
  assert.equal(computeIsFixturesAllowed("test"), true);
  assert.equal(computeIsFixturesAllowed("production"), false);
  assert.equal(computeIsFixturesAllowed("staging"), false);
  assert.equal(computeIsFixturesAllowed(undefined), false);
  assert.equal(computeIsFixturesAllowed(""), false);
  assert.equal(computeIsFixturesAllowed("banana"), false);
});

test("profile bootstrap preserves user-edited values and fills only missing provider data", async () => {
  const { buildProfileBootstrapPayloads, profileBootstrapStatus } = await import("../src/services/auth/profileBootstrap.js");
  const now = "2026-07-15T00:00:00.000Z";
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "owner@example.com",
    phone: "+37060000000",
    user_metadata: {
      full_name: "Provider Name",
      avatar_url: "https://example.com/provider.png"
    }
  };

  const { publicPayload, privatePayload } = buildProfileBootstrapPayloads({
    user,
    now,
    publicProfile: {
      display_name: "Edited Name",
      avatar_url: "https://example.com/edited.png",
      city: "Kaunas",
      profession: "Designer",
      languages: ["Lithuanian"],
      verification_status: "verified",
      reputation_score: 42,
      created_at: "2026-01-01T00:00:00.000Z"
    },
    privateProfile: {
      contact_email: "edited@example.com",
      preferred_language: "lt",
      onboarding_complete: true,
      notification_preferences: { messages: false },
      created_at: "2026-01-01T00:00:00.000Z"
    }
  });

  assert.equal(publicPayload.display_name, "Edited Name");
  assert.equal(publicPayload.avatar_url, "https://example.com/edited.png");
  assert.equal(publicPayload.city, "Kaunas");
  assert.equal(publicPayload.profession, "Designer");
  assert.deepEqual(publicPayload.languages, ["Lithuanian"]);
  assert.equal(privatePayload.contact_email, "edited@example.com");
  assert.equal(privatePayload.contact_phone, "+37060000000");
  assert.equal(privatePayload.onboarding_complete, true);
  assert.equal(profileBootstrapStatus(privatePayload).nextStep, "home");
});

test("profile bootstrap creates complete default payloads for first-login users", async () => {
  const { buildProfileBootstrapPayloads, profileBootstrapStatus } = await import("../src/services/auth/profileBootstrap.js");
  const { publicPayload, privatePayload } = buildProfileBootstrapPayloads({
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "new@example.com",
      user_metadata: { name: "New User", picture: "https://example.com/new.png" }
    },
    now: "2026-07-15T00:00:00.000Z"
  });

  assert.equal(publicPayload.display_name, "New User");
  assert.equal(publicPayload.avatar_url, "https://example.com/new.png");
  assert.equal(publicPayload.city, "Vilnius");
  assert.deepEqual(publicPayload.languages, ["English"]);
  assert.equal(privatePayload.contact_email, "new@example.com");
  assert.equal(privatePayload.onboarding_complete, false);
  assert.equal(profileBootstrapStatus(privatePayload).nextStep, "complete_profile");
});

test("data errors classify common Supabase/auth/network failures", async () => {
  const { DATA_ERROR_CODES, AuthDataError, AlwendaDataError, toDataError, safeErrorPayload } = await import("../src/services/dataErrors.js").then((module) => ({
    ...module,
    AuthDataError: module.AlwendaDataError
  }));

  assert.ok(AuthDataError);
  assert.equal(toDataError({ name: "AuthNotConfiguredError", message: "NOT_CONFIGURED" }).code, DATA_ERROR_CODES.PROVIDER_CONFIG_MISSING);
  assert.equal(toDataError({ status: 403, message: "permission denied by RLS" }).code, DATA_ERROR_CODES.FORBIDDEN);
  assert.equal(toDataError({ code: "PGRST116", message: "No rows" }).code, DATA_ERROR_CODES.MISSING_RECORD);
  assert.equal(toDataError(new TypeError("Failed to fetch")).code, DATA_ERROR_CODES.NETWORK_UNAVAILABLE);

  const payload = safeErrorPayload(new AlwendaDataError(DATA_ERROR_CODES.RATE_LIMITED, "Too many requests", { status: 429 }));
  assert.deepEqual(payload, {
    name: "AlwendaDataError",
    code: DATA_ERROR_CODES.RATE_LIMITED,
    message: "Too many requests",
    status: 429,
    retryable: true
  });
});

test("observability redacts personal data and secrets", async () => {
  const { createLogEvent, sanitizeDetails } = await import("../src/services/observability.js");
  const event = createLogEvent("auth_event", {
    email: "person@example.com",
    phone: "+370 600 00000",
    accessToken: "secret-token",
    nested: { messageBody: "private message", ok: true }
  });
  const serialized = JSON.stringify(event);

  assert.equal(event.app, "Alwenda");
  assert.ok(serialized.includes("[redacted]"));
  assert.ok(!serialized.includes("person@example.com"));
  assert.ok(!serialized.includes("secret-token"));
  assert.deepEqual(sanitizeDetails({ ordinary: "Nearby Vilnius" }), { ordinary: "Nearby Vilnius" });
});

test("Supabase migration defines required tables, RLS, and critical policies", async () => {
  const sql = await readRepoFile("supabase/migrations/202607150001_production_foundation.sql");
  const requiredTables = [
    "public_profiles",
    "private_profiles",
    "listings",
    "listing_images",
    "saved_listings",
    "community_posts",
    "comments",
    "businesses",
    "business_claims",
    "business_claim_evidence",
    "reviews",
    "conversations",
    "messages",
    "alwen_conversations",
    "alwen_messages",
    "user_blocks",
    "reports",
    "notification_preferences",
    "audit_events"
  ];

  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`), `${table} table should exist`);
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `${table} should enable RLS`);
  }

  assert.match(sql, /status = 'published' or auth\.uid\(\) = owner_user_id/);
  assert.match(sql, /auth\.uid\(\) = claimant_user_id and status = 'pending'/);
  assert.match(sql, /auth\.uid\(\) = sender_user_id and public\.is_conversation_participant/);
  assert.match(sql, /auth\.uid\(\) = user_id or public\.is_trusted_admin\(\)/);
});

test("deep-link allowlist protects launch-critical routes that already exist", async () => {
  const main = await readRepoFile("src/main.js");
  const requiredExistingRoutes = [
    "home",
    "marketplace",
    "businessProfile",
    "translate",
    "messages",
    "notifications",
    "community",
    "profile",
    "settings",
    "auth",
    "publicProfile",
    "businessDashboard"
  ];

  for (const route of requiredExistingRoutes) {
    assert.match(main, new RegExp(`"${route}"`), `${route} should remain directly refreshable`);
  }
});

test("service worker versions cache by release and preserves auth callback fallback", async () => {
  const sw = await readRepoFile("sw.js");
  assert.match(sw, /RELEASE_VERSION/);
  assert.match(sw, /CACHE_VERSION = `alwenda-shell-\$\{RELEASE_VERSION\}`/);
  assert.match(sw, /AUTH_CALLBACK_PATH = "\/auth\/callback"/);
  assert.match(sw, /auth\/callback\/index\.html/);
  assert.match(sw, /ALWENDA_RELEASE_DIAGNOSTICS/);
});
