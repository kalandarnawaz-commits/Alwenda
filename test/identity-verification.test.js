import { test } from "node:test";
import assert from "node:assert/strict";

test("Persona placeholder prepares a safe provider-ready record without secrets", async () => {
  const {
    createPersonaPlaceholderSession,
    IDENTITY_VERIFICATION_STATES,
    PERSONA_INTEGRATION_PLACEHOLDER,
    personaVerificationRequirements
  } = await import("../src/services/identity/personaVerification.js");

  const session = createPersonaPlaceholderSession({
    userId: "user_123",
    email: "person@example.com",
    city: "Vilnius",
    now: "2026-07-20T00:00:00.000Z"
  });

  assert.equal(session.provider, "persona");
  assert.equal(session.status, IDENTITY_VERIFICATION_STATES.READY);
  assert.equal(session.providerConfigured, false);
  assert.equal(session.providerReference, "persona_ready_user_123");
  assert.equal(session.contactEmail, "person@example.com");
  assert.ok(!JSON.stringify(session).toLowerCase().includes("api_key"));
  assert.ok(PERSONA_INTEGRATION_PLACEHOLDER.requiredServerWork.some((item) => item.includes("webhooks")));
  assert.ok(personaVerificationRequirements().some((item) => item.includes("Supabase secrets")));
});

test("identity verification provider references are sanitized", async () => {
  const { buildIdentityVerificationRecord } = await import("../src/services/identity/personaVerification.js");
  const record = buildIdentityVerificationRecord({
    userId: "user_456",
    providerReference: "inq_123<script>alert(1)</script>",
    now: "2026-07-20T00:00:00.000Z"
  });

  assert.equal(record.providerReference, "inq_123scriptalert1script");
});
