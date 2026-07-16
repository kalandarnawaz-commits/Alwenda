import { DATA_ERROR_CODES, toDataError } from "../dataErrors.js";

export const DEFAULT_PROFILE_VALUES = Object.freeze({
  city: "Vilnius",
  preferredLanguage: "en",
  languages: ["English"],
  verificationStatus: "unverified",
  reputationScore: 0,
  notificationPreferences: {
    messages: true,
    offers: true,
    community: true
  }
});

export function providerProfileFromUser(user) {
  const meta = user?.user_metadata || {};
  return {
    displayName: meta.full_name || meta.name || user?.email?.split("@")[0] || "",
    avatarUrl: meta.avatar_url || meta.picture || null,
    email: user?.email || null,
    phone: user?.phone || null
  };
}

function keepExisting(existingValue, fallbackValue) {
  if (Array.isArray(existingValue)) return existingValue.length ? existingValue : fallbackValue;
  if (existingValue === 0 || existingValue === false) return existingValue;
  return existingValue || fallbackValue;
}

export function buildProfileBootstrapPayloads({ user, publicProfile = null, privateProfile = null, now = new Date().toISOString(), defaults = {} }) {
  if (!user?.id) throw toDataError(new Error("Authenticated user is required."), DATA_ERROR_CODES.UNAUTHENTICATED);

  const mergedDefaults = { ...DEFAULT_PROFILE_VALUES, ...defaults };
  const provider = providerProfileFromUser(user);

  return {
    publicPayload: {
      user_id: user.id,
      display_name: keepExisting(publicProfile?.display_name, provider.displayName),
      avatar_url: keepExisting(publicProfile?.avatar_url, provider.avatarUrl),
      city: keepExisting(publicProfile?.city, mergedDefaults.city),
      profession: keepExisting(publicProfile?.profession, ""),
      languages: keepExisting(publicProfile?.languages, mergedDefaults.languages),
      verification_status: keepExisting(publicProfile?.verification_status, mergedDefaults.verificationStatus),
      reputation_score: keepExisting(publicProfile?.reputation_score, mergedDefaults.reputationScore),
      created_at: keepExisting(publicProfile?.created_at, now),
      updated_at: now
    },
    privatePayload: {
      user_id: user.id,
      contact_email: keepExisting(privateProfile?.contact_email, provider.email),
      contact_phone: keepExisting(privateProfile?.contact_phone, provider.phone),
      preferred_language: keepExisting(privateProfile?.preferred_language, mergedDefaults.preferredLanguage),
      onboarding_complete: Boolean(privateProfile?.onboarding_complete),
      notification_preferences: keepExisting(privateProfile?.notification_preferences, mergedDefaults.notificationPreferences),
      created_at: keepExisting(privateProfile?.created_at, now),
      updated_at: now
    },
    provider
  };
}

export function profileBootstrapStatus(privateProfile) {
  return {
    onboardingComplete: Boolean(privateProfile?.onboarding_complete),
    nextStep: privateProfile?.onboarding_complete ? "home" : "complete_profile"
  };
}

export async function bootstrapAuthenticatedProfile({ supabase, user, defaults = {} }) {
  if (!supabase) throw toDataError(new Error("Supabase client is required."), DATA_ERROR_CODES.SUPABASE_UNAVAILABLE);
  if (!user?.id) throw toDataError(new Error("Authenticated user is required."), DATA_ERROR_CODES.UNAUTHENTICATED);

  try {
    const [publicResult, privateResult] = await Promise.all([
      supabase.from("public_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("private_profiles").select("*").eq("user_id", user.id).maybeSingle()
    ]);

    if (publicResult.error) throw publicResult.error;
    if (privateResult.error) throw privateResult.error;

    const { publicPayload, privatePayload } = buildProfileBootstrapPayloads({
      user,
      publicProfile: publicResult.data,
      privateProfile: privateResult.data,
      defaults
    });

    const [publicUpsert, privateUpsert] = await Promise.all([
      supabase.from("public_profiles").upsert(publicPayload, { onConflict: "user_id" }).select("*").single(),
      supabase.from("private_profiles").upsert(privatePayload, { onConflict: "user_id" }).select("*").single()
    ]);

    if (publicUpsert.error) throw publicUpsert.error;
    if (privateUpsert.error) throw privateUpsert.error;

    return {
      user,
      publicProfile: publicUpsert.data,
      privateProfile: privateUpsert.data,
      createdPublicProfile: !publicResult.data,
      createdPrivateProfile: !privateResult.data,
      ...profileBootstrapStatus(privateUpsert.data)
    };
  } catch (error) {
    throw toDataError(error);
  }
}
