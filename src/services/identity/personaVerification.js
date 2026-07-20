const PROVIDER = "persona";
const MAX_REFERENCE_LENGTH = 96;

export const IDENTITY_VERIFICATION_STATES = Object.freeze({
  NOT_STARTED: "not_started",
  READY: "ready",
  PENDING_PROVIDER: "pending_provider",
  VERIFIED: "verified",
  REJECTED: "rejected"
});

export const PERSONA_INTEGRATION_PLACEHOLDER = Object.freeze({
  provider: PROVIDER,
  status: "placeholder",
  requiredServerWork: [
    "Create a Supabase Edge Function that starts a Persona inquiry.",
    "Store only provider inquiry ids and status values in Alwenda.",
    "Handle Persona webhooks server-side before showing verified status.",
    "Never store raw government ID images in browser storage or public tables."
  ]
});

function cleanProviderReference(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_:-]/g, "")
    .slice(0, MAX_REFERENCE_LENGTH);
}

export function buildIdentityVerificationRecord({ userId, provider = PROVIDER, providerReference = "", status = IDENTITY_VERIFICATION_STATES.READY, now = new Date().toISOString() }) {
  if (!userId) throw new Error("userId is required");
  return {
    userId,
    provider,
    providerReference: cleanProviderReference(providerReference),
    status,
    createdAt: now,
    updatedAt: now
  };
}

export function createPersonaPlaceholderSession({ userId, email, city = "Vilnius", now = new Date().toISOString() }) {
  const record = buildIdentityVerificationRecord({
    userId,
    providerReference: `persona_ready_${userId}`,
    status: IDENTITY_VERIFICATION_STATES.READY,
    now
  });

  return {
    ...record,
    city,
    contactEmail: email || "",
    nextStep: "connect_provider",
    messageKey: "profile.trust.personaPreparedNotice",
    providerConfigured: false
  };
}

export function personaVerificationRequirements() {
  return [
    "Supabase Edge Function for creating Persona inquiries",
    "Persona template id and webhook secret stored as Supabase secrets",
    "RLS-protected identity_verifications table",
    "Webhook status reconciliation before awarding ID verified badge"
  ];
}
