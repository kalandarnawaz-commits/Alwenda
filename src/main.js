import {
  adminStats,
  alwenActions,
  alwenBusinessDraft,
  alwenCapabilities,
  alwenListingDraft,
  alwenRecommendations,
  businesses,
  categories,
  city,
  COMMUNITY_POST_TYPES,
  cityGraph,
  earnToday,
  exploreHighlights,
  feedPosts,
  helpRequests,
  businessClaims,
  importedBusinesses,
  importSources,
  listings,
  liveAroundYou,
  livingCitySignals,
  marketplaceCapabilities,
  messageThreads,
  neighbourhoods,
  NOTIFICATION_FILTERS,
  notifications,
  offers,
  professionalCategories,
  profileReviews,
  reservations,
  reputationProfile,
  SEED_CITY_META,
  serviceProfessionals
} from "./data/mockData.js?v=production-sprint-24";
import { integrations } from "./services/integrationPlaceholders.js";
import {
  t,
  setLanguage,
  loadLocale,
  getCurrentLanguage,
  formatDate,
  formatCurrency,
  formatDistanceMeters,
  SUPPORTED_LANGUAGES
} from "./i18n/i18n.js?v=i18n-refactor-5";
import { fetchOverpassCategory, IMPORT_CATEGORIES } from "./services/dataImport/overpassClient.js?v=data-import-3";
import { queryLandmarksVilnius } from "./services/dataImport/wikidataClient.js?v=data-import-2";
import { fetchPublicServicesPlaceholder } from "./services/dataImport/openDataClient.js?v=data-import-2";
import { annotateDuplicates, haversineDistanceMeters } from "./services/dataImport/dedupe.js?v=data-import-2";
import { enrichAndValidate } from "./services/dataImport/enrichment.js?v=data-import-2";
import { readCache, writeCache, clearCache } from "./services/dataImport/cache.js?v=data-import-2";
import { CITY_ENTITY_CATEGORIES, buildDirectionsUrls } from "./services/dataImport/cityEntitySchema.js?v=data-import-4";
import { enrichWithGooglePlacePhotos, isGooglePlacesConfigured } from "./services/dataImport/googlePlacesClient.js?v=data-import-3";
import {
  isSupabaseConfigured,
  signInWithOAuthProvider,
  signInWithEmail,
  resetPasswordForEmail,
  updatePassword,
  signInWithPhoneOtp,
  verifyPhoneOtp,
  getCurrentSession,
  onAuthStateChange,
  signOutSupabase,
  mapSupabaseUserToAccount,
  ensureUserProfiles,
  completeUserProfile,
  createListing,
  getMyOfferorStatus,
  confirmOfferorStatus,
  getMyTraderVerification,
  saveTraderVerificationDraft,
  submitTraderVerification,
  uploadTraderVerificationDocument,
  fetchTraderVerificationQueue,
  reviewTraderVerification,
  recordTraderRegisterCheck,
  fetchTraderPublicProfile,
  fetchMyListings,
  uploadListingPhoto,
  fetchListingsByOwner,
  createHelpRequest,
  fetchMyHelpRequests,
  recordLegalAcceptance,
  createModerationReport,
  createPrivacyRequest,
  AUTH_CALLBACK_PATH
} from "./services/auth/supabaseClient.js?v=legal-compliance-1";
import { sendAlwenMessage } from "./services/alwenChatClient.js?v=alwen-chat-4";
import { isValidEmail, isValidPassword } from "./utils/validators.js?v=production-sprint-1";
import { checkRateLimit } from "./utils/rateLimit.js?v=production-sprint-1";

const CITY_CENTER = { lat: 54.6872, lng: 25.2797 }; // Vilnius, Cathedral Square — stand-in for real geolocation

const WEATHER_CONDITIONS = {
  en: { clear: "Clear", cloudy: "Cloudy", fog: "Foggy", rain: "Rain", snow: "Snow", storm: "Storms" },
  lt: { clear: "Giedra", cloudy: "Debesuota", fog: "Rūkas", rain: "Lietus", snow: "Sniegas", storm: "Audra" },
  de: { clear: "Klar", cloudy: "Bewölkt", fog: "Nebel", rain: "Regen", snow: "Schnee", storm: "Gewitter" }
};

const state = {
  language: "en",
  activeView: "home",
  area: "All",
  category: "all",
  exploreCategory: "All",
  exploreCuisine: "All",
  exploreStars: "All",
  exploreSort: "nearest",
  translateFromLanguage: "translate.language.langEnglish",
  translateToLanguage: "translate.language.langLithuanian",
  translateInputText: "",
  translateOutputText: "",
  translateStatus: "idle", // idle | loading | success | error
  translateVoiceNotice: null, // { panel: "from" | "to", message } when no TTS voice is installed for the chosen language
  translateInputMode: "text", // text | voice | camera — which mode card is active
  translateRecording: false,
  translateVoiceError: null,
  translateCameraStatus: "idle", // idle | reading | error
  translateCameraProgress: 0,
  translateCameraErrorMessage: null,
  query: "",
  discoverOpen: false,
  marketplaceCategoryChosen: false,
  exploreCategoryChosen: false,
  exploreCategoryVisitCounts: {},
  exploreOpenNowOnly: false,
  exploreVerifiedOnly: false,
  exploreHasPhotoOnly: false,
  activeSheet: null,
  cookieSettingsOpen: false,
  reportTarget: null,
  reportNotice: null,
  opportunityFilter: "nearby",
  opportunityCategory: "all",
  opportunityDistance: "all",
  headerSolid: false,
  alwenOpen: false,
  quickTranslateOpen: false,
  localWeather: null,
  alwenChat: {
    input: "",
    lastMessage: "",
    answer: "",
    conversationId: null,
    status: "idle",
    error: null,
    createdHelpRequest: null,
    createdListing: null
  },
  selectedBusinessId: null,
  selectedListingId: null,
  selectedPlaceId: null,
  selectedOpportunityId: null,
  activeConversationId: null,
  composerDraft: "",
  notificationFilter: "all",
  savedPlaceIds: [],
  auth: {
    status: "checking", // "checking" | "signedOut" | "signedIn"
    user: null,
    pendingVerification: null,
    authView: "login", // which auth screen renders while signed out: login | register | forgotPassword | verifyCode | completeProfile | resetPassword
    authError: null,
    authNotice: null, // informational (non-error) message, e.g. "check your email to confirm your account"
    passwordRecoveryActive: false // set true when Supabase reports a PASSWORD_RECOVERY session (user followed the reset-password email link)
  },
  hasOnboarded: false,
  onboardingStep: 0,
  welcomeSequenceStep: 0,
  canInstall: false,
  settings: {
    notifyMessages: true,
    notifyOffers: true,
    notifyCommunity: true,
    notifyBookings: true,
    notifyBusiness: true,
    notifyTyt: true,
    notifyPayments: true,
    notifyAlwen: true,
    notifySystem: true,
    theme: "system"
  },
  settingsConfirmDelete: false,
  businessDraft: null,
  publicProfile: null,
  reportedPeople: [],
  blockedPeople: [],
  helpfulPostIds: [],
  savedPostIds: [],
  hiddenPostIds: [],
  mutedTopics: [],
  communityFilter: "forYou",
  activePostId: null,
  communityPostDraft: { title: "", body: "", type: "discussion" },
  communityPostSubmitStatus: "idle",
  savedListingIds: [],
  reportedListings: [],
  hireCategory: null,
  helpRequestDraft: { text: "", urgency: "flexible" },
  helpRequestPosted: null,
  helpRequestError: null,
  helpRequestSubmitStatus: "idle",
  listingDraft: {
    title: "",
    description: "",
    category: "buy-sell",
    priceAmount: "",
    pricePeriod: "one_time",
    neighbourhood: "",
    condition: "",
    pickupAvailable: false,
    deliveryAvailable: false,
    offerorStatus: "",
    tags: "",
    photoFiles: []
  },
  listingSubmitStatus: "idle",
  listingSubmitError: null,
  offerorStatus: null,
  traderVerification: null,
  traderVerificationStatus: "idle",
  traderVerificationNotice: null,
  traderReviewQueue: [],
  traderPublicProfiles: {},
  myListings: [],
  myHelpRequests: [],
  bookingDraft: { dateIndex: null, time: null },
  bookingConfirmed: null,
  directionsOptions: null,
  cityImportRun: {
    source: "overpass",
    category: "Food & Drink",
    area: "Vilnius",
    mode: "nearby",
    status: "idle",
    results: [],
    attribution: "",
    error: null,
    lastRunAt: null,
    totalFound: 0,
    fromCache: false,
    tranche: { running: false, currentCategory: null, results: [] }
  }
};

const IMPORT_SOURCE_CATEGORIES = {
  overpass: IMPORT_CATEGORIES.map((value) => ({ value, label: value })),
  wikidata: [{ value: "Attractions", label: "Landmarks & museums" }],
  vilnius: [{ value: "Public Services", label: "Public services" }],
  geoportal: [{ value: "Public Services", label: "Public services" }]
};

const IMPORT_SOURCE_LABELS = {
  overpass: "OpenStreetMap / Overpass API",
  wikidata: "Wikidata SPARQL",
  vilnius: "Vilnius Open Data portal",
  geoportal: "Lithuanian Geoportal (geoportal.lt)"
};

/** Nearby/District/City-wide coverage modes. "City-wide" is a large-but-
 * bounded radius rather than a true administrative-boundary query — the
 * latter reliably times out against the public Overpass instance, so this
 * is the practical ceiling for "all of Vilnius" in one tranche. */
const IMPORT_MODE_RADIUS = { nearby: 2000, district: 5000, citywide: 9000 };

/* ============================================================
   AUTHENTICATION — Supabase only.
   Auth state is restored from Supabase Auth, profile completion is read
   from private_profiles.onboarding_complete, and the frontend never
   fabricates a successful OAuth/email/phone login.
   ============================================================ */

const ONBOARDED_KEY = "alwenda:onboarded";
const SETTINGS_KEY = "alwenda:settings";
const LANGUAGE_KEY = "alwenda:language";
const ANALYTICS_KEY = "alwenda:analytics";
const COOKIE_CONSENT_KEY = "alwenda:cookie-consent";
const PENDING_LEGAL_ACCEPTANCE_KEY = "alwenda:pending-legal-acceptance";
const MODERATION_RECORDS_KEY = "alwenda:moderation-records";
const LEGAL_POLICY_VERSION = "ALWENDA_LEGAL_POLICIES_EN-2026-07-18";
const ANALYTICS_MAX_EVENTS = 300;
const BUSINESS_OVERRIDES_KEY = "alwenda:businessOverrides";

/**
 * Claimed/edited business data, keyed by business id, layered on top of
 * the read-only importedBusinesses seed data at boot. There is no backend
 * to own this record, so "claiming" a business just links it to the
 * signed-in local account and persists any edits the owner makes —
 * exactly the same local-session pattern as the rest of auth.
 */
function loadBusinessOverrides() {
  return readLocalStorage(BUSINESS_OVERRIDES_KEY) || {};
}

function saveBusinessOverride(businessId, patch) {
  const overrides = loadBusinessOverrides();
  overrides[businessId] = { ...overrides[businessId], ...patch };
  writeLocalStorage(BUSINESS_OVERRIDES_KEY, overrides);
  const item = importedBusinesses.find((business) => business.id === businessId);
  if (item) Object.assign(item, overrides[businessId]);
  return overrides[businessId];
}

function applyBusinessOverrides() {
  const overrides = loadBusinessOverrides();
  Object.entries(overrides).forEach(([id, patch]) => {
    const item = importedBusinesses.find((business) => business.id === id);
    if (item) Object.assign(item, patch);
  });
}

function ownedBusinesses() {
  if (state.auth.status !== "signedIn") return [];
  return importedBusinesses.filter((item) => item.ownerId === state.auth.user.id);
}

/**
 * Public profile — a read-only card for anyone referenced elsewhere in the
 * app (a community post author, a marketplace seller, a Hire professional,
 * a reviewer), distinct from the signed-in user's own profile. There is no
 * shared "person" table backing these mock records, so only fields that
 * actually exist on the source record are shown — never a fabricated bio,
 * "member since" date, or language list for a name that's just a string
 * in an array.
 */
function publicProfileAttrs({ id, name, avatar, area, category, rating, reviews, verified, context, skills, responseTime, price, availability, distance }) {
  return [
    'data-public-profile="true"',
    `data-person-id="${escapeHtml(id || "")}"`,
    `data-person-name="${escapeHtml(name || "")}"`,
    `data-person-avatar="${escapeHtml(avatar || "")}"`,
    `data-person-area="${escapeHtml(area || "")}"`,
    `data-person-category="${escapeHtml(category || "")}"`,
    `data-person-rating="${rating || ""}"`,
    `data-person-reviews="${reviews || ""}"`,
    `data-person-verified="${verified ? "true" : ""}"`,
    `data-person-context="${context || ""}"`,
    `data-person-skills="${escapeHtml((skills || []).join(", "))}"`,
    `data-person-response-time="${escapeHtml(responseTime || "")}"`,
    `data-person-price="${escapeHtml(price || "")}"`,
    `data-person-availability="${escapeHtml(availability || "")}"`,
    `data-person-distance="${escapeHtml(distance || "")}"`
  ].join(" ");
}

/** Populates the "Active listings" section with the person's real,
 * published listings — harmless no-op for a mock person (fetchListingsByOwner
 * swallows the "not a real UUID" error and returns []). Fire-and-forget;
 * bails if the user has already navigated to a different profile by the
 * time it resolves. */
async function refreshPublicProfileListings(id) {
  if (!id) return;
  const items = await fetchListingsByOwner(id);
  if (state.publicProfile?.id !== id) return;
  state.publicProfile.listings = items;
  render();
}

function openPublicProfile(dataset) {
  state.publicProfile = {
    id: dataset.personId || "",
    name: dataset.personName || "",
    avatar: dataset.personAvatar || "",
    area: dataset.personArea || "",
    category: dataset.personCategory || "",
    rating: dataset.personRating || "",
    reviews: dataset.personReviews || "",
    verified: dataset.personVerified === "true",
    context: dataset.personContext || "",
    skills: dataset.personSkills || "",
    responseTime: dataset.personResponseTime || "",
    price: dataset.personPrice || "",
    availability: dataset.personAvailability || "",
    distance: dataset.personDistance || "",
    listings: []
  };
  state.activeSheet = null;
  state.activeView = "publicProfile";
  trackEvent("public_profile_viewed", { context: state.publicProfile.context });
  refreshPublicProfileListings(state.publicProfile.id);
  render();
}

/** Looks a person up by the stable id introduced alongside publicProfileAttrs
 * (see mockData.js: sellerId, authorId, review id, pro-<id>) so a public
 * profile URL can be rehydrated after a refresh or a shared link, not just
 * reached by clicking through the app in the same session. Same "no shared
 * person table" caveat as publicProfileAttrs above — each source is checked
 * independently, not merged into one identity. */
function findPersonById(id) {
  if (!id) return null;
  const pro = serviceProfessionals.find((item) => `pro-${item.id}` === id);
  if (pro) return { id, name: pro.name, area: pro.area, category: t(pro.categoryKey), rating: pro.rating, reviews: pro.reviews, verified: pro.verified, context: "hire", skills: pro.skills, responseTime: pro.responseTime, price: pro.price, availability: pro.availability, distance: pro.distance };
  const review = profileReviews.find((item) => item.id === id);
  if (review) return { id, name: review.author, avatar: review.avatar, context: "review" };
  const post = feedPosts.find((item) => item.authorId === id);
  if (post) return { id, name: post.author, avatar: post.avatar || reputationProfile.portrait, area: post.area, category: t((COMMUNITY_POST_TYPE_META[post.type] || COMMUNITY_POST_TYPE_META.discussion).labelKey), verified: post.verified, context: "community" };
  const listing = listings.find((item) => item.sellerId === id);
  if (listing) return { id, name: listing.seller, avatar: listing.sellerAvatar, area: listing.area, verified: listing.verifiedSeller, context: "marketplace" };
  const offer = offers.find((item) => `offer-${item.id}` === id);
  if (offer) return { id, name: offer.vendor, area: offer.area, context: "marketplace" };
  return null;
}

function openPublicProfileById(id) {
  const person = findPersonById(id);
  if (!person) return false;
  state.publicProfile = {
    id: person.id || "",
    name: person.name || "",
    avatar: person.avatar || "",
    area: person.area || "",
    category: person.category || "",
    rating: person.rating || "",
    reviews: person.reviews || "",
    verified: Boolean(person.verified),
    context: person.context || "",
    skills: (person.skills || []).join(", "),
    responseTime: person.responseTime || "",
    price: person.price || "",
    availability: person.availability || "",
    distance: person.distance || "",
    listings: []
  };
  refreshPublicProfileListings(state.publicProfile.id);
  return true;
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/** Real counts derived from this device's own analytics ring buffer —
 * not fabricated. Only reflects activity that happened in this browser
 * since there is no backend to aggregate views across other visitors. */
function businessStats(businessId) {
  if (readLocalStorage(COOKIE_CONSENT_KEY)?.analytics !== true) return { views: 0, directions: 0, calls: 0, website: 0, saves: 0, shares: 0 };
  const events = readLocalStorage(ANALYTICS_KEY) || [];
  const matches = (event, name) => event.name === name && (event.props?.businessId === businessId || event.props?.placeId === businessId);
  const count = (name) => events.filter((event) => matches(event, name)).length;
  return {
    views: count("business_viewed"),
    directions: count("directions_clicked"),
    calls: count("call_clicked"),
    website: count("website_clicked"),
    saves: count("place_saved"),
    shares: count("place_shared")
  };
}

function resetBusinessDraftFromItem(item) {
  state.businessDraft = {
    name: item.name || "",
    description: item.description || "",
    category: item.category || "",
    address: item.address || "",
    phone: item.phone || "",
    website: item.website || "",
    openingHours: item.openingHours || "",
    photoUrl: item.photoUrl || "",
    boosted: Boolean(item.boosted)
  };
}

function submitBusinessDashboardEdit(businessId) {
  const draft = state.businessDraft;
  if (!draft.name.trim()) return;
  saveBusinessOverride(businessId, {
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category,
    address: draft.address.trim(),
    phone: draft.phone.trim(),
    website: draft.website.trim(),
    openingHours: draft.openingHours.trim(),
    photoUrl: draft.photoUrl,
    photoStatus: "real"
  });
  trackEvent("business_edited", { businessId });
  render();
}

function toggleBusinessBoost(businessId) {
  const business = importedBusinesses.find((item) => item.id === businessId);
  const boosted = !business?.boosted;
  saveBusinessOverride(businessId, { boosted });
  trackEvent(boosted ? "business_boost_enabled" : "business_boost_disabled", { businessId });
  render();
}

/**
 * Local-only analytics scaffold — no backend/pipeline exists yet, so
 * events are appended to a bounded ring buffer in localStorage as a
 * stand-in sink. Swap the body of this function for a real analytics
 * SDK call later; every call site elsewhere in the app can stay as-is.
 * Payloads are restricted to ids/categories/counts — never names, emails,
 * phone numbers, or free-text the user typed.
 */
function trackEvent(name, props = {}) {
  const cookieConsent = readLocalStorage(COOKIE_CONSENT_KEY);
  if (cookieConsent?.analytics !== true) return;
  try {
    const existing = readLocalStorage(ANALYTICS_KEY) || [];
    existing.push({ name, props, ts: new Date().toISOString() });
    while (existing.length > ANALYTICS_MAX_EVENTS) existing.shift();
    writeLocalStorage(ANALYTICS_KEY, existing);
  } catch {
    /* analytics must never break the app */
  }
}

function bindErrorTracking() {
  window.addEventListener("error", (event) => {
    trackEvent("client_error", { message: String(event.message || "").slice(0, 200), source: event.filename || "" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    trackEvent("client_error", { message: String(event.reason?.message || event.reason || "").slice(0, 200), source: "promise" });
  });
}

function readLocalStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable (private mode, storage full, etc.) — the
       session simply won't survive a reload, which is an acceptable
       degradation for a local-only prototype session. */
  }
}

const RATE_LIMIT_KEY_PREFIX = "alwenda:rateLimit:";

/** Client-side throttle for auth actions (login, OTP, password reset) —
 * defense-in-depth against brute-forcing even before any server-side
 * throttling exists behind Supabase. Keyed per action + identifier (e.g.
 * the email/phone being attempted) so one slow user can't lock out another. */
function enforceRateLimit(action, identifier, options) {
  const key = `${RATE_LIMIT_KEY_PREFIX}${action}:${(identifier || "").toLowerCase().trim()}`;
  const now = Date.now();
  const result = checkRateLimit(readLocalStorage(key) || [], { now, ...options });
  if (result.allowed) {
    writeLocalStorage(key, [...result.timestamps, now]);
  }
  return result;
}

/** Supabase/OAuth providers report a failed redirect as query-string (or,
 * for some legacy flows, hash-fragment) params — never as something a try/
 * catch here could see, since the browser navigated here directly rather
 * than through our own code. Checks both locations since different failure
 * paths use different ones. */
function readOAuthCallbackError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  const raw = query.get("error_description") || hash.get("error_description") || query.get("error") || hash.get("error");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

function hydrateAuthFromStorage() {
  state.hasOnboarded = Boolean(readLocalStorage(ONBOARDED_KEY));
  const storedSettings = readLocalStorage(SETTINGS_KEY);
  if (storedSettings) state.settings = { ...state.settings, ...storedSettings };
}

function applySignedOutState() {
  state.auth.status = "signedOut";
  state.auth.user = null;
  state.auth.pendingVerification = null;
  state.myListings = [];
  if (state.activeView === "auth" && !state.auth.authView) state.auth.authView = "login";
}

async function applySupabaseSession(session, event = "INITIAL_SESSION") {
  if (event === "PASSWORD_RECOVERY") {
    state.auth.passwordRecoveryActive = true;
    state.auth.resetDraft = { password: "", confirmPassword: "" };
    state.auth.status = "signedIn";
    state.auth.authView = "resetPassword";
    state.activeView = "auth";
    return;
  }

  if (!session?.user) {
    applySignedOutState();
    return;
  }

  // Being signed in is defined purely by having a real Supabase Auth
  // session — never by whether the profile sync below succeeds. This runs
  // on every reload and every token refresh, so treating a transient
  // network blip or database hiccup there as "sign the user out" meant a
  // fully-authenticated user could get bounced back to the login screen at
  // any moment for a reason that had nothing to do with their session
  // actually being invalid.
  state.auth.status = "signedIn";
  state.auth.user = mapSupabaseUserToAccount(session.user);
  state.auth.authError = null;
  state.hasOnboarded = true;
  writeLocalStorage(ONBOARDED_KEY, true);
  // Fire-and-forget — "My Listings"/"My Requests" in Profile shouldn't
  // block sign-in on this; each refresh renders once it resolves.
  refreshMyListings();
  refreshMyHelpRequests();
  refreshTraderAccountState();
  const pendingAcceptance = readLocalStorage(PENDING_LEGAL_ACCEPTANCE_KEY);
  if (pendingAcceptance && (!pendingAcceptance.email || pendingAcceptance.email === String(session.user.email || "").toLowerCase())) {
    recordLegalAcceptance(pendingAcceptance).then(() => writeLocalStorage(PENDING_LEGAL_ACCEPTANCE_KEY, null)).catch((error) => console.warn("[legal] Acceptance record failed", error));
  }

  try {
    const profiles = await ensureUserProfiles();
    const account = mapSupabaseUserToAccount(profiles.user || session.user, profiles);
    state.auth.user = account;

    if (!account.profileComplete) {
      resetProfileDraftFromUser(account);
      state.auth.authView = "completeProfile";
      state.activeView = "auth";
      return;
    }
  } catch (error) {
    console.warn("[auth] Profile sync failed; staying signed in with basic account info.", error);
  }

  if (state.activeView === "auth" || state.activeView === "welcomeSequence") {
    state.activeView = "home";
  }
}

/** Real session restore + live sync via Supabase Auth. There is no local
 * fallback: when Supabase is not configured, users remain signed out and
 * auth actions show a configuration error instead of fabricating profiles. */
async function hydrateSupabaseAuth() {
  if (!isSupabaseConfigured()) {
    applySignedOutState();
    return;
  }

  try {
    await applySupabaseSession(await getCurrentSession());
    await onAuthStateChange(async (changedSession, event) => {
      try {
        await applySupabaseSession(changedSession, event);
      } catch (error) {
        state.auth.authError = error?.message || t("auth.authErrorGeneric");
        applySignedOutState();
      }
      render();
    });
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorGeneric");
    applySignedOutState();
  }
}

function persistSettings() {
  writeLocalStorage(SETTINGS_KEY, state.settings);
}

function persistLanguage() {
  writeLocalStorage(LANGUAGE_KEY, state.language);
}

function applyTheme() {
  const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const effective = state.settings.theme === "system" ? (systemPrefersDark ? "dark" : "light") : state.settings.theme;
  document.documentElement.dataset.theme = effective;
}

function bindThemeListener() {
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") applyTheme();
  });
}

/* "ops" (internal admin/city-import dashboard) is deliberately absent —
   no customer-facing route should ever advertise it. It stays reachable by
   a directly-typed URL for internal use (there's no backend role system in
   this app to gate it against), it's just never in this public registry
   and never linked from anywhere in the UI. */
const DEEP_LINK_VIEWS = new Set([
  "alwen",
  "home",
  "explore",
  "marketplace",
  "listings",
  "listingDetail",
  "create",
  "community",
  "contribute",
  "hire",
  "needHelp",
  "liveOpportunities",
  "liveOpportunityDetail",
  "businesses",
  "businessProfile",
  "businessClaim",
  "offers",
  "reservations",
  "translate",
  "profile",
  "auth",
  "onboarding",
  "settings",
  "notifications",
  "messages",
  "businessDashboard",
  "savedPlaces",
  "publicProfile",
  "legalTerms",
  "legalPrivacy",
  "legalCookies",
  "legalSafety",
  "traderVerification",
  "traderReview"
]);

/* Views whose deep link needs a companion ?id= to mean anything — read
   from and written to the URL alongside `view` by syncStateFromUrl /
   syncUrlToState below. */
const ID_LINKED_VIEWS = new Set(["publicProfile", "businessProfile", "listingDetail", "businessClaim", "liveOpportunityDetail"]);

/* A directly-typed URL for these still works (syncStateFromUrl honors
   them below) so the internal Ops/city-import tooling stays runnable —
   but they're excluded from DEEP_LINK_VIEWS so nothing in the UI ever
   turns them into a visible/shareable link (syncUrlToState only writes
   views that are in DEEP_LINK_VIEWS). */
const INTERNAL_URL_VIEWS = new Set(["ops", "cityImport"]);

let suppressNextUrlPush = false;
let lastPushedUrlKey = null;

function currentDeepLinkId() {
  if (state.activeView === "publicProfile") return state.publicProfile?.id || null;
  if (state.activeView === "businessProfile") return state.selectedBusinessId != null ? String(state.selectedBusinessId) : null;
  if (state.activeView === "listingDetail") return state.selectedListingId != null ? String(state.selectedListingId) : null;
  if (state.activeView === "businessClaim") return state.selectedPlaceId != null ? String(state.selectedPlaceId) : null;
  if (state.activeView === "liveOpportunityDetail") return state.selectedOpportunityId != null ? String(state.selectedOpportunityId) : null;
  return null;
}

/** Reads `view` (+ `id` for the views that need one) from the current URL
 * into state. Shared by boot and by the popstate handler below, so a
 * refresh and a Back/Forward tap both resolve the same way. */
function syncStateFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authError = searchParams.get("error_description") || hashParams.get("error_description") || searchParams.get("error") || hashParams.get("error");
  if (authError) {
    state.auth.authError = authError;
    state.auth.authView = "login";
    state.activeView = "auth";
    return;
  }
  const legalPathViews = { "/terms": "legalTerms", "/terms/": "legalTerms", "/privacy": "legalPrivacy", "/privacy/": "legalPrivacy", "/cookies": "legalCookies", "/cookies/": "legalCookies", "/safety": "legalSafety", "/safety/": "legalSafety" };
  const view = legalPathViews[window.location.pathname] || searchParams.get("view");
  if (!view || !(DEEP_LINK_VIEWS.has(view) || INTERNAL_URL_VIEWS.has(view))) return;
  state.activeView = view;
  const id = searchParams.get("id");
  if (!id || !ID_LINKED_VIEWS.has(view)) return;
  if (view === "publicProfile") openPublicProfileById(id);
  else if (view === "businessProfile") state.selectedBusinessId = Number(id);
  else if (view === "listingDetail") state.selectedListingId = id;
  else if (view === "businessClaim") state.selectedPlaceId = id;
  else if (view === "liveOpportunityDetail") state.selectedOpportunityId = id;
}

/** Keeps the address bar in sync with in-app navigation so browser Back/
 * Forward and page refresh both work, and item-level views (a listing, a
 * profile, a claim) are shareable. Called once at the end of every
 * render() — comparing against the last-pushed key means it's a no-op on
 * renders that don't actually change the "page" (typing in search, etc). */
function syncUrlToState() {
  if (suppressNextUrlPush) {
    suppressNextUrlPush = false;
    lastPushedUrlKey = `${state.activeView}:${currentDeepLinkId() || ""}`;
    return;
  }
  if (!DEEP_LINK_VIEWS.has(state.activeView)) return;
  const id = currentDeepLinkId();
  const key = `${state.activeView}:${id || ""}`;
  if (key === lastPushedUrlKey) return;
  lastPushedUrlKey = key;
  const legalViewPaths = { legalTerms: "/terms", legalPrivacy: "/privacy", legalCookies: "/cookies", legalSafety: "/safety" };
  if (legalViewPaths[state.activeView]) {
    history.pushState({ view: state.activeView }, "", legalViewPaths[state.activeView]);
    return;
  }
  const params = new URLSearchParams();
  params.set("view", state.activeView);
  if (id) params.set("id", id);
  history.pushState({ view: state.activeView, id }, "", `${window.location.pathname}?${params.toString()}`);
}

function bindHistoryNavigation() {
  window.addEventListener("popstate", () => {
    suppressNextUrlPush = true;
    syncStateFromUrl();
    render();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  /* Called after several top-level awaits (locale loading, Supabase
     session hydration), so the document's load event has already fired
     by this point — registering immediately instead of waiting on a
     "load" listener that would never fire again. */
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      /* The browser's own update check is throttled (roughly once per
         navigation, at most every 24h otherwise) — forcing one here means
         a release that shipped since the last visit is detected on this
         load instead of waiting on that schedule. */
      registration.update().catch(() => {});
    })
    .catch(() => {
      /* Offline caching is a progressive enhancement — the app works fine without it. */
    });
}

let deferredInstallPrompt = null;

function bindInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    state.canInstall = true;
    render();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    state.canInstall = false;
    trackEvent("app_installed", {});
    render();
  });
}

async function promptInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  state.canInstall = false;
  render();
}

function resetAuthDrafts() {
  state.auth.authError = null;
  state.auth.authNotice = null;
  state.auth.loginMode = "email";
  state.auth.loginDraft = { email: "", phone: "" };
  state.auth.registerDraft = { name: "", email: "", phone: "", agreeTerms: false, marketingConsent: false };
  state.auth.forgotDraft = { email: "" };
  state.auth.verifyDraft = { code: "" };
  state.auth.resetDraft = { password: "", confirmPassword: "" };
  state.auth.profileDraft = { name: "", role: "", avatar: "" };
  state.auth.visiblePasswordFields = {};
}

function goToAuthView(view) {
  state.auth.authError = null;
  state.auth.authNotice = null;
  state.auth.authView = view;
  state.activeView = "auth";
  render();
}

/** Turns a rate-limit result into the shared "too many attempts" error
 * message and applies it, so every gated auth action reports it the same way. */
function applyRateLimitError(result) {
  const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60000));
  state.auth.authError = t("auth.authErrorRateLimited", { minutes });
}

async function submitRegister() {
  const draft = state.auth.registerDraft;
  if (!isValidEmail(draft.email)) { state.auth.authError = t("auth.authErrorEmail"); render(); return; }
  if (!draft.agreeTerms) { state.auth.authError = t("auth.authErrorTerms"); render(); return; }
  writeLocalStorage(PENDING_LEGAL_ACCEPTANCE_KEY, {
    policyVersion: LEGAL_POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
    email: draft.email.trim().toLowerCase(),
    marketingConsent: Boolean(draft.marketingConsent)
  });

  const rateLimit = enforceRateLimit("register", draft.email, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) return void applyRateLimitError(rateLimit);

  if (!isSupabaseConfigured()) return void (state.auth.authError = t("auth.authErrorProviderNotConfigured"));

  try {
    await signInWithEmail({ email: draft.email.trim() });
    state.auth.authError = null;
    state.auth.authNotice = t("auth.authCheckEmailForSignIn");
    trackEvent("sign_up_started", { provider: "email" });
    goToAuthView("login");
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorEmailTaken");
    render();
  }
}

async function submitLoginEmail() {
  const draft = state.auth.loginDraft;
  if (!isValidEmail(draft.email)) return void (state.auth.authError = t("auth.authErrorEmail"));

  const rateLimit = enforceRateLimit("login-email", draft.email, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
  if (!rateLimit.allowed) return void applyRateLimitError(rateLimit);

  if (!isSupabaseConfigured()) return void (state.auth.authError = t("auth.authErrorProviderNotConfigured"));

  try {
    await signInWithEmail({ email: draft.email.trim() });
    state.auth.authError = null;
    state.auth.authNotice = t("auth.authCheckEmailForSignIn");
    trackEvent("sign_in_started", { provider: "email" });
    render();
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorNoAccount");
    render();
  }
}

async function submitLoginPhone() {
  const draft = state.auth.loginDraft;
  if (!draft.phone.trim()) return void (state.auth.authError = t("auth.authErrorPhone"));

  const rateLimit = enforceRateLimit("login-phone", draft.phone, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
  if (!rateLimit.allowed) return void applyRateLimitError(rateLimit);

  if (!isSupabaseConfigured()) return void (state.auth.authError = t("auth.authErrorProviderNotConfigured"));

  try {
    await signInWithPhoneOtp(draft.phone.trim());
    state.auth.pendingVerification = { method: "phone", target: draft.phone.trim(), purpose: "login", real: true };
    state.auth.authError = null;
    goToAuthView("verifyCode");
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorNoAccount");
    render();
  }
}

async function submitForgotPassword() {
  const draft = state.auth.forgotDraft;
  if (!isValidEmail(draft.email)) return void (state.auth.authError = t("auth.authErrorEmail"));

  const rateLimit = enforceRateLimit("forgot-password", draft.email, { maxAttempts: 3, windowMs: 15 * 60 * 1000 });
  if (!rateLimit.allowed) return void applyRateLimitError(rateLimit);

  if (!isSupabaseConfigured()) return void (state.auth.authError = t("auth.authErrorProviderNotConfigured"));

  try {
    await resetPasswordForEmail(draft.email.trim());
    state.auth.authError = null;
    state.auth.authNotice = t("auth.authCheckEmailForReset");
    goToAuthView("login");
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorNoAccount");
    render();
  }
}

async function submitVerifyCode() {
  const draft = state.auth.verifyDraft;
  const pending = state.auth.pendingVerification;

  const rateLimit = enforceRateLimit("verify-code", pending?.target, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
  if (!rateLimit.allowed) return void applyRateLimitError(rateLimit);

  if (!pending?.real) return void (state.auth.authError = t("auth.authErrorCode"));

  try {
    const data = await verifyPhoneOtp({ phone: pending.target, token: draft.code.trim() });
    await applySupabaseSession(data.session, "SIGNED_IN");
    state.auth.authError = null;
    trackEvent("sign_in", { method: "phone" });
    render();
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorCode");
    render();
  }
}

async function submitResetPassword() {
  const draft = state.auth.resetDraft;
  if (!isValidPassword(draft.password)) return void (state.auth.authError = t("auth.authErrorPassword"));
  if (draft.password !== draft.confirmPassword) return void (state.auth.authError = t("auth.authErrorPasswordMatch"));

  if (isSupabaseConfigured() && state.auth.passwordRecoveryActive) {
    try {
      await updatePassword(draft.password);
      state.auth.passwordRecoveryActive = false;
      state.auth.authError = null;
      state.auth.authNotice = t("auth.authPasswordUpdated");
      goToAuthView("login");
    } catch (error) {
      state.auth.authError = error?.message || t("auth.authErrorPassword");
      render();
    }
    return;
  }

  state.auth.authError = null;
  goToAuthView("login");
}

function resetProfileDraftFromUser(account) {
  state.auth.profileDraft = { name: account?.name || "", role: account?.role || "", avatar: account?.avatar || "" };
}

async function submitCompleteProfile() {
  const draft = state.auth.profileDraft;
  if (!draft.name.trim()) return void (state.auth.authError = t("auth.authErrorName"));
  const account = state.auth.user;
  if (!account) return void (state.auth.authError = t("auth.authErrorGeneric"));

  try {
    const profiles = await completeUserProfile({
      displayName: draft.name.trim(),
      profession: draft.role.trim(),
      avatarUrl: draft.avatar || account.avatar || null
    });
    state.auth.user = mapSupabaseUserToAccount(profiles.user, profiles);
    state.auth.status = "signedIn";
    state.auth.authError = null;
    trackEvent("profile_completed", {});
    state.activeView = "home";
    render();
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorName");
    render();
  }
}

const WELCOME_SEQUENCE_STEPS = [
  "onboarding.welcome.welcomeSequenceStep1",
  "onboarding.welcome.welcomeSequenceStep2",
  "onboarding.welcome.welcomeSequenceStep3",
  "onboarding.welcome.welcomeSequenceStep4"
];

async function signInWithProvider(provider) {
  if (!isSupabaseConfigured()) {
    state.auth.authError = provider === "google" ? "Google sign-in is not configured for this build." : t("auth.authErrorProviderNotConfigured");
    render();
    return;
  }
  try {
    await signInWithOAuthProvider(provider);
    // On success the browser navigates away to the provider's consent screen;
    // there is nothing further to render here on this page load.
  } catch (error) {
    state.auth.authError = error?.message || t("auth.authErrorProviderNotConfigured");
    render();
  }
}

async function signOut(scope = "local") {
  if (isSupabaseConfigured()) {
    try {
      await signOutSupabase(scope);
    } catch {
      /* Fall through and clear local state regardless — the user still ends up signed out locally. */
    }
  }
  trackEvent("sign_out", {});
  state.auth.status = "signedOut";
  state.auth.user = null;
  state.auth.pendingVerification = null;
  resetAuthDrafts();
  state.auth.authView = "login";
  state.activeView = "auth";
  render();
}

function completeOnboarding() {
  state.hasOnboarded = true;
  writeLocalStorage(ONBOARDED_KEY, true);
  render();
}

function formatDistance(meters) {
  return formatDistanceMeters(meters);
}

function distanceFromCenter(item) {
  const lat = item.lat ?? Number((item.coordinates || "").split(",")[0]);
  const lng = item.lng ?? Number((item.coordinates || "").split(",")[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return haversineDistanceMeters(CITY_CENTER.lat, CITY_CENTER.lng, lat, lng);
}

const OPENING_HOURS_DAY_CODES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function dayInOpeningHoursRange(dayPart, day) {
  return dayPart.split(",").some((part) => {
    if (part.includes("-")) {
      const [a, b] = part.split("-");
      const ai = OPENING_HOURS_DAY_CODES.indexOf(a);
      const bi = OPENING_HOURS_DAY_CODES.indexOf(b);
      const di = OPENING_HOURS_DAY_CODES.indexOf(day);
      if (ai < 0 || bi < 0 || di < 0) return false;
      return ai <= bi ? di >= ai && di <= bi : di >= ai || di <= bi;
    }
    return part === day;
  });
}

/** Lightweight parser for common OSM opening_hours syntax ("Mo-Fr
 * 08:00-20:00", "We-Sa 18:00-23:00", "24/7", ";"-separated rules).
 * Returns true/false when it can determine open/closed, or null when the
 * format isn't recognized — callers must treat null as "unknown", never
 * as closed. */
function isOpenNow(openingHours, now = new Date()) {
  if (!openingHours) return null;
  if (/24\/7/i.test(openingHours)) return true;
  const day = OPENING_HOURS_DAY_CODES[now.getDay()];
  const minutes = now.getHours() * 60 + now.getMinutes();
  const rules = openingHours.split(";").map((rule) => rule.trim());
  let matchedAnyRule = false;
  for (const rule of rules) {
    const match = /^([A-Za-z,-]+)\s+([\d:]+)-([\d:]+)/.exec(rule);
    if (!match) continue;
    matchedAnyRule = true;
    const [, dayPart, startStr, endStr] = match;
    if (!dayInOpeningHoursRange(dayPart, day)) continue;
    const [startHour, startMinute] = startStr.split(":").map(Number);
    const [endHour, endMinute] = endStr.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const withinRange = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (withinRange) return true;
  }
  return matchedAnyRule ? false : null;
}

/** Google Maps / Waze directions links — prefer the fields already stored
 * on the entity (every entity gets these from createCityEntity or the
 * mockData mapping); recompute only as a defensive fallback. */
function directionsUrl(item) {
  if (item.directionsGoogleUrl) return item.directionsGoogleUrl;
  const lat = item.lat ?? Number((item.coordinates || "").split(",")[0]);
  const lng = item.lng ?? Number((item.coordinates || "").split(",")[1]);
  return buildDirectionsUrls({ lat, lng, name: item.name, address: item.address }).directionsGoogleUrl;
}

function wazeUrl(item) {
  if (item.directionsWazeUrl) return item.directionsWazeUrl;
  const lat = item.lat ?? Number((item.coordinates || "").split(",")[0]);
  const lng = item.lng ?? Number((item.coordinates || "").split(",")[1]);
  return buildDirectionsUrls({ lat, lng, name: item.name, address: item.address }).directionsWazeUrl;
}

function appleMapsUrl(item) {
  if (item.directionsAppleUrl) return item.directionsAppleUrl;
  const lat = item.lat ?? Number((item.coordinates || "").split(",")[0]);
  const lng = item.lng ?? Number((item.coordinates || "").split(",")[1]);
  return buildDirectionsUrls({ lat, lng, name: item.name, address: item.address }).directionsAppleUrl;
}

/** Which category-specific quick action(s) apply beyond the universal
 * Directions/Waze/Call/Website row. Kept intentionally small — each one
 * routes to a real, already-existing flow (reservations view, tel:/site
 * links) rather than a new backend that doesn't exist. */
function categoryActionsFor(item) {
  const actions = [];
  if (item.category === "Food & Drink") {
    if (item.website) actions.push("menu");
    actions.push("reserve");
  } else if (item.category === "Hotels") {
    actions.push("book");
  } else if (item.category === "Pharmacy" || item.category === "Healthcare") {
    actions.push("hours");
  } else if (item.category === "Public Services") {
    actions.push("hours", "documents");
  }
  return actions;
}

function isPlaceSaved(item) {
  return state.savedPlaceIds.includes(item.id);
}

function toggleSavePlace(id) {
  state.savedPlaceIds = state.savedPlaceIds.includes(id)
    ? state.savedPlaceIds.filter((savedId) => savedId !== id)
    : [...state.savedPlaceIds, id];
  render();
}

/** navigator.share when available (mobile), otherwise copies a shareable
 * line to the clipboard — either way the user gets a real, working share,
 * not a decorative button. */
function sharePlace(item) {
  const text = `${item.name} — ${item.address || item.neighbourhood || "Vilnius"}`;
  const url = directionsUrl(item);
  if (navigator.share) {
    navigator.share({ title: item.name, text, url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(`${text}\n${url}`).catch(() => {});
}

function sharePost(post) {
  const title = post.titleKey ? t(post.titleKey) : post.title || "";
  const text = `${title} — ${post.bodyKey ? t(post.bodyKey) : post.body || ""}`;
  if (navigator.share) {
    navigator.share({ title, text }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(text).catch(() => {});
}

function shareListing(item) {
  const title = listingTitle(item);
  const url = `${window.location.origin}${window.location.pathname}?view=listingDetail&id=${item.id}`;
  if (navigator.share) {
    navigator.share({ title, text: `${title} — ${item.price}`, url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(url).catch(() => {});
}

function shareUserProfile(user) {
  const text = `${user.name} on Alwenda — ${profilePrimaryRoleLabel(user)}.`;
  if (navigator.share) {
    navigator.share({ title: user.name, text }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(text).catch(() => {});
}

async function fetchCategoryEntities(source, category, radius) {
  const cached = readCache(source, category, radius);
  if (cached) return { ok: true, fromCache: true, attribution: cached.payload.attribution, entities: cached.payload.entities };
  let result;
  if (source === "overpass") {
    result = await fetchOverpassCategory(category, { radiusMeters: radius });
  } else if (source === "wikidata") {
    result = await queryLandmarksVilnius({ radiusKm: radius / 1000 });
  } else {
    result = fetchPublicServicesPlaceholder(source === "geoportal" ? "geoportal" : "vilnius");
  }
  // Tier A of the photo priority chain — a genuine no-op (zero requests)
  // unless a real Google Places API key has been configured.
  if (result.ok && isGooglePlacesConfigured()) {
    result = { ...result, entities: await enrichWithGooglePlacePhotos(result.entities) };
  }
  if (result.ok) writeCache(source, category, radius, { attribution: result.attribution, entities: result.entities });
  return { ...result, fromCache: false };
}

function existingEntitiesForDedupe() {
  return importedBusinesses.map((item) => ({
    id: item.id,
    name: item.name,
    lat: item.lat ?? Number((item.coordinates || "").split(",")[0]) ?? null,
    lng: item.lng ?? Number((item.coordinates || "").split(",")[1]) ?? null
  }));
}

async function runCityImport() {
  const { source, category, mode } = state.cityImportRun;
  const radius = IMPORT_MODE_RADIUS[mode] || IMPORT_MODE_RADIUS.nearby;
  state.cityImportRun.status = "loading";
  state.cityImportRun.error = null;
  render();

  const result = await fetchCategoryEntities(source, category, radius);

  const PREVIEW_LIMIT = 20;
  const totalFound = result.entities.length;
  const limited = result.entities.slice(0, PREVIEW_LIMIT);
  const withDuplicates = annotateDuplicates(limited, existingEntitiesForDedupe());
  const withEnrichment = enrichAndValidate(withDuplicates);

  state.cityImportRun.status = result.ok ? "done" : "done-with-fallback";
  state.cityImportRun.results = withEnrichment;
  state.cityImportRun.totalFound = totalFound;
  state.cityImportRun.attribution = result.attribution;
  state.cityImportRun.error = result.error || null;
  state.cityImportRun.fromCache = Boolean(result.fromCache);
  state.cityImportRun.lastRunAt = new Date().toISOString();
  render();
}

/** Bulk tranche import: runs every category as its own cached fetch, then
 * auto-publishes non-duplicate results — the whole point of a tranche is
 * to populate a whole coverage area without reviewing each entity by hand.
 * Already-cached categories resolve instantly and never re-hit the API. */
async function runTrancheImport() {
  const mode = state.cityImportRun.mode;
  const radius = IMPORT_MODE_RADIUS[mode] || IMPORT_MODE_RADIUS.nearby;
  state.cityImportRun.tranche.running = true;
  state.cityImportRun.tranche.results = [];
  render();

  for (const category of IMPORT_CATEGORIES) {
    state.cityImportRun.tranche.currentCategory = category;
    render();
    const result = await fetchCategoryEntities("overpass", category, radius);
    const withDuplicates = annotateDuplicates(result.entities, existingEntitiesForDedupe());
    let imported = 0;
    withDuplicates.forEach((entity) => {
      if (entity.isDuplicate) return;
      publishEntity(entity);
      imported += 1;
    });
    state.cityImportRun.tranche.results.push({
      category,
      totalFound: result.entities.length,
      imported,
      duplicates: withDuplicates.length - imported,
      total: withDuplicates.length,
      missingPhoto: result.entities.filter((entity) => !entity.photoUrl || entity.photoStatus === "missing").length,
      missingAddress: result.entities.filter((entity) => !entity.address).length,
      fromCache: result.fromCache,
      lastUpdated: new Date().toISOString()
    });
    render();
  }

  state.cityImportRun.tranche.running = false;
  state.cityImportRun.tranche.currentCategory = null;
  render();
}

function clearImportCache() {
  clearCache();
  state.cityImportRun.fromCache = false;
  render();
}

function publishEntity(entity) {
  importedBusinesses.push({
    id: entity.id,
    name: entity.name,
    category: entity.category,
    subcategory: entity.subcategory,
    address: entity.address,
    neighbourhood: entity.neighbourhood,
    lat: entity.lat,
    lng: entity.lng,
    coordinates: entity.lat != null ? `${entity.lat}, ${entity.lng}` : "",
    phone: entity.phone || "",
    website: entity.website || "",
    openingHours: entity.openingHours || "",
    source: entity.source,
    sourceUrl: entity.sourceUrl,
    license: entity.license,
    sourceLicense: entity.license,
    sourceStatus: entity.sourceStatus || "open data",
    lastUpdated: entity.lastUpdated,
    verificationStatus: entity.verificationStatus,
    claimStatus: entity.claimStatus,
    rating: entity.rating,
    priceLevel: entity.priceLevel,
    tags: entity.tags,
    photos: entity.photos,
    photoUrl: entity.photoUrl,
    photoSource: entity.photoSource,
    photoAttribution: entity.photoAttribution,
    photoLicense: entity.photoLicense,
    photoStatus: entity.photoStatus,
    photoLastChecked: entity.photoLastChecked,
    directionsGoogleUrl: entity.directionsGoogleUrl,
    directionsWazeUrl: entity.directionsWazeUrl,
    description: entity.aiSummary,
    aiAttributes: entity.tags
  });
  entity.published = true;
}

function publishImportResult(entityId) {
  const entity = state.cityImportRun.results.find((item) => item.id === entityId);
  if (!entity || entity.isDuplicate) return;
  publishEntity(entity);
  render();
}

/** Collects the claim form and records it as a pending claim — still a
 * mock verification flow (no backend to check a real document/domain
 * against), but a real, working one: it actually stores what the owner
 * submitted rather than just decorating an inert form. */
function submitClaim(formData) {
  if (state.auth.status !== "signedIn") return;
  const businessId = state.selectedPlaceId;
  const business = importedBusinesses.find((item) => item.id === businessId);
  if (!business) return;

  const ownerName = (formData.get("ownerName") || "").toString().trim();
  const email = (formData.get("businessEmail") || "").toString().trim();
  if (!ownerName || !email) return;

  businessClaims.unshift({
    id: `claim-${Date.now()}`,
    businessId,
    ownerName,
    email,
    phone: (formData.get("phone") || "").toString().trim(),
    role: (formData.get("role") || "").toString().trim(),
    websiteProof: (formData.get("websiteProof") || "").toString().trim(),
    verificationMethod: (formData.get("verificationMethod") || "").toString().trim() || t("common.verificationMethod"),
    documentUpload: formData.get("document")?.name || t("common.documentUpload"),
    status: "pending"
  });

  // Submitting a claim links the business to the signed-in account and
  // makes it manageable right away, but verification itself is a
  // separate step — the business stays "Pending" (not "Verified") until
  // that review actually happens, so the UI never claims a check that
  // hasn't been done.
  saveBusinessOverride(businessId, { claimStatus: "Claimed", verificationStatus: "Pending", ownerId: state.auth.user.id });
  trackEvent("business_claim_submitted", { businessId });

  state.activeView = "businessDashboard";
  render();
}

const iconMap = {
  home: "⌂",
  explore: "🧭",
  navMarketplace: "🛍️",
  navCommunity: "💬",
  search: "⌕",
  city: "◫",
  building: "▥",
  people: "◎",
  food: "◒",
  stay: "⌂",
  shop: "◇",
  tag: "◇",
  work: "▣",
  briefcase: "▣",
  service: "⚙",
  tool: "⚙",
  translate: "A⇄",
  swap: "⇄",
  speaker: "🔊",
  recordMic: "🎤",
  translateTextMode: "💬",
  translateCameraMode: "📷",
  uploadImageMode: "🖼️",
  uploadDocumentMode: "📄",
  stop: "⏹",
  profile: "◉",
  ops: "▦",
  calendar: "◷",
  pin: "⌖",
  vehicle: "▬",
  help: "?",
  chat: "◦",
  bell: "○",
  message: "□",
  mic: "◌",
  image: "▧",
  camera: "◉",
  file: "▤",
  pay: "€",
  map: "⌖",
  star: "★",
  import: "⇣",
  heart: "♡",
  plus: "+",
  verify: "✓",
  check: "✓",
  contribute: "✎",
  trust: "◆",
  arrow: "→",
  spark: "✦",
  exit: "⏻",
  settings: "⚙",
  alwen: ""
};

/* Official Alwenda SVG assets only — never recreated in CSS/text. Keyed by
   the tone of the surface the logo sits ON: "light" surface needs the
   dark/black-ink asset, "dark" surface needs the white asset. */
const BRAND_ASSETS = {
  wordmark: {
    light: "/src/assets/brand/alwenda-wordmark-black.svg",
    dark: "/src/assets/brand/alwenda-wordmark-white.svg"
  },
  icon: {
    light: "/src/assets/brand/alwenda-icon-dark.svg",
    dark: "/src/assets/brand/alwenda-icon-white.svg"
  }
};

function BrandLogo({ variant = "icon", tone = "light", size = "md", className = "" } = {}) {
  const src = BRAND_ASSETS[variant][tone];
  const alt = variant === "wordmark" ? t("common.appName") : "";
  return `<img class="brand-logo brand-logo-${variant} brand-logo-${size} ${className}" src="${src}" alt="${alt}" />`;
}

function timeOfDaySuffix() {
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 18) return "Evening";
  if (hour < 12) return "Morning";
  return "";
}

function weatherCondition(code) {
  const labels = WEATHER_CONDITIONS[state.language] || WEATHER_CONDITIONS.en;
  if (code === 0) return ["☀️", labels.clear];
  if ([1, 2, 3].includes(code)) return ["☁️", labels.cloudy];
  if ([45, 48].includes(code)) return ["🌫️", labels.fog];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["❄️", labels.snow];
  if ([95, 96, 99].includes(code)) return ["⛈️", labels.storm];
  return ["🌧️", labels.rain];
}

async function refreshLocalWeather() {
  try {
    const params = new URLSearchParams({
      latitude: String(CITY_CENTER.lat),
      longitude: String(CITY_CENTER.lng),
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
      timezone: "auto"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
    const payload = await response.json();
    if (!Number.isFinite(payload.current?.temperature_2m)) throw new Error("Weather response is incomplete");
    state.localWeather = payload.current;
    if (state.activeView === "home") render();
  } catch {
    /* Weather is progressive context: keep the existing neutral fallback
       instead of surfacing network/provider errors in the Home hero. */
  }
}

function currentLivingCitySignals() {
  if (!state.localWeather) return livingCitySignals;
  const [emoji, condition] = weatherCondition(state.localWeather.weather_code);
  const temperature = Math.round(state.localWeather.temperature_2m);
  const feelsLike = Math.round(state.localWeather.apparent_temperature);
  const wind = Math.round(state.localWeather.wind_speed_10m);
  return [
    {
      ...livingCitySignals[0],
      value: `${temperature}°C`,
      detail: `${emoji} ${condition} · 🌡️ ${feelsLike}°C · 💨 ${wind} km/h`
    },
    ...livingCitySignals.slice(1)
  ];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function brandIconMarkup(sizeClass = "app-icon") {
  return `
    <span class="brand-icon-swap ${sizeClass}-frame" aria-hidden="true">
      ${BrandLogo({ variant: "icon", tone: "light", className: `${sizeClass} brand-dark` })}
      ${BrandLogo({ variant: "icon", tone: "dark", className: `${sizeClass} brand-light` })}
    </span>
  `;
}

/* Single source of truth for the app header brand lockup. Renders the
   official wordmark SVG only — no standalone icon may appear beside it.
   The icon glyph is reserved for the app icon, splash, floating Alwen
   assistant, bottom nav, notifications, and loading animation. */
function BrandHeader() {
  return `
    <div class="brand" aria-label="${t("common.appName")}">
      <button class="brand-main" data-view="home" aria-label="${t("nav.home")}">
        <span class="brand-wordmark-swap">
          ${BrandLogo({ variant: "wordmark", tone: "light", className: "brand-wordmark brand-wordmark-dark" })}
          ${BrandLogo({ variant: "wordmark", tone: "dark", className: "brand-wordmark brand-wordmark-light" })}
        </span>
      </button>
      <button class="brand-city" data-sheet="city" type="button">${currentAreaLabel()}</button>
    </div>
  `;
}

function verifiedCheck(label = t("status.verified")) {
  return `<span class="verified-check" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon("verify")}</span>`;
}

function icon(name) {
  if (name === "app" || name === "alwen") {
    return brandIconMarkup("app-icon");
  }
  return `<span class="icon" aria-hidden="true">${iconMap[name] || "•"}</span>`;
}

/** Shared premium language-picker row — flag, native name, English name,
 * checkmark on the active one — reused by the language sheet, Settings,
 * and onboarding so switching languages feels like one considered piece
 * of UI instead of three different plain chip rows. */
function renderLanguageOptionButton(language) {
  const isSelected = state.language === language.code;
  return `
    <button class="language-option-row ${isSelected ? "is-selected" : ""}" data-language-option="${language.code}">
      <span class="language-option-flag">${language.flag}</span>
      <span class="language-option-names">
        <strong>${language.nativeName}</strong>
        <span>${language.name}</span>
      </span>
      <span class="language-option-check">${icon("check")}</span>
    </button>
  `;
}

/* Every "no results" state across the app (search, business directory,
   professionals list) was a single unstyled <p class="empty"> — no
   icon, no visual weight, easy to mistake for a loading glitch rather
   than a real "nothing matched" message. One shared, properly designed
   component instead of five copies of plain text. */
function renderEmptyState(message, iconName = "search") {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon(iconName)}</span>
      <p>${message}</p>
    </div>
  `;
}

/* Literal pictorial icons for the marketplace category chips — these need
   to actually look like their category (a handshake, a car, a building),
   which the app's abstract geometric glyph set (iconMap above) can't do,
   so they're hand-drawn inline SVGs instead of single Unicode characters. */
/* Inline SVG pin — the iconMap's "⌖" glyph renders as a stray coloured
   emoji-style symbol on some platforms, which read as broken/off-brand
   on the photo-overlay distance badge and address line. A drawn SVG
   renders identically everywhere. */
function pinIcon() {
  return `<span class="icon place-pin-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/></svg></span>`;
}

/* Simplified, hand-drawn marks recognisable as each navigation app's own
   icon (brand-colour pin / mascot silhouette) so the "choose an app"
   sheet reads as real app icons rather than one generic pin repeated
   three times — drawn locally rather than fetched, since there's no
   network access to pull the real trademarked artwork here. */
const NAVIGATION_APP_ICON_SVG = {
  google: `<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#fff"/><circle cx="24" cy="21" r="9" fill="#EA4335"/><path d="M15 22 L24 38 L33 22 Z" fill="#EA4335"/><circle cx="24" cy="21" r="4" fill="#fff"/><circle cx="14" cy="10" r="2.6" fill="#4285F4"/><circle cx="24" cy="7" r="2.6" fill="#FBBC05"/><circle cx="34" cy="10" r="2.6" fill="#34A853"/></svg>`,
  apple: `<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#F2F2F7"/><path d="M10 34 L20 14 L28 28 L38 12" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="26" r="8" fill="#3478F6"/><circle cx="26" cy="26" r="3" fill="#fff"/></svg>`,
  waze: `<svg viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#CFEFFF"/><circle cx="24" cy="23" r="14" fill="#05C1FF"/><circle cx="18" cy="20" r="2.3" fill="#12203A"/><circle cx="30" cy="20" r="2.3" fill="#12203A"/><path d="M17 28 Q24 34 31 28" fill="none" stroke="#12203A" stroke-width="2.2" stroke-linecap="round"/></svg>`
};

function navigationAppIcon(key) {
  return `<span class="icon nav-app-icon" aria-hidden="true">${NAVIGATION_APP_ICON_SVG[key] || ""}</span>`;
}

function phoneIcon() {
  return `<span class="icon place-pin-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z"/></svg></span>`;
}

function navIcon(iconName) {
  return icon(iconName);
}

function carouselId(key) {
  return `carousel-${String(key).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function renderCarousel(labelKey, trackClass, cards) {
  const id = carouselId(labelKey);
  const shellClass = trackClass.includes("marketplace-rail") ? " carousel-shell-marketplace" : "";
  return `
    <div class="carousel-shell${shellClass}">
      <button class="carousel-control carousel-control-left" data-carousel-control="${id}" data-carousel-direction="-1" aria-label="${t("common.scrollLeft")}" type="button">${icon("arrow")}</button>
      <div id="${id}" class="carousel-track ${trackClass}" tabindex="0">
        ${cards}
      </div>
      <button class="carousel-control carousel-control-right" data-carousel-control="${id}" data-carousel-direction="1" aria-label="${t("common.scrollRight")}" type="button">${icon("arrow")}</button>
    </div>
  `;
}

function updateCarouselControls(track) {
  const shell = track.closest(".carousel-shell");
  if (!shell) return;
  const left = shell.querySelector(".carousel-control-left");
  const right = shell.querySelector(".carousel-control-right");
  const canScroll = track.scrollWidth > track.clientWidth + 2;
  const atStart = track.scrollLeft <= 2;
  const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  if (left) left.disabled = !canScroll || atStart;
  if (right) right.disabled = !canScroll || atEnd;
}

function bindCarousels() {
  document.querySelectorAll(".carousel-track").forEach((track) => {
    updateCarouselControls(track);
    track.addEventListener("scroll", () => updateCarouselControls(track), { passive: true });
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
      track.addEventListener(eventName, () => track.classList.remove("is-programmatic-scroll"), { passive: true });
    });
  });

  document.querySelectorAll("[data-carousel-control]").forEach((button) => {
    const handleCarouselClick = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const track = document.getElementById(button.dataset.carouselControl);
      if (!track) return;
      const firstCard = track.firstElementChild;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
      const cardWidth = firstCard ? firstCard.getBoundingClientRect().width + gap : track.clientWidth * 0.86;
      const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
      const nextLeft = Math.min(maxLeft, Math.max(0, track.scrollLeft + (cardWidth * Number(button.dataset.carouselDirection || 1))));
      track.classList.add("is-programmatic-scroll");
      track.scrollTo({
        left: nextLeft,
        behavior: "smooth"
      });
      window.setTimeout(() => {
        updateCarouselControls(track);
      }, 360);
    };
    button.onclick = handleCarouselClick;
    button.addEventListener("click", handleCarouselClick, { capture: true });
  });
}

/** Single source of truth for opening a place's detail sheet — every
 * PlaceCard variant (grid, compact/coverflow, center or side slide) calls
 * this instead of duplicating the state.selectedPlaceId/activeSheet/
 * trackEvent/render() sequence. A missing or unrecognised id is refused
 * rather than opening a broken sheet (renderPlaceDetailSheet expects to
 * find a matching business by id). */
function openPlaceDetail(placeId) {
  if (!placeId) {
    console.warn("[place-card] Missing place id — navigation disabled.");
    return;
  }
  const item = importedBusinesses.find((business) => business.id === placeId);
  if (!item) {
    console.warn(`[place-card] No place found for id "${placeId}" — navigation disabled.`);
    return;
  }
  state.selectedPlaceId = placeId;
  state.activeSheet = "place";
  trackEvent("business_viewed", { businessId: placeId, category: item.category });
  render();
}

/** Cover-Flow 3D scroller: a real horizontally-scrollable track underneath
 * (touch/trackpad/scrollbar drag all just work) — this only decorates each
 * slide's transform based on how far its center actually is from the
 * viewport's center, recomputed on every scroll frame via rAF throttling.
 * Tapping a slide that isn't centered yet scrolls it to center instead of
 * opening it straight away, so "bring forward" and "open" stay distinct
 * gestures, matching how a physical cover-flow rack behaves. */
function bindCoverflow() {
  document.querySelectorAll("[data-coverflow]").forEach((viewport) => {
    const slides = [...viewport.querySelectorAll(".coverflow-slide")];
    if (!slides.length) return;

    let queued = false;
    const update = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const centerX = viewportRect.left + viewportRect.width / 2;
      let closest = slides[0];
      let closestDistance = Infinity;
      slides.forEach((slide) => {
        const rect = slide.getBoundingClientRect();
        const slideCenterX = rect.left + rect.width / 2;
        const delta = slideCenterX - centerX;
        const normalized = Math.max(-1, Math.min(1, delta / (viewportRect.width / 2)));
        const rotateY = normalized * -34;
        const translateZ = -Math.abs(normalized) * 160;
        const translateX = normalized * -18;
        const scale = 1 - Math.abs(normalized) * 0.24;
        slide.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
        slide.style.opacity = String(Math.max(0.35, 1 - Math.abs(normalized) * 0.5));
        slide.style.zIndex = String(Math.round((1 - Math.abs(normalized)) * 100));
        if (Math.abs(delta) < closestDistance) {
          closestDistance = Math.abs(delta);
          closest = slide;
        }
      });
      slides.forEach((slide) => slide.classList.toggle("is-active", slide === closest));
      queued = false;
    };

    viewport.addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }, { passive: true });

    /* Transformed cover-flow slides do not consistently deliver their
       bubbling click to the per-card listener in every browser (notably
       iOS Safari). Handle activation at the stable viewport instead. */
    viewport.addEventListener("click", (event) => {
      const card = event.target.closest('[data-sheet="place"][data-place-id]');
      if (!card || !viewport.contains(card)) return;
      event.preventDefault();
      event.stopPropagation();
      openPlaceDetail(card.dataset.placeId);
    });

    /* Keyboard equivalent of the click handler above — only fires when the
       card itself (not a nested favourite/action button) has focus, so
       Enter/Space on those buttons keeps triggering their own handler
       instead of also opening the sheet. */
    viewport.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
      const card = event.target.closest('[data-sheet="place"][data-place-id]');
      if (!card || event.target !== card || !viewport.contains(card)) return;
      event.preventDefault();
      openPlaceDetail(card.dataset.placeId);
    });

    update();
  });
}

/** Every seeded listing carries a titleKey/metaKey (translated mock copy),
 * but a real, user-created listing has plain title/meta strings instead —
 * there's no locale entry to look one up by. Preferring the plain field
 * when present is the same fallback renderHelpRequest() already uses for
 * user-created help requests. */
function listingTitle(item) {
  return item.title || t(item.titleKey);
}

function listingMeta(item) {
  if (item.meta) return item.meta;
  return item.metaKey ? t(item.metaKey) : "";
}

/** Mock listings always have every field (distance, response time,
 * reputation); real ones often don't, and joining those with a fixed
 * " · " template leaves a dangling separator ("Vilnius · ") instead of
 * just omitting the missing part. */
function joinNonEmpty(parts, separator = " · ") {
  return parts.filter(Boolean).join(separator);
}

function categoryLabel(type) {
  const key = `category.marketplace.cat${type.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase()).replaceAll("-", "")}`;
  return t(key) || type;
}

function currentAreaLabel() {
  return state.area === "All" ? city.name : state.area;
}

function renderSheet() {
  if (!state.activeSheet) return "";

  if (state.activeSheet === "city") {
    return `
      <div class="sheet-backdrop" data-sheet-close="true">
        <section class="selection-sheet" aria-label="${t("common.chooseCity")}">
          <div class="sheet-handle"></div>
          <div class="sheet-title">
            <div><h2>${t("home.citySheetTitle")}</h2><p>${t("home.citySheetHint")}</p></div>
            <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
          </div>
          <div class="sheet-option-grid">
            ${["All", ...neighbourhoods].map((area) => `
              <button class="${state.area === area ? "is-selected" : ""}" data-area-option="${area}">
                <strong>${area === "All" ? city.name : area}</strong>
                <span>${area === "All" ? t("common.launchCity") : t("home.rail.neighbourhood")}</span>
              </button>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  if (state.activeSheet === "language") {
    return `
      <div class="sheet-backdrop" data-sheet-close="true">
        <section class="selection-sheet language-sheet" aria-label="${t("common.languageSheetTitle")}">
          <div class="sheet-handle"></div>
          <div class="sheet-title">
            <div><h2>${t("common.languageSheetTitle")}</h2><p>${t("common.languageSheetHint")}</p></div>
            <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
          </div>
          <div class="language-option-list">
            ${SUPPORTED_LANGUAGES.map(renderLanguageOptionButton).join("")}
          </div>
        </section>
      </div>
    `;
  }

  if (state.activeSheet === "tyt") {
    return renderTytSheet();
  }

  if (state.activeSheet === "place") {
    return renderPlaceDetailSheet(importedBusinesses.find((business) => business.id === state.selectedPlaceId));
  }

  if (state.activeSheet === "booking") {
    return renderBookingSheet();
  }

  if (state.activeSheet === "directions") {
    return renderDirectionsSheet();
  }

  if (state.activeSheet === "communityComposer") {
    return renderCommunityComposerSheet();
  }

  if (state.activeSheet === "postActions") {
    return renderPostActionsSheet();
  }

  if (state.activeSheet === "postDetail") {
    return renderPostDetailSheet();
  }

  return "";
}

/** Directions used to be three separate buttons (Google Maps, Waze,
 * Apple Maps) crowding every place card's action row. One "Directions"
 * button now opens this picker so the user chooses their navigation
 * app at the moment they actually need it, instead of the choice being
 * pre-made by which button happened to be first. */
function renderDirectionsSheet() {
  const options = state.directionsOptions;
  if (!options) return "";
  const apps = [
    { url: options.google, labelKey: "common.googleMaps", iconKey: "google" },
    { url: options.apple, labelKey: "common.appleMaps", iconKey: "apple" },
    { url: options.waze, labelKey: "common.waze", iconKey: "waze" }
  ].filter((app) => app.url);

  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet directions-sheet" aria-label="${t("common.chooseNavigationApp")}">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <div><h2>${t("common.chooseNavigationApp")}</h2><p>${t("common.chooseNavigationAppHint")}</p></div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>
        <div class="directions-app-list">
          ${apps.map((app) => `
            <a class="directions-app-row" href="${app.url}" target="_blank" rel="noopener noreferrer" data-sheet-close="true">
              <span class="directions-app-icon">${navigationAppIcon(app.iconKey)}</span>
              <span>${t(app.labelKey)}</span>
              ${icon("arrow")}
            </a>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

/** The polished, single-place detail view — large photo, quick actions,
 * about copy, contact, a few similar nearby places, and a quiet claim CTA
 * at the very bottom (never the headline action). Reuses the same
 * .sheet-backdrop/.selection-sheet shell as the city/language/TYT sheets. */
function renderPlaceDetailSheet(item) {
  if (!item) return "";
  const distance = formatDistance(distanceFromCenter(item));
  const similar = importedBusinesses
    .filter((other) => other.id !== item.id && other.category === item.category)
    .map((other) => ({ other, distance: distanceFromCenter(other) }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, 4)
    .map(({ other }) => other);

  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet place-detail-sheet" aria-label="${escapeHtml(item.name)}">
        <div class="sheet-handle"></div>
        <div class="place-detail-photo">${renderPlacePhoto(item)}</div>
        <div class="sheet-title">
          <div>
            <span class="badge category-chip">${categoryIconFor(item)} ${businessCategoryLabel(item.category)}</span>
            ${item.rating ? `<span class="badge badge-rating">${icon("star")}${item.rating}</span>` : ""}
            <h2>${item.name}</h2>
            ${realPlaceSpecialty(item) ? `<p class="place-detail-specialty">${realPlaceSpecialty(item)}</p>` : ""}
            <p>${item.address || item.neighbourhood || "Vilnius"}${distance ? ` · ${distance}` : ""}</p>
          </div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>
        ${
          item.openingHours || renderOpenStatusBadge(item)
            ? `<div class="place-detail-status">${renderOpenStatusBadge(item)}${item.openingHours ? `<span class="place-detail-hours">${escapeHtml(item.openingHours)}</span>` : ""}</div>`
            : ""
        }
        ${renderPlaceActionButtons(item)}
        ${
          item.phone || item.website || item.email
            ? `<div class="place-detail-section">
                 <h3>${t("common.contactDetails")}</h3>
                 <p class="place-detail-contact-list">
                   ${[
                     item.phone ? `<a href="tel:${item.phone}">${item.phone}</a>` : "",
                     item.website ? `<a href="${item.website}" target="_blank" rel="noopener noreferrer">${item.website.replace(/^https?:\/\//, "")}</a>` : "",
                     item.email ? `<a href="mailto:${item.email}">${item.email}</a>` : ""
                   ]
                     .filter(Boolean)
                     .join(" · ")}
                 </p>
               </div>`
            : ""
        }
        ${
          honestPlaceDescription(item)
            ? `<div class="place-detail-section"><h3>${t("common.about")}</h3><p>${honestPlaceDescription(item)}</p></div>`
            : ""
        }
        ${
          similar.length
            ? `<div class="place-detail-section">
                 <h3>${t("common.similarNearby")}</h3>
                 <div class="place-detail-similar-list">
                   ${similar
                     .map(
                       (other) => `
                     <button type="button" class="place-detail-similar-item" data-sheet="place" data-place-id="${other.id}">
                       <span class="place-photo-mini">${renderPlacePhoto(other)}</span>
                       <span class="place-detail-similar-text">
                         <strong>${other.name}</strong>
                         <small>${formatDistance(distanceFromCenter(other)) || other.category}</small>
                       </span>
                     </button>
                   `
                     )
                     .join("")}
                 </div>
               </div>`
            : ""
        }
        <div class="place-detail-footer">
          <span class="imported-source-meta">${t("business.sourceLabel")}: ${friendlySourceLabel(item)}</span>
          <div class="place-footer-actions">
            <button type="button" class="icon-action ${isPlaceSaved(item) ? "is-active" : ""}" data-action="toggle-save" data-place-id="${item.id}" aria-label="${t("common.favourite")}">${icon("heart")}</button>
            <button type="button" class="icon-action" data-action="share-place" data-place-id="${item.id}" aria-label="${t("common.share")}">${icon("arrow")}</button>
            <button type="button" class="claim-subtle" data-view="businessClaim" data-place-id="${item.id}">${t("business.claim.ownThisBusiness")}</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function matchesQuery(text) {
  const tokens = state.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2 && !["the", "and", "near", "with", "for", "today", "need", "someone", "under"].includes(token));

  if (!tokens.length) return true;

  /* "service"/"professional"/"available" used to be included here on
     nearly every hire-related entry as generic catch-all synonyms — but
     those words show up as substrings of totally unrelated content (a
     bicycle listing described as "Recently serviced", a business typed
     "service-apartments"), so a search for "cleaner" was matching a bike.
     Kept only the specific synonyms that actually discriminate; a hire
     professional's own category text ("Cleaning & childcare", "Plumbing &
     repairs") already contains these words, so nothing true-positive is
     lost by dropping the generic ones. */
  const intentTerms = {
    dinner: ["restaurant", "bistro", "food", "lunch"],
    eat: ["restaurant", "bistro", "food", "lunch"],
    halal: ["halal", "restaurant", "food", "nearby"],
    menu: ["translate", "translation", "camera"],
    translate: ["translation", "menu", "language"],
    stay: ["hotel", "apartment", "suite"],
    apartment: ["rentals", "studio", "bedroom", "furnished"],
    bedroom: ["rentals", "apartment", "studio"],
    bicycle: ["bike", "vehicle", "sell"],
    sell: ["buy-sell", "marketplace", "available"],
    sleep: ["hotel", "apartment", "suite"],
    fix: ["repair", "screen", "phone"],
    plumber: ["plumbing", "repair"],
    cleaner: ["cleaning"],
    book: ["booking", "restaurant"],
    help: ["quote"],
    assemble: ["ikea", "furniture", "repair"],
    ikea: ["assembly", "furniture", "repair"],
    furniture: ["assembly", "moving", "repair"],
    plumbing: ["plumber", "repair"],
    cleaning: ["cleaner"],
    electrical: ["electrical", "repair"],
    tutoring: ["tutoring", "teacher"],
    childcare: ["childcare"],
    photography: ["photography", "events"],
    moving: ["moving"],
    legal: ["legal", "contracts"],
    accounting: ["accounting", "tax"],
    support: ["it support", "devices"],
    doctor: ["clinic", "medical", "health"],
    medicine: ["pharmacy", "health"],
    job: ["barista", "hiring", "shift"],
    event: ["market", "makers", "weekend"]
  };

  const expanded = tokens.flatMap((token) => [token, ...(intentTerms[token] || [])]);
  const normalizedText = text.toLowerCase();
  /* Word-boundary match, not a raw substring check — otherwise a term
     like "service" would also match "serviced" or "service-apartments",
     content that has nothing to do with what was actually typed. */
  return expanded.some((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(normalizedText));
}

function queryScore(text) {
  const tokens = state.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2);
  const normalizedText = text.toLowerCase();
  return tokens.reduce((score, token) => score + (normalizedText.includes(token) ? 2 : 0), 0);
}

function routeForQuery() {
  const q = state.query.toLowerCase();
  if (/(assemble|ikea|somebody|plumber|cleaner|electrician|babysitter|babysitter tonight|tutor|tax advisor|photographer|lawyer|accountant|driver|airport pickup|pickup|mechanic|repair|book a cleaner|hire)/.test(q)) return "hire";
  if (/(earn|€100|100 today|make money|paid task|contribution points|dog walking|programming|consulting|knowledge sharing)/.test(q)) return "contribute";
  if (/(sell|iphone|bicycle|bike|lost wallet|wallet|apartment|bedroom|under 900|job|vehicle|business for sale)/.test(q)) return "marketplace";
  if (/(claim business)/.test(q)) return "businessClaim";
  if (/(new italian restaurant|business owner|opening in vilnius)/.test(q)) return "businesses";
  if (/(profile|account|what brings|skills|profession)/.test(q)) return "profile";
  if (/(just moved|moved to|settling|first week|plan my move)/.test(q)) return "home";
  if (/(remind|watch|track|monitor|notify me|tell me when|priority|workspace|alwen)/.test(q)) return "alwen";
  if (/(answer|review|verify|contribute|help newcomer|update|business hours|translate for|tourist)/.test(q)) return "contribute";
  if (/(translate|menu|camera|voice)/.test(q)) return "translate";
  if (/(restaurant|halal|nearby|clinic|museum|bakery|place)/.test(q)) return "explore";
  return "explore";
}

function filteredListings() {
  return listings.filter((item) => {
    const categoryMatch = state.category === "all" || item.type === state.category;
    const areaMatch = state.area === "All" || item.area === state.area;
    return categoryMatch && areaMatch && matchesQuery(`${listingTitle(item)} ${item.area} ${listingMeta(item)} ${item.status}`);
  }).sort((a, b) => queryScore(`${listingTitle(b)} ${listingTitle(b)} ${listingMeta(b)} ${b.type}`) - queryScore(`${listingTitle(a)} ${listingTitle(a)} ${listingMeta(a)} ${a.type}`));
}

function listingMovementScore(item) {
  const popularity = Number.parseInt(String(item.popularity || "").match(/\d+/)?.[0] || "0", 10);
  const verifiedBoost = item.verifiedSeller ? 8 : 0;
  const activeBoost = /open|available|hiring|this week|matched/i.test(item.status || "") ? 6 : 0;
  return popularity + verifiedBoost + activeBoost + Number(item.id || 0) / 1000;
}

function trendingListingItems(limit = 10) {
  return [...listings]
    .sort((a, b) => listingMovementScore(b) - listingMovementScore(a))
    .slice(0, limit);
}

function filteredBusinesses() {
  return businesses.filter((item) => {
    const areaMatch = state.area === "All" || item.area === state.area;
    return areaMatch && matchesQuery(`${item.name} ${item.area} ${item.type} ${item.tagKeys.map((tagKey) => t(tagKey)).join(" ")}`);
  });
}

const HAS_PHOTO_STATUSES = new Set(["real", "google", "wikimedia"]);

const EXPLORE_SORTERS = {
  nearest: (a, b) => (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity),
  openNow: (a, b) => {
    const openA = isOpenNow(a.openingHours);
    const openB = isOpenNow(b.openingHours);
    const rank = (open) => (open === true ? 0 : open === false ? 2 : 1);
    return rank(openA) - rank(openB) || (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity);
  },
  recentlyUpdated: (a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""),
  category: (a, b) => a.category.localeCompare(b.category) || (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity),
  hasPhoto: (a, b) => Number(HAS_PHOTO_STATUSES.has(b.photoStatus)) - Number(HAS_PHOTO_STATUSES.has(a.photoStatus)) || (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity)
};

/** A place "counts" as verified for the customer-facing badge/filter when
 * either the source record itself was validated during import
 * (verificationStatus === "Validated") or a real owner has claimed it
 * (claimStatus === "Claimed") — the two genuine trust signals that exist
 * in this data. Never fabricated, never shown for the ~85% of records
 * that are neither. */
function isPlaceVerified(item) {
  return item.verificationStatus === "Validated" || item.claimStatus === "Claimed";
}

function filteredImportedBusinesses() {
  return importedBusinesses
    .filter((item) => {
      const areaMatch = state.area === "All" || item.neighbourhood === state.area;
      const categoryMatch = !state.exploreCategory || state.exploreCategory === "All" || item.category === state.exploreCategory;
      const cuisineMatch =
        state.exploreCategory !== "Food & Drink" || state.exploreCuisine === "All" || item.tags.includes(state.exploreCuisine);
      const starsMatch =
        state.exploreCategory !== "Hotels" || state.exploreStars === "All" || item.rating === Number(state.exploreStars);
      const openNowMatch = !state.exploreOpenNowOnly || isOpenNow(item.openingHours) === true;
      const verifiedMatch = !state.exploreVerifiedOnly || isPlaceVerified(item);
      const hasPhotoMatch = !state.exploreHasPhotoOnly || HAS_PHOTO_STATUSES.has(item.photoStatus);
      return (
        areaMatch &&
        categoryMatch &&
        cuisineMatch &&
        starsMatch &&
        openNowMatch &&
        verifiedMatch &&
        hasPhotoMatch &&
        matchesQuery(`${item.name} ${item.category} ${item.address} ${item.neighbourhood} ${item.tags.join(" ")} ${item.aiAttributes.join(" ")} ${item.description}`)
      );
    })
    .sort(EXPLORE_SORTERS[state.exploreSort] || EXPLORE_SORTERS.nearest);
}

/** Hire's category chips ("plumber", "IT support") use everyday search
 * words, while each professional's own `category` field bundles two
 * concepts ("Plumbing & repairs"). Substring-match against both the
 * category and the finer-grained skills array so word-stem differences
 * ("plumber" vs "plumbing") still resolve. */
function hireCategoryMatches(item, chipLabel) {
  const chipWords = chipLabel.toLowerCase().split(/\s+/).filter(Boolean);
  const haystackWords = [item.category, ...item.skills].join(" ").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return chipWords.some((chipWord) => {
    const stem = chipWord.slice(0, 5);
    // The `chipWord.includes(word)` fallback exists for short, meaningful
    // haystack words (stems shorter than 5 chars don't clear the check
    // above), but without a length floor it also matches generic short
    // words that happen to be substrings — e.g. "carpenter" contains
    // "car", so a mechanic listing "car check" as a skill matched the
    // Carpenter chip. Require at least 4 letters before trusting it.
    return haystackWords.some((word) => word.slice(0, 5) === stem || word.includes(chipWord) || (word.length >= 4 && chipWord.includes(word)));
  });
}

function filteredProfessionals() {
  return serviceProfessionals.filter((item) => {
    const areaMatch = state.area === "All" || item.area === state.area;
    const categoryMatch = !state.hireCategory || hireCategoryMatches(item, state.hireCategory);
    return areaMatch && categoryMatch && matchesQuery(`${item.name} ${item.category} ${item.area} ${item.skills.join(" ")} ${item.availability}`);
  });
}

function filteredHelpRequests() {
  return helpRequests.filter((request) => {
    const areaMatch = state.area === "All" || request.area === state.area;
    const title = request.title || t(request.titleKey);
    const status = request.status || t(request.statusKey);
    return areaMatch && matchesQuery(`${title} ${request.area} ${request.budget || ""} ${status} ${request.quotes.join(" ")}`);
  });
}

function topMatches(limit = 4, context = "home") {
  const hasQuery = Boolean(state.query.trim());
  // With a typed query, what the query itself implies (routeForQuery)
  // should win — that's a deliberate search. With no query — the
  // "Nearby picks" discover-toggle case — fall back to which screen
  // Tell Alwen is being shown on, so the same generic cross-entity mix
  // doesn't show up unchanged on every screen.
  const routed = hasQuery ? routeForQuery() : context;
  const translationMatches =
    routed === "translate"
      ? [
          {
            kind: t("nav.translate"),
            title: t("translate.translationStudio"),
            meta: t("translate.translationOutput"),
            action: "translate",
            tileIcon: "translate"
          }
        ]
      : [];
  const helpMatches = filteredHelpRequests().map((item) => ({
    kind: t("entity.helpRequest"),
    title: item.title || t(item.titleKey),
    meta: `${item.area} · ${item.budget || item.urgency} · ${item.status || t(item.statusKey)}`,
    action: "needHelp",
    tileIcon: "help"
  }));
  const proMatches = filteredProfessionals().map((item) => ({
    kind: t("entity.professional"),
    title: item.name,
    meta: `${t(item.categoryKey)} · ★ ${item.rating} · ${item.availability}`,
    action: "hire",
    initials: initials(item.name)
  }));
  const placeMatches = filteredBusinesses().map((item) => ({
    kind: t("entity.place"),
    title: item.name,
    meta: `${item.area} · ★ ${item.rating} · ${item.hours}`,
    action: "reservations",
    image: item.image
  }));
  const importedMatches = filteredImportedBusinesses().map((item) => {
    const distance = formatDistance(distanceFromCenter(item));
    const open = isOpenNow(item.openingHours);
    const statusPart = open === true ? t("status.openNow") : open === false ? t("status.closedNow") : "";
    return {
      kind: t("entity.importedPlace"),
      title: item.name,
      meta: [item.neighbourhood, distance, statusPart].filter(Boolean).join(" · "),
      action: "explore",
      image: item.photoUrl
    };
  });
  const listingMatches = filteredListings().map((item) => ({
    kind: t("entity.listing"),
    title: listingTitle(item),
    meta: `${item.area} · ${item.price} · ${item.status}`,
    action: "marketplace",
    image: item.image
  }));
  const offerMatches = offers.filter((offer) => matchesQuery(`${offer.vendor} ${t(offer.titleKey)} ${offer.area}`)).map((offer) => ({
    kind: t("entity.offer"),
    title: t(offer.titleKey),
    meta: `${offer.vendor} · ${offer.value}`,
    action: "offers",
    tileIcon: "tag"
  }));

  const ordered =
    routed === "hire"
      ? [...proMatches, ...helpMatches, ...placeMatches, ...listingMatches]
      : routed === "marketplace"
        ? [...listingMatches, ...offerMatches, ...proMatches, ...helpMatches, ...placeMatches, ...importedMatches]
        : routed === "translate"
          ? [...translationMatches, ...placeMatches, ...importedMatches]
          : routed === "explore"
            ? [...importedMatches, ...offerMatches, ...listingMatches, ...proMatches, ...helpMatches]
            : routed === "community"
              ? [...helpMatches, ...proMatches, ...listingMatches, ...placeMatches, ...importedMatches, ...offerMatches]
              : routed === "contribute"
                ? [...helpMatches, ...offerMatches, ...proMatches, ...listingMatches, ...placeMatches, ...importedMatches]
                : routed === "reservations" || routed === "businesses"
                  ? [...placeMatches, ...importedMatches, ...offerMatches, ...proMatches, ...listingMatches, ...helpMatches]
                  : [...placeMatches, ...importedMatches, ...proMatches, ...listingMatches, ...helpMatches, ...offerMatches];

  return ordered.slice(0, limit);
}

function renderNavButton([view, label, iconName]) {
  const isActive = state.activeView === view;
  return `
    <button class="${isActive ? "is-active nav-active" : "nav-inactive"}" data-view="${view}">
      ${navIcon(iconName)}<span>${t(label)}</span>
    </button>`;
}

function renderTransactionSafetyNotice() {
  return `<aside class="transaction-safety-notice" role="note"><strong>${t("common.transactionSafetyTitle")}</strong><p>${t("common.transactionSafetyBody")}</p></aside>`;
}

function renderPersistentFooter() {
  return `<footer class="legal-footer"><nav aria-label="Legal and support">
    <a href="/terms" data-view="legalTerms">Terms and Conditions</a><a href="/privacy" data-view="legalPrivacy">Privacy Policy</a><a href="/cookies" data-view="legalCookies">Cookie Policy</a><a href="/safety" data-view="legalSafety">Safety</a>
    <button type="button" data-contact-purpose="support">Contact</button><button type="button" data-report-target="illegal-content" data-report-id="website">Report illegal content</button><button type="button" data-cookie-settings>Cookie settings</button>
  </nav></footer>`;
}

function renderCookieConsent() {
  const consent = readLocalStorage(COOKIE_CONSENT_KEY);
  if (consent && !state.cookieSettingsOpen) return "";
  return `<section class="cookie-consent" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
    <h2 id="cookie-consent-title">Your privacy choices</h2><p>We use necessary cookies to operate and secure Alwenda. With your permission, we also use optional analytics cookies to understand and improve the Platform. You can change your choice at any time.</p>
    ${state.cookieSettingsOpen ? `<fieldset><legend>Manage optional cookies</legend><label><input id="cookie-analytics-choice" type="checkbox" ${consent?.analytics ? "checked" : ""}> Analytics cookies — understand and improve Platform use</label><p>Provider: Alwenda · Storage: local browser · Duration: up to 12 months</p></fieldset>` : ""}
    <div class="cookie-actions"><button type="button" data-cookie-choice="reject">Reject optional cookies</button><button type="button" data-cookie-choice="manage">Manage choices</button><button type="button" data-cookie-choice="accept">Accept optional cookies</button></div>
  </section>`;
}

function renderReportDialog() {
  if (!state.reportTarget) return state.reportNotice ? `<div class="report-toast" role="status">${escapeHtml(state.reportNotice)}</div>` : "";
  const targetUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `<div class="report-dialog-backdrop"><section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title"><button type="button" class="report-close" data-report-close aria-label="Close">×</button><h2 id="report-title">Report ${escapeHtml(state.reportTarget.type.replaceAll("-", " "))}</h2>
    <form data-report-form><label>Reason for the report<select name="reason" required><option value="">Select a reason</option><option>Illegal content</option><option>Fraud or scam</option><option>Unsafe goods or services</option><option>Harassment or abuse</option><option>Intellectual-property infringement</option><option>Other</option></select></label><label>Explanation<textarea name="explanation" required minlength="10" rows="4"></textarea></label><label>Relevant listing/content URL<input name="contentUrl" type="url" required value="${escapeHtml(targetUrl)}"></label><label>Reporter’s name<input name="reporterName" required value="${escapeHtml(state.auth.user?.name || "")}"></label><label>Reporter’s email<input name="reporterEmail" type="email" required value="${escapeHtml(state.auth.user?.email || "")}"></label><label class="report-confirm"><input name="goodFaith" type="checkbox" required> I confirm in good faith that the information in this report is accurate and complete.</label><button type="submit" class="auth-primary-button">Submit report</button></form>
  </section></div>`;
}

function renderShell() {
  if (state.activeView === "auth") {
    return `
      <div class="app-shell auth-focus-shell">
        <main class="main">${renderView()}</main>
        ${renderPersistentFooter()}${renderCookieConsent()}${renderReportDialog()}
      </div>
    `;
  }
  const navItems = [
    ["home", "nav.home", "app"],
    ["explore", "nav.explore", "explore"],
    ["marketplace", "nav.marketplaceShort", "navMarketplace"],
    ["community", "nav.community", "navCommunity"]
  ];
  const isHome = state.activeView === "home";
  const headerTheme = isHome && !state.headerSolid ? "theme-dark-header header-dark header-transparent" : "theme-light-header header-light header-solid";

  return `
    <div class="app-shell ${isHome ? "is-home-shell" : "is-standard-shell"} ${state.alwenOpen ? "has-alwen-open" : ""} ${headerTheme}">
      <header class="app-top ${headerTheme}">
        ${BrandHeader()}
        <div class="top-controls">
          <button class="header-icon ${notifications.some((item) => item.unread) ? "has-unread" : ""}" data-view="notifications" aria-label="${t("notification.notificationCentre")}">${icon("bell")}</button>
          <button class="header-icon" data-sheet="language" aria-label="${t("settings.language")}">${icon("translate")}</button>
          <button class="header-avatar ${state.auth.status === "signedIn" ? "" : "header-avatar-guest"}" data-view="profile" aria-label="${t("nav.profile")}">${state.auth.status === "signedIn" && state.auth.user.avatar ? `<img src="${escapeHtml(state.auth.user.avatar)}" alt="" />` : icon("profile")}</button>
        </div>
      </header>
      <main class="main">
        ${renderView()}
      </main>
      <nav class="bottom-nav has-tyt" aria-label="Primary">
        <div class="bottom-nav-group">${navItems.slice(0, 2).map(renderNavButton).join("")}</div>
        <div class="bottom-nav-gap" aria-hidden="true"></div>
        <div class="bottom-nav-group">${navItems.slice(2).map(renderNavButton).join("")}</div>
      </nav>
      ${renderTytOrb()}
      ${/* The Alwen workspace page IS the Alwen experience now (its own
         hero has the real chat form) — showing the floating dock on top
         of it would be two chat surfaces reading the same state.alwenChat
         stacked on one screen, exactly the "repeated Alwen controls"
         problem this redesign was asked to remove. Every other screen
         keeps the dock unchanged as the one consistent entry point. */
        state.activeView !== "alwen" ? renderAlwenDock() : ""}
      ${/* Community deliberately drops this floating mic dock — with the
         Alwen dock (bottom-right) and the TYT orb (bottom-centre) both
         already on screen, a third floating circle was competing
         directly with post cards/images for attention. Every other
         screen keeps it unchanged. */
        state.activeView !== "translate" && state.activeView !== "community" ? renderQuickTranslateDock() : ""}
      ${renderSheet()}
      ${renderPersistentFooter()}
      ${renderCookieConsent()}
      ${renderReportDialog()}
    </div>
  `;
}

function authField({ id, label, type = "text", value, placeholder, extra = "" }) {
  const isPassword = type === "password";
  const visible = isPassword && state.auth.visiblePasswordFields?.[id];
  // type="email" (like type="number", "date", etc.) doesn't support the
  // selection API at all — setSelectionRange() throws — which breaks the
  // live re-render cursor restoration in bindLiveField and makes typed
  // characters land at the start of the field instead of the caret, so
  // text appears to build up in reverse. Using type="text" with
  // inputmode="email" keeps the mobile keyboard/autofill hints without
  // that limitation; validation already happens in JS via isValidEmail().
  const isEmail = type === "email";
  const inputType = isPassword ? (visible ? "text" : "password") : isEmail ? "text" : type;
  const inputMode = isEmail ? ' inputmode="email" autocomplete="email"' : "";
  return `
    <div class="auth-field">
      <label for="${id}">${label}</label>
      <div class="auth-input-row">
        <input id="${id}" type="${inputType}"${inputMode} value="${escapeHtml(value || "")}" placeholder="${placeholder || ""}" ${extra} />
        ${isPassword ? `<button type="button" class="auth-toggle-visibility" data-toggle-password="${id}">${visible ? t("common.hidePassword") : t("common.showPassword")}</button>` : ""}
      </div>
    </div>
  `;
}

function renderAuthError() {
  return state.auth.authError ? `<p class="auth-error">${escapeHtml(state.auth.authError)}</p>` : "";
}

function renderAuthNotice() {
  return state.auth.authNotice ? `<p class="auth-notice">${escapeHtml(state.auth.authNotice)}</p>` : "";
}

function renderAuthShell(eyebrow, title, hint, bodyHtml) {
  return `
    <section class="auth-entry">
      <span class="auth-entry-mark" aria-hidden="true">${brandIconMarkup("app-icon")}</span>
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      ${hint ? `<p class="auth-hint">${hint}</p>` : ""}
      ${renderAuthError()}
      ${renderAuthNotice()}
      <div class="auth-entry-body">${bodyHtml}</div>
      <p class="auth-legal-note">
        ${t("auth.authLegalIntro")}
        <button type="button" data-view="legalTerms">${t("settings.settingsTermsOfService")}</button>
        <span aria-hidden="true">&middot;</span>
        <button type="button" data-view="legalPrivacy">${t("settings.settingsPrivacyPolicy")}</button>
      </p>
    </section>
  `;
}

function renderOAuthButtons() {
  return `
    <div class="auth-oauth-row">
      <button type="button" class="auth-oauth-button auth-oauth-apple" data-auth-provider="apple">${t("common.signInWithApple")}</button>
      <button type="button" class="auth-oauth-button auth-oauth-google" data-auth-provider="google">${t("common.signInWithGoogle")}</button>
    </div>
    <div class="auth-divider"><span>${t("common.orDivider")}</span></div>
  `;
}

function renderLogin() {
  const draft = state.auth.loginDraft;
  const mode = state.auth.loginMode || "email";
  const body = `
    ${renderOAuthButtons()}
    <div class="auth-tab-row">
      <button type="button" class="${mode === "email" ? "is-active" : ""}" data-auth-login-mode="email">${t("common.emailLabel")}</button>
      <button type="button" class="${mode === "phone" ? "is-active" : ""}" data-auth-login-mode="phone">${t("common.phoneLabel")}</button>
    </div>
    <form class="auth-form" data-auth-form="login-${mode}">
      ${mode === "email"
        ? `
          ${authField({ id: "login-email", label: t("common.emailLabel"), type: "email", value: draft.email, placeholder: t("common.emailPlaceholder") })}
          <p class="auth-hint">${t("auth.authMagicLinkHint")}</p>
          <button type="submit" class="auth-primary-button">${t("auth.authSendSignInLink")}</button>
          <button type="button" class="auth-link" data-auth-view="forgotPassword">${t("common.forgotPasswordLink")}</button>
        `
        : `
          ${authField({ id: "login-phone", label: t("common.phoneLabel"), type: "tel", value: draft.phone, placeholder: t("common.phonePlaceholder") })}
          <button type="submit" class="auth-primary-button">${t("common.sendCodeCta")}</button>
        `}
    </form>
    <p class="auth-footer-line">${t("common.dontHaveAccount")} <button type="button" class="auth-link" data-auth-view="register">${t("common.signUp")}</button></p>
    <button type="button" class="auth-link" data-view="home">${t("common.continueAsGuest")}</button>
  `;
  return renderAuthShell(t("common.appName"), t("auth.authWelcomeBack"), t("auth.authWelcomeBackHint"), body);
}

function renderRegister() {
  const draft = state.auth.registerDraft;
  const body = `
    ${renderOAuthButtons()}
    <form class="auth-form" data-auth-form="register">
      ${authField({ id: "register-email", label: t("common.emailLabel"), type: "email", value: draft.email, placeholder: t("common.emailPlaceholder") })}
      <label class="auth-checkbox-row">
        <input id="register-terms" type="checkbox" ${draft.agreeTerms ? "checked" : ""} />
        <span>I have read and agree to the Alwenda <button type="button" class="legal-inline-link" data-view="legalTerms">Terms and Conditions</button>. I understand that Alwenda is a listing and matching platform, does not process transaction payments and is not a party to agreements between users.</span>
      </label>
      <label class="auth-checkbox-row">
        <input id="register-marketing" type="checkbox" ${draft.marketingConsent ? "checked" : ""} />
        <span>I agree to receive Alwenda news and offers by email. I can withdraw my consent at any time.</span>
      </label>
      <p class="auth-hint">${t("auth.authMagicLinkHint")}</p>
      <button type="submit" class="auth-primary-button">${t("auth.authSendSignInLink")}</button>
    </form>
    <p class="auth-footer-line">${t("common.alreadyHaveAccount")} <button type="button" class="auth-link" data-auth-view="login">${t("common.signIn")}</button></p>
  `;
  return renderAuthShell(t("common.appName"), t("auth.authCreateAccount"), t("auth.authCreateAccountHint"), body);
}

function renderForgotPassword() {
  const draft = state.auth.forgotDraft;
  const body = `
    <form class="auth-form" data-auth-form="forgotPassword">
      ${authField({ id: "forgot-email", label: t("common.emailLabel"), type: "email", value: draft.email, placeholder: t("common.emailPlaceholder") })}
      <button type="submit" class="auth-primary-button">${t("common.sendCodeCta")}</button>
    </form>
    <button type="button" class="auth-link" data-auth-view="login">${t("common.backToLogin")}</button>
  `;
  return renderAuthShell(t("common.appName"), t("common.forgotPasswordTitle"), t("common.forgotPasswordHint"), body);
}

function renderVerifyCode() {
  const draft = state.auth.verifyDraft;
  const pending = state.auth.pendingVerification;
  const method = pending?.method === "phone" ? t("common.phoneLabel") : t("common.emailLabel");
  const title = t("auth.verifyCodeTitle").replace("{method}", method);
  const hint = t("auth.verifyCodeHint").replace("{target}", pending?.target || "");
  const body = `
    <form class="auth-form" data-auth-form="verifyCode">
      ${authField({ id: "verify-code", label: t("common.codeLabel"), type: "text", value: draft.code, placeholder: "000000", extra: 'inputmode="numeric" maxlength="6" class="auth-code-input"' })}
      <button type="submit" class="auth-primary-button">${t("auth.verifyCta")}</button>
    </form>
  `;
  return renderAuthShell(t("common.appName"), title, hint, body);
}

function renderResetPassword() {
  const draft = state.auth.resetDraft;
  const body = `
    <form class="auth-form" data-auth-form="resetPassword">
      ${authField({ id: "reset-password", label: t("common.newPasswordLabel"), type: "password", value: draft.password, placeholder: t("common.passwordPlaceholder") })}
      ${authField({ id: "reset-confirm", label: t("common.confirmPasswordLabel"), type: "password", value: draft.confirmPassword, placeholder: t("common.confirmPasswordPlaceholder") })}
      <button type="submit" class="auth-primary-button">${t("common.resetPasswordCta")}</button>
    </form>
  `;
  return renderAuthShell(t("common.appName"), t("common.resetPasswordTitle"), t("common.resetPasswordHint"), body);
}

function renderCompleteProfile() {
  const draft = state.auth.profileDraft;
  const body = `
    <form class="auth-form" data-auth-form="completeProfile">
      <div class="auth-avatar-picker">
        ${draft.avatar ? `
          <span class="auth-avatar-option is-selected">
            <img src="${escapeHtml(draft.avatar)}" alt="" />
          </span>
        ` : ""}
        <label class="auth-avatar-option auth-avatar-upload" aria-label="${t("common.uploadImage")}">
          ${icon("camera")}
          <input type="file" accept="image/*" data-role="profile-avatar-input" hidden />
        </label>
      </div>
      ${authField({ id: "profile-name", label: t("common.nameLabel"), value: draft.name, placeholder: t("common.namePlaceholder") })}
      ${authField({ id: "profile-role", label: `${t("common.roleLabel")} ${t("common.optionalSuffix")}`, value: draft.role, placeholder: t("common.rolePlaceholder") })}
      <button type="submit" class="auth-primary-button">${t("common.saveAndContinueCta")}</button>
    </form>
  `;
  return renderAuthShell(t("common.appName"), t("common.completeProfileTitle"), t("common.completeProfileHint"), body);
}

function renderAuthFlow() {
  const view = state.auth.authView;
  if (view === "register") return renderRegister();
  if (view === "forgotPassword") return renderForgotPassword();
  if (view === "verifyCode") return renderVerifyCode();
  if (view === "resetPassword") return renderResetPassword();
  if (view === "completeProfile") return renderCompleteProfile();
  return renderLogin();
}

function renderAuthLoading() {
  return renderAuthShell(t("common.appName"), t("auth.authCheckingSession"), t("auth.authCheckingSessionHint"), "");
}

async function refreshTraderAccountState() {
  if (state.auth.status !== "signedIn") return;
  try {
    const [classification, verification] = await Promise.all([getMyOfferorStatus(), getMyTraderVerification()]);
    state.offerorStatus = classification;
    state.traderVerification = verification;
    if (classification?.offeror_status) state.listingDraft.offerorStatus = classification.offeror_status;
    if (state.activeView === "traderVerification" || state.activeView === "createListing") render();
  } catch (error) {
    console.warn("[trader-verification] Account state could not be loaded.", error);
  }
}

async function loadTraderDisclosure(userId) {
  if (!userId || state.traderPublicProfiles[userId] !== undefined) return;
  try { state.traderPublicProfiles[userId] = await fetchTraderPublicProfile(userId); } catch { state.traderPublicProfiles[userId] = null; }
  if (state.activeView === "listingDetail") render();
}

const TRADER_CONFIRMATION_VERSION = `${LEGAL_POLICY_VERSION}:trader-traceability-v1`;
const traderField = (name, label, value = "", type = "text") => `<div class="auth-field"><label for="trader-${name}">${label}</label><input id="trader-${name}" name="${name}" type="${type}" value="${escapeHtml(value || "")}" required /></div>`;

function renderTraderVerification() {
  const verification = state.traderVerification || {};
  const status = verification.status || "not_started";
  const editable = ["not_started", "draft", "more_information_required"].includes(status);
  return `<section class="section-shell settings-shell legal-page-shell">
    <button type="button" class="back-button" data-view="settings">${icon("arrow")}Back to settings</button>
    <div class="screen-heading"><p class="eyebrow">Trader traceability</p><h1>Trader verification</h1><p>Provide accurate business details for manual review before publishing as a trader.</p></div>
    <div class="settings-section"><h3>Status: ${escapeHtml(status.replaceAll("_", " "))}</h3>
      ${verification.user_visible_reason ? `<p class="auth-error">${escapeHtml(verification.user_visible_reason)}</p>` : ""}
      <p class="settings-section-hint">Alwenda performs a manual documentary review. Verification is not an endorsement or transaction guarantee.</p>
    </div>
    ${state.traderVerificationNotice ? `<p class="auth-notice">${escapeHtml(state.traderVerificationNotice)}</p>` : ""}
    ${editable ? `<form data-role="trader-verification-form" class="settings-section">
      <h2>Business information</h2>
      ${traderField("legal_name", "Legal name", verification.legal_name)}
      ${traderField("trading_name", "Trading name (if different)", verification.trading_name)}
      ${traderField("legal_form", "Legal form", verification.legal_form)}
      ${traderField("registered_address", "Registered address", verification.registered_address)}
      ${traderField("operating_address", "Operating address", verification.operating_address)}
      ${traderField("public_business_address", "Business address shown to users", verification.public_business_address)}
      ${traderField("business_email", "Public business email", verification.business_email, "email")}
      ${traderField("business_phone", "Public business phone", verification.business_phone, "tel")}
      ${traderField("country_of_establishment", "Country of establishment", verification.country_of_establishment || "Lithuania")}
      ${traderField("trade_register_name", "Trade register", verification.trade_register_name || "Register of Legal Entities")}
      ${traderField("registration_number", "Registration number", verification.registration_number)}
      <div class="auth-field"><label for="trader-vat_number">VAT number (if registered)</label><input id="trader-vat_number" name="vat_number" value="${escapeHtml(verification.vat_number || "")}" /></div>
      ${traderField("representative_name", "Authorised representative name", verification.representative_name)}
      ${traderField("representative_role", "Representative role", verification.representative_role)}
      <label class="settings-toggle-row"><span>I confirm the goods and services I offer are lawful and compliant.</span><input name="lawful_goods_confirmed" type="checkbox" ${verification.lawful_goods_confirmed ? "checked" : ""} required /></label>
      <label class="settings-toggle-row"><span>I confirm this information is accurate and may be checked against authoritative sources.</span><input name="accuracy_check_confirmed" type="checkbox" ${verification.accuracy_check_confirmed ? "checked" : ""} required /></label>
      <div class="auth-field"><label for="trader-document">Supporting document (JPEG, PNG, or PDF; max 10 MB)</label><select name="document_type"><option value="registration_evidence">Registration evidence</option><option value="address_evidence">Address evidence</option><option value="representative_authority">Representative authority</option><option value="identity">Identity document</option></select><input id="trader-document" name="document" type="file" accept="image/jpeg,image/png,application/pdf" /></div>
      <p class="settings-section-hint">Documents remain private. They are never placed in public profiles. Uploads stay pending until the production malware-scanning service marks them clean.</p>
      ${state.traderVerificationStatus === "error" ? `<p class="auth-error">${escapeHtml(state.traderVerificationNotice || "Could not save verification.")}</p>` : ""}
      <div class="chip-row"><button type="submit" name="intent" value="save" class="settings-row-button">Save draft</button><button type="submit" name="intent" value="submit" class="auth-primary-button">Submit for review</button></div>
    </form>` : `<div class="settings-section"><p>Your submitted details are read-only while review is in progress.</p><button type="button" class="settings-row-button" data-report-open="appeal" data-report-label="Trader verification decision">Appeal or contact support</button></div>`}
  </section>`;
}

function renderTraderReview() {
  const allowed = state.auth.user?.traderPermissions?.includes("verification_view") || ["admin", "service"].includes(state.auth.user?.appRole);
  if (!allowed) return `<section class="section-shell"><h1>Access denied</h1><p>This queue requires an explicit trader-verification permission.</p></section>`;
  return `<section class="section-shell settings-shell"><div class="screen-heading"><p class="eyebrow">Restricted operations</p><h1>Trader review queue</h1><p>Manual review only. A register outage is not evidence of failure.</p></div>
    <button type="button" class="settings-row-button" data-role="load-trader-review">Refresh queue</button>
    ${state.traderReviewQueue.map((item) => `<div class="settings-section"><h3>${escapeHtml(item.trading_name || item.legal_name || "Unnamed trader")}</h3><p>${escapeHtml(item.status)} · ${escapeHtml(item.country_of_establishment || "")}</p><p>${escapeHtml(item.trade_register_name || "")} ${escapeHtml(item.registration_number || "")}</p><form data-role="trader-register-check" data-id="${item.id}"><label class="auth-field">Authoritative source<input name="source_name" placeholder="Registry name and URL" required /></label><label class="auth-field">Result<select name="result"><option value="confirmed">Confirmed</option><option value="unverifiable">Unverifiable</option><option value="inconsistent">Inconsistent</option><option value="source_unavailable">Source unavailable</option><option value="retry">Retry later</option></select></label><label class="auth-field">Reference<input name="reference" /></label><label class="auth-field">Check notes<textarea name="notes" required></textarea></label><button type="submit" class="settings-row-button">Record register check</button></form><form data-role="trader-review-form" data-id="${item.id}"><label class="auth-field">Decision<select name="status"><option value="under_review">Start review</option><option value="more_information_required">Request information</option><option value="verified">Verify</option><option value="rejected">Reject</option><option value="suspended">Suspend</option></select></label><label class="auth-field">Reason shown to user<textarea name="user_reason" required></textarea></label><label class="auth-field">Internal notes<textarea name="internal_notes" required></textarea></label><label class="auth-field">Verification expiry (required when verifying)<input name="expires_at" type="datetime-local" /></label><button class="auth-primary-button" type="submit">Record decision</button></form></div>`).join("") || `<div class="settings-section"><p>Load the review queue to begin.</p></div>`}
    <div class="settings-section"><p>Document opening is intentionally unavailable in this client. Reviewers may only receive short-lived access from an audited server endpoint after malware status is clean; that endpoint is not configured.</p></div>
  </section>`;
}

function renderSettings() {
  const user = state.auth.user;
  return `
    <section class="section-shell settings-shell">
      <div class="screen-heading">
        <p class="eyebrow">${t("nav.profile")}</p>
        <h1>${t("settings.settingsTitle")}</h1>
        <p>${t("settings.settingsHint")}</p>
      </div>

      ${state.canInstall ? `
        <div class="settings-section">
          <h3>${t("settings.settingsInstallTitle")}</h3>
          <p class="settings-section-hint">${t("settings.settingsInstallHint")}</p>
          <button type="button" class="settings-row-button" data-settings-install="true">${t("settings.settingsInstallCta")}</button>
        </div>
      ` : ""}

      ${user ? `
        <div class="settings-section">
          <h3>${t("settings.settingsAccount")}</h3>
          <div class="settings-account-row">
            ${user.avatar ? `<img src="${escapeHtml(user.avatar)}" alt="" />` : `<span class="settings-account-avatar">${icon("profile")}</span>`}
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(user.email)}${user.emailVerified ? ` · ${t("status.verified")}` : ""}</span>
            </div>
          </div>
          <button type="button" class="settings-row-button" data-settings-edit-profile="true">${t("common.completeProfileTitle")}</button>
          <button type="button" class="settings-row-button" data-view="traderVerification">Trader status and verification</button>
          ${user.traderPermissions?.includes("verification_view") || ["admin", "service"].includes(user.appRole) ? `<button type="button" class="settings-row-button" data-view="traderReview">Trader review queue</button>` : ""}
        </div>
      ` : ""}

      <div class="settings-section">
        <h3>${t("settings.settingsLanguage")}</h3>
        <div class="language-option-list language-option-list-compact">
          ${SUPPORTED_LANGUAGES.map(renderLanguageOptionButton).join("")}
        </div>
      </div>

      <div class="settings-section">
        <h3>${t("settings.settingsAppearance")}</h3>
        <div class="chip-row">
          ${[["light", "settings.settingsThemeLight"], ["dark", "settings.settingsThemeDark"], ["system", "settings.settingsThemeSystem"]].map(([value, labelKey]) => `<button class="${state.settings.theme === value ? "is-selected" : ""}" data-theme-option="${value}">${t(labelKey)}</button>`).join("")}
        </div>
      </div>

      <div class="settings-section">
        <h3>${t("settings.settingsNotifications")}</h3>
        <p class="settings-section-hint">${t("settings.settingsNotificationsHint")}</p>
        <label class="settings-toggle-row">
          <span>${t("settings.settingsNotifyMessages")}</span>
          <input type="checkbox" id="settings-notify-messages" ${state.settings.notifyMessages ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("settings.settingsNotifyOffers")}</span>
          <input type="checkbox" id="settings-notify-offers" ${state.settings.notifyOffers ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("settings.settingsNotifyCommunity")}</span>
          <input type="checkbox" id="settings-notify-community" ${state.settings.notifyCommunity ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("notification.category.booking")}</span>
          <input type="checkbox" id="settings-notify-bookings" ${state.settings.notifyBookings ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("notification.category.business")}</span>
          <input type="checkbox" id="settings-notify-business" ${state.settings.notifyBusiness ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("notification.category.tyt")}</span>
          <input type="checkbox" id="settings-notify-tyt" ${state.settings.notifyTyt ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("notification.category.payment")}</span>
          <input type="checkbox" id="settings-notify-payments" ${state.settings.notifyPayments ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("notification.category.alwen")}</span>
          <input type="checkbox" id="settings-notify-alwen" ${state.settings.notifyAlwen ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("notification.category.system")}</span>
          <input type="checkbox" id="settings-notify-system" ${state.settings.notifySystem ? "checked" : ""} />
        </label>
      </div>

      <div class="settings-section">
        <h3>${t("settings.settingsLegal")}</h3>
        <details class="settings-legal-item" open>
          <summary>${t("settings.settingsTermsOfService")}</summary>
          <p>${t("settings.legal.legalShortSummary")}</p>
          <button type="button" class="settings-row-button" data-view="legalTerms">${t("settings.legal.legalReadFullTerms")}</button>
        </details>
        <details class="settings-legal-item">
          <summary>${t("settings.settingsPrivacyPolicy")}</summary>
          <p>${t("settings.legal.privacyShortSummary")}</p>
          <button type="button" class="settings-row-button" data-view="legalPrivacy">${t("settings.legal.privacyReadFullPolicy")}</button>
        </details>
        <button type="button" class="settings-row-button" data-view="legalCookies">Cookie Policy</button>
        <button type="button" class="settings-row-button" data-view="legalSafety">Public Safety Notice</button>
        <button type="button" class="settings-row-button" data-cookie-settings>Cookie settings</button>
      </div>

      <div class="settings-section">
        <h3>Privacy and account rights</h3>
        <button type="button" class="settings-row-button" data-account-action="download">Download or request personal data</button>
        <button type="button" class="settings-row-button" data-contact-purpose="privacy">Contact privacy support</button>
        <button type="button" class="settings-row-button" data-contact-purpose="appeal">Appeal a content or account restriction</button>
        ${user ? `<button type="button" class="settings-signout-button" data-account-action="delete">Delete account</button>` : ""}
      </div>

      ${user ? `
        <div class="settings-section">
          <button type="button" class="settings-signout-button" data-settings-signout="true">${t("common.signOut")}</button>
          ${user.isSupabaseAccount ? `<button type="button" class="settings-row-button" data-settings-signout-everywhere="true">${t("settings.settingsSignOutEverywhere")}</button>` : ""}
        </div>
        <div class="settings-section settings-danger-zone">
          <h3>${t("settings.settingsDeleteAccount")}</h3>
          <p class="settings-section-hint">${t("settings.settingsDeleteAccountHint")}</p>
          ${state.settingsConfirmDelete ? `
            <p class="auth-error">${t("settings.settingsDeleteAccountConfirm")}</p>
            <div class="settings-danger-actions">
              <button type="button" data-settings-delete-cancel="true">${t("common.cancel")}</button>
              <button type="button" class="settings-signout-button" data-settings-delete-confirm="true">${t("settings.settingsDeleteAccount")}</button>
            </div>
          ` : `<button type="button" class="settings-danger-button" data-settings-delete-start="true">${t("settings.settingsDeleteAccount")}</button>`}
        </div>
      ` : ""}

      <p class="settings-version">${t("settings.settingsAppVersion")}</p>
    </section>
  `;
}

/** The section bodies are intentionally left in English in every locale
 * (see legalTerms.englishOnlyNote) rather than machine-translated —
 * mistranslated legal text is worse than none, and this is pilot-stage
 * copy the team will replace with reviewed documents before launch. */
let approvedLegalPolicyMarkdown = "";

function legalInlineMarkup(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function policySectionMarkdown(number) {
  const startPattern = new RegExp(`^# ${number}\\. `, "m");
  const start = approvedLegalPolicyMarkdown.search(startPattern);
  if (start < 0) return "";
  const tail = approvedLegalPolicyMarkdown.slice(start);
  const next = tail.slice(1).search(/^# \d+\. /m);
  return next < 0 ? tail : tail.slice(0, next + 1);
}

function markdownPolicyToHtml(markdown) {
  const lines = markdown.split("\n");
  let html = "";
  let listOpen = false;
  let quoteOpen = false;
  const closeBlocks = () => {
    if (listOpen) { html += "</ul>"; listOpen = false; }
    if (quoteOpen) { html += "</blockquote>"; quoteOpen = false; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "---") { closeBlocks(); continue; }
    if (line.startsWith("- ")) {
      if (quoteOpen) { html += "</blockquote>"; quoteOpen = false; }
      if (!listOpen) { html += "<ul>"; listOpen = true; }
      html += `<li>${legalInlineMarkup(line.slice(2))}</li>`;
    } else if (line.startsWith(">")) {
      if (listOpen) { html += "</ul>"; listOpen = false; }
      if (!quoteOpen) { html += "<blockquote>"; quoteOpen = true; }
      html += `<p>${legalInlineMarkup(line.replace(/^> ?/, ""))}</p>`;
    } else {
      closeBlocks();
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      html += heading ? `<h${Math.min(heading[1].length + 1, 4)}>${legalInlineMarkup(heading[2])}</h${Math.min(heading[1].length + 1, 4)}>` : `<p>${legalInlineMarkup(line)}</p>`;
    }
  }
  closeBlocks();
  return html;
}

function renderApprovedPolicy(sectionNumber, title) {
  return `<section class="section-shell legal-policy-shell">
    <button type="button" class="back-button" data-view="settings">${icon("arrow")}${t("common.back")}</button>
    <header class="legal-policy-header"><p class="eyebrow">Approved Alwenda policy</p><h1>${title}</h1><p><strong>Last updated:</strong> <span class="legal-placeholder">[DATE — CONFIGURATION REQUIRED]</span></p><p>This approved policy is currently available in English. A lawyer-reviewed Lithuanian version is required before launch to Lithuanian consumers.</p></header>
    <aside class="legal-operator-card" aria-label="Platform operator configuration"><strong>Platform operator details</strong><span>[LEGAL NAME]</span><span>[REGISTRATION NUMBER]</span><span>[REGISTERED ADDRESS]</span><span>[EMAIL ADDRESS]</span><span>[TELEPHONE NUMBER]</span></aside>
    <article class="legal-policy-copy">${markdownPolicyToHtml(policySectionMarkdown(sectionNumber))}</article>
  </section>`;
}

function renderLegalTerms() { return renderApprovedPolicy(1, "Terms and Conditions"); }

/** Same English-only-body rule as renderLegalTerms() above, and the same
 * reason: this describes what the app actually does with user data today,
 * so getting it right matters more than having it in every language. */
function renderLegalPrivacy() { return renderApprovedPolicy(2, "Privacy Policy"); }
function renderLegalCookies() { return renderApprovedPolicy(3, "Cookie Policy"); }
function renderLegalSafety() { return renderApprovedPolicy(4, "Public Safety Notice"); }

function renderWelcomeSequence() {
  const step = Math.min(state.welcomeSequenceStep, WELCOME_SEQUENCE_STEPS.length - 1);
  return `
    <div class="onboarding-page welcome-sequence-page">
      <div class="welcome-sequence-content">
        <span class="welcome-sequence-mark">${brandIconMarkup("app-icon")}</span>
        <p class="welcome-sequence-line">${t(WELCOME_SEQUENCE_STEPS[step])}</p>
        <div class="onboarding-progress">
          ${WELCOME_SEQUENCE_STEPS.map((_, index) => `<span class="${index <= step ? "is-active" : ""}"></span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

/* Abstract, restrained "what Alwenda does" motifs for onboarding — a map
   fragment with location clusters (see), a conversational exchange (ask),
   and overlapping place/community cards (connect). Not decorative stock
   art: each shape echoes the real product surface the step describes. */
function onboardingVisualMarkup(kind) {
  if (kind === "see") {
    return `
      <svg class="onboarding-visual-art" viewBox="0 0 120 84" aria-hidden="true">
        <rect x="4" y="4" width="112" height="76" rx="16" class="onboarding-visual-frame" />
        <path d="M14 66 L34 20" class="onboarding-visual-path" />
        <path d="M50 66 L64 34" class="onboarding-visual-path" />
        <path d="M78 66 L90 18" class="onboarding-visual-path" />
        <circle cx="34" cy="20" r="4" class="onboarding-visual-dot onboarding-visual-dot-a" />
        <circle cx="64" cy="34" r="5" class="onboarding-visual-dot onboarding-visual-dot-b" />
        <circle cx="90" cy="18" r="3.5" class="onboarding-visual-dot onboarding-visual-dot-c" />
      </svg>
    `;
  }
  if (kind === "ask") {
    return `
      <svg class="onboarding-visual-art" viewBox="0 0 120 84" aria-hidden="true">
        <rect x="16" y="10" width="88" height="46" rx="20" class="onboarding-visual-frame" />
        <path d="M42 56 L34 72 L56 56 Z" class="onboarding-visual-frame" />
        <circle cx="46" cy="33" r="4" class="onboarding-visual-dot onboarding-visual-dot-a" />
        <circle cx="60" cy="33" r="4" class="onboarding-visual-dot onboarding-visual-dot-b" />
        <circle cx="74" cy="33" r="4" class="onboarding-visual-dot onboarding-visual-dot-c" />
      </svg>
    `;
  }
  return `
    <svg class="onboarding-visual-art" viewBox="0 0 120 84" aria-hidden="true">
      <rect x="8" y="16" width="58" height="42" rx="14" class="onboarding-visual-frame onboarding-visual-card-a" />
      <rect x="42" y="30" width="58" height="42" rx="14" class="onboarding-visual-frame onboarding-visual-card-b" />
      <circle cx="30" cy="37" r="6" class="onboarding-visual-dot onboarding-visual-dot-a" />
      <circle cx="72" cy="51" r="6" class="onboarding-visual-dot onboarding-visual-dot-b" />
    </svg>
  `;
}

function renderOnboarding() {
  const steps = [
    { eyebrow: t("common.appName"), title: t("onboarding.onboardingSeeTitle"), body: t("onboarding.onboardingSeeBody"), visual: "see" },
    { eyebrow: t("settings.language"), title: t("onboarding.onboardingAskTitle"), body: t("onboarding.onboardingAskBody"), visual: "ask" },
    { eyebrow: t("common.city"), title: t("onboarding.onboardingConnectTitle"), body: t("onboarding.onboardingConnectBody"), visual: "connect" }
  ];
  const step = Math.min(state.onboardingStep, steps.length - 1);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return `
    <div class="onboarding-page">
      <section class="auth-shell onboarding-shell">
        <div class="auth-card onboarding-card">
          <div class="onboarding-progress">
            ${steps.map((_, index) => `<span class="${index <= step ? "is-active" : ""}"></span>`).join("")}
          </div>
          <div class="onboarding-visual" key="${step}">${onboardingVisualMarkup(current.visual)}</div>
          <p class="eyebrow">${current.eyebrow}</p>
          <h1>${current.title}</h1>
          <p class="auth-hint">${current.body}</p>
          ${step === 1
            ? `
              <div class="language-option-list onboarding-language-row">
                ${SUPPORTED_LANGUAGES.map(renderLanguageOptionButton).join("")}
              </div>
            `
            : ""}
          ${isLast
            ? `
              <button type="button" class="auth-primary-button" data-onboarding-signin="true">${t("common.signIn")}</button>
              <button type="button" class="auth-link" data-onboarding-finish="true">${t("common.continueAsGuest")}</button>
            `
            : `
              <button type="button" class="auth-primary-button" data-onboarding-next="true">${t("onboarding.onboardingNext")}</button>
              <button type="button" class="auth-link" data-onboarding-finish="true">${t("onboarding.onboardingSkip")}</button>
            `}
        </div>
      </section>
    </div>
  `;
}

function renderView() {
  /* "profile" and "settings" are deliberately NOT protected — profile has
     its own renderProfileSignedOut() guest card (with a working path to
     Settings), and Settings itself must stay usable without signing in
     (language, theme, install-app all work for guests) per an explicit,
     confirmed product decision. Only genuinely personal data screens are
     gated here. */
  const protectedViews = new Set(["messages", "notifications", "conversation", "savedPlaces", "businessDashboard", "traderVerification", "traderReview"]);
  if (state.auth.status === "checking") return renderAuthLoading();
  if (protectedViews.has(state.activeView) && state.auth.status !== "signedIn") {
    state.auth.authView = "login";
    state.activeView = "auth";
    return renderAuthFlow();
  }
  const views = {
    alwen: renderAlwenWorkspace,
    home: renderHome,
    explore: renderExplore,
    marketplace: renderMarketplace,
    create: renderCreate,
    community: renderCommunity,
    contribute: renderContribute,
    hire: renderHire,
    needHelp: renderNeedHelp,
    liveOpportunities: renderLiveOpportunities,
    liveOpportunityDetail: renderLiveOpportunityDetail,
    createListing: renderCreateListingForm,
    listings: renderListings,
    listingDetail: renderListingDetail,
    businesses: renderBusinesses,
    businessProfile: renderBusinessProfile,
    businessClaim: renderBusinessClaim,
    offers: renderOffers,
    reservations: renderReservations,
    translate: renderTranslation,
    profile: renderProfile,
    notifications: renderNotificationsHub,
    messages: renderNotificationsHub,
    conversation: renderConversationDetail,
    ops: renderOps,
    auth: renderAuthFlow,
    settings: renderSettings,
    legalTerms: renderLegalTerms,
    legalPrivacy: renderLegalPrivacy,
    legalCookies: renderLegalCookies,
    legalSafety: renderLegalSafety,
    traderVerification: renderTraderVerification,
    traderReview: renderTraderReview,
    onboarding: renderOnboarding,
    businessDashboard: renderBusinessDashboard,
    savedPlaces: renderSavedPlaces,
    publicProfile: renderPublicProfile,
    cityImport: () => `<section class="section-shell">${renderCityImport()}</section>`
  };
  return `<section class="view">${views[state.activeView]?.() || renderHome()}</section>`;
}

/* ==========================================================================
   Alwen workspace — "personal city concierge", not a chatbot page.
   Every section below either (a) reads real state directly (myHelpRequests,
   myListings, ownedBusinesses, auth.user) or (b) is explicit about being a
   suggestion Alwen can act on right now via the real chat backend
   (submitAlwenChat/sendAlwenMessage, untouched). Nothing here is a
   decorative mock panel with no data behind it — the old version's
   proactive-briefing/knowledge-graph/local-economy/automation-tasks/
   business-ai/done-for-you-workflow panels and the raw "TODO:" developer
   placeholder section are gone.
   ========================================================================== */

function alwenGreeting() {
  if (state.auth.status !== "signedIn") return t("alwen.greetingGuest");
  const daySuffix = timeOfDaySuffix();
  const key = daySuffix === "Evening" ? "alwen.greetingEvening" : daySuffix === "Morning" ? "alwen.greetingMorning" : "alwen.greetingAfternoon";
  return t(key, { name: escapeHtml(state.auth.user.name.split(" ")[0]) });
}

/* The hero form reuses the exact same data-alwen-chat-form/name="message"
   contract the floating dock's form already uses (bindEvents() binds it
   generically), so this is a second render surface for the identical real
   state.alwenChat/submitAlwenChat() — not a fork. renderAlwenDock() is
   suppressed specifically on this view (see renderShell()) so there's only
   ever one chat surface on screen at a time. */
function renderAlwenHero() {
  const chat = state.alwenChat;
  const isLoading = chat.status === "loading";
  return `
    <div class="alwen-hero">
      <p class="alwen-hero-greeting">${alwenGreeting()}</p>
      <h1>${t("alwen.heroQuestion")}</h1>
      <form class="alwen-hero-form" data-alwen-chat-form>
        <textarea id="alwen-hero-input" name="message" maxlength="2000" rows="1" placeholder="${t("common.tellAlwen")}" ${isLoading ? "disabled" : ""}>${escapeHtml(chat.input)}</textarea>
        <button type="submit" class="alwen-hero-send" aria-label="${t("alwen.heroSend")}" title="${t("alwen.heroSend")}" ${isLoading ? "disabled" : ""}>${isLoading ? `<span class="alwen-status-dot" aria-hidden="true"></span>` : icon("arrow")}</button>
      </form>
      ${renderAlwenResponseCard()}
    </div>
  `;
}

/* A single premium card, not a chat bubble. When the backend's real tool
   calls actually created something (createdHelpRequest/createdListing —
   genuine structured data from the Edge Function, not parsed out of free
   text), a small generated-UI card links straight to it instead of the
   user having to go find what Alwen just did. */
function renderAlwenResponseCard() {
  const chat = state.alwenChat;
  if (chat.status === "idle") return "";
  const canRetry = chat.status === "error" && chat.lastMessage;
  return `
    <div class="alwen-response-card is-${chat.status}" role="status">
      ${chat.status === "loading" ? `
        <div class="alwen-response-loading">
          <span class="alwen-status-dot" aria-hidden="true"></span>
          <span>${t("alwen.alwenChatLooking")}</span>
        </div>
      ` : ""}
      ${chat.status === "success" ? `
        <div class="alwen-response-body">
          <span class="alwen-response-label">${t("alwen.responseLabel")}</span>
          <p>${escapeHtml(chat.answer)}</p>
        </div>
        ${chat.createdHelpRequest ? `
          <div class="alwen-response-generated">
            <span>${t("alwen.responseCreatedRequestTitle")}</span>
            <strong>${escapeHtml(chat.createdHelpRequest.description || "")}</strong>
            <button type="button" data-view="needHelp">${t("alwen.responseCreatedRequestCta")}</button>
          </div>
        ` : ""}
        ${chat.createdListing ? `
          <div class="alwen-response-generated">
            <span>${t("alwen.responseCreatedListingTitle")}</span>
            <strong>${escapeHtml(chat.createdListing.title || "")}</strong>
            <button type="button" data-view="listingDetail" data-listing-id="${chat.createdListing.id}">${t("alwen.responseCreatedListingCta")}</button>
          </div>
        ` : ""}
      ` : ""}
      ${chat.status === "error" ? `
        <div class="alwen-response-error">
          <p>${escapeHtml(chat.error || t("alwen.alwenChatGenericError"))}</p>
          <div>
            ${canRetry ? `<button type="button" data-alwen-retry>${t("alwen.alwenChatRetry")}</button>` : ""}
            ${state.auth.status !== "signedIn" ? `<button type="button" data-view="profile">${t("common.signIn")}</button>` : ""}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/* "Living" suggestion cards, not prompt chips — each sends its example
   straight into the real chat (submitAlwenChat), the same as if the user
   had typed it themselves. */
const ALWEN_QUICK_ACTIONS = [
  ["🏠", "alwen.quickAction.apartments"],
  ["💊", "alwen.quickAction.translate"],
  ["🚲", "alwen.quickAction.sell"],
  ["👨‍👩‍👧", "alwen.quickAction.family"],
  ["🪪", "alwen.quickAction.residence"],
  ["📶", "alwen.quickAction.internet"]
];

function renderAlwenQuickActions() {
  return `
    <div class="alwen-section">
      <h2>${t("alwen.quickActionsTitle")}</h2>
      <div class="alwen-quick-grid">
        ${ALWEN_QUICK_ACTIONS.map(([emoji, labelKey]) => `
          <button type="button" class="alwen-quick-card" data-action="alwen-quick-prompt" data-prompt-key="${labelKey}">
            <span class="alwen-quick-emoji" aria-hidden="true">${emoji}</span>
            <span>${t(labelKey)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

/* Real ongoing work — the user's own help requests (open, waiting on
   quotes from professionals) and marketplace listings (live, waiting on
   buyers) straight from state.myHelpRequests/myListings. Nothing here is
   a fabricated progress percentage; the pulsing dot signals "in progress
   in the background", not a fake completion number. */
function alwenRunningTasks() {
  if (state.auth.status !== "signedIn") return [];
  const helpTasks = state.myHelpRequests.map((item) => ({
    title: item.description,
    status: t("alwen.runningTaskHelpStatus"),
    view: "needHelp"
  }));
  const listingTasks = state.myListings.map((item) => ({
    title: item.title,
    status: t("alwen.runningTaskListingStatus"),
    view: "listingDetail",
    listingId: item.id
  }));
  return [...helpTasks, ...listingTasks];
}

function renderAlwenRunningTasks() {
  const tasks = alwenRunningTasks();
  return `
    <div class="alwen-section">
      <h2>${t("alwenWorkspace.runningTasks")}</h2>
      <p class="alwen-section-hint">${t("alwenWorkspace.runningTasksHint")}</p>
      ${tasks.length
        ? `
          <div class="alwen-task-list">
            ${tasks
              .map(
                (task) => `
                  <button type="button" class="alwen-task-row" data-view="${task.view}" ${task.listingId ? `data-listing-id="${task.listingId}"` : ""}>
                    <span class="alwen-task-pulse" aria-hidden="true"></span>
                    <span class="alwen-task-copy"><strong>${escapeHtml(task.title)}</strong><small>${task.status}</small></span>
                    ${icon("arrow")}
                  </button>
                `
              )
              .join("")}
          </div>
        `
        : `<p class="alwen-section-empty">${t("alwen.runningTasksEmpty")}</p>`}
    </div>
  `;
}

/* The only reliable "needs your input" signal in the real data today is a
   business claim still pending verification — everything else that looked
   like a quote/booking queue in the old mock panels had no real
   accept/confirm mechanism behind it, so it isn't reproduced here rather
   than faking a working button. */
function alwenWaitingForYouItems() {
  if (state.auth.status !== "signedIn") return [];
  return ownedBusinesses()
    .filter((business) => business.verificationStatus === "Pending")
    .slice(0, 4)
    .map((business) => ({ title: business.name, detail: t("alwen.businessVerificationPending"), placeId: business.id }));
}

function renderAlwenWaitingForYou() {
  const items = alwenWaitingForYouItems();
  return `
    <div class="alwen-section">
      <h2>${t("alwen.waitingForYouTitle")}</h2>
      <p class="alwen-section-hint">${t("alwen.waitingForYouHint")}</p>
      ${items.length
        ? `
          <div class="alwen-waiting-list">
            ${items
              .map(
                (item) => `
                  <div class="alwen-waiting-row">
                    <span class="alwen-waiting-copy"><strong>${escapeHtml(item.title)}</strong><small>${item.detail}</small></span>
                    <button type="button" data-view="businessClaim" data-place-id="${item.placeId}">${t("alwen.uploadEvidenceCta")}</button>
                  </div>
                `
              )
              .join("")}
          </div>
        `
        : `<p class="alwen-section-empty">${t("alwen.waitingForYouEmpty")}</p>`}
    </div>
  `;
}

/* Each suggestion names the real signal it's based on — a saved listing,
   today's weather (the same mock signal already shown on Home, not a new
   fabrication), or an incomplete profile — rather than a generic "you
   might like" list. */
function alwenSuggestions() {
  const suggestions = [];
  if (state.auth.status === "signedIn" && state.savedListingIds.length > 0) {
    suggestions.push({ context: t("alwen.suggestionSavedListing"), detail: t("alwen.suggestionSavedListingDetail"), cta: t("alwen.suggestionViewCta"), view: "profile" });
  }
  const weather = currentLivingCitySignals()[0];
  if (weather) {
    suggestions.push({ context: t("alwen.suggestionWeather"), detail: weather.detail || t(weather.detailKey), cta: t("alwen.suggestionViewCta"), view: "explore" });
  }
  if (state.auth.status === "signedIn" && !state.auth.user.profileComplete) {
    suggestions.push({ context: t("alwen.suggestionIncompleteProfile"), detail: t("alwen.suggestionIncompleteProfileDetail"), cta: t("alwen.suggestionCompleteCta"), view: "profile" });
  }
  return suggestions.slice(0, 4);
}

function renderAlwenSuggestions() {
  const suggestions = alwenSuggestions();
  return `
    <div class="alwen-section">
      <h2>${t("alwen.alwenRecommendations")}</h2>
      <p class="alwen-section-hint">${t("alwenWorkspace.recommendationsHint")}</p>
      ${suggestions.length
        ? `
          <div class="alwen-suggestion-list">
            ${suggestions
              .map(
                (item) => `
                  <div class="alwen-suggestion-row">
                    <div>
                      <span class="alwen-suggestion-context">${item.context}</span>
                      <p>${item.detail}</p>
                    </div>
                    <button type="button" data-view="${item.view}">${item.cta}</button>
                  </div>
                `
              )
              .join("")}
          </div>
        `
        : `<p class="alwen-section-empty">${t("alwen.suggestionsEmpty")}</p>`}
    </div>
  `;
}

/* Only fields the app actually has and can genuinely edit — language
   (real, via the language sheet), neighbourhood (real, via the city
   sheet), profession (real, via profile edit), verification (real,
   read-only). No fabricated budget/cuisine/interests fields — those
   don't exist anywhere in the real profile schema. */
function alwenCityMemoryItems() {
  const items = [
    { label: t("alwen.memoryLanguage"), value: SUPPORTED_LANGUAGES.find((lang) => lang.code === state.language)?.nativeName || state.language, sheet: "language" },
    { label: t("alwen.memoryNeighbourhood"), value: currentAreaLabel(), sheet: "city" }
  ];
  if (state.auth.status === "signedIn") {
    items.push({ label: t("alwen.memoryProfession"), value: state.auth.user.role || t("common.optionalSuffix"), view: "profile" });
    items.push({ label: t("alwen.memoryVerification"), value: state.auth.user.emailVerified ? t("status.verified") : t("status.pending"), view: "profile" });
  }
  return items;
}

function renderAlwenCityMemory() {
  return `
    <div class="alwen-section">
      <h2>${t("alwen.memoryTitle")}</h2>
      <p class="alwen-section-hint">${t("alwen.memoryHint")}</p>
      <div class="alwen-memory-grid">
        ${alwenCityMemoryItems()
          .map(
            (item) => `
              <button type="button" class="alwen-memory-card" ${item.sheet ? `data-sheet="${item.sheet}"` : `data-view="${item.view}"`}>
                <span>${item.label}</span>
                <strong>${escapeHtml(item.value)}</strong>
                <small>${t("alwen.memoryEdit")}</small>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

/* alwenCapabilities (mockData.js) is now rewritten to only list what the
   Edge Function's real tool calls actually do — see the comment there. */
function renderAlwenSkills() {
  return `
    <div class="alwen-section">
      <h2>${t("alwen.skillsTitle")}</h2>
      <p class="alwen-section-hint">${t("alwen.skillsHint")}</p>
      <div class="alwen-skill-grid">
        ${alwenCapabilities
          .map(
            (skill) => `
              <div class="alwen-skill-card">
                <span class="alwen-skill-emoji" aria-hidden="true">${skill.emoji}</span>
                <strong>${t(skill.labelKey)}</strong>
                <p>${t(skill.detailKey)}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

/* Honest connection states: Google/Apple/Email identity via Supabase Auth
   is genuinely real (state.auth.user.provider). Maps/Calendar/Payments/
   Bookings have no OAuth flow or data access anywhere in this app yet —
   shown as not connected rather than as fake toggles that do nothing. */
function alwenConnectedServices() {
  const provider = state.auth.status === "signedIn" ? state.auth.user.provider || "email" : null;
  return [
    { id: "google", emoji: "🔎", label: t("alwen.connectedIdentityGoogle"), connected: provider === "google" },
    { id: "apple", emoji: "🍎", label: t("alwen.connectedIdentityApple"), connected: provider === "apple" },
    { id: "email", emoji: "✉️", label: t("alwen.connectedIdentityEmail"), connected: provider === "email" },
    { id: "maps", emoji: "🗺️", label: t("alwen.connectedMaps"), connected: false },
    { id: "calendar", emoji: "📆", label: t("alwen.connectedCalendar"), connected: false },
    { id: "payments", emoji: "💳", label: t("alwen.connectedPayments"), connected: false },
    { id: "bookings", emoji: "🍽️", label: t("alwen.connectedBookings"), connected: false }
  ];
}

function renderAlwenConnectedServices() {
  return `
    <div class="alwen-section">
      <h2>${t("alwen.connectedTitle")}</h2>
      <p class="alwen-section-hint">${t("alwen.connectedHint")}</p>
      <div class="alwen-connected-grid">
        ${alwenConnectedServices()
          .map(
            (item) => `
              <div class="alwen-connected-card ${item.connected ? "is-connected" : ""}">
                <span class="alwen-connected-emoji" aria-hidden="true">${item.emoji}</span>
                <strong>${item.label}</strong>
                <small>${item.connected ? t("alwen.connectedStateConnected") : t("alwen.connectedStateNotConnected")}</small>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

/* Reuses deriveRealAchievements() as-is (already built for Profile, already
   honest — derived from real emailVerified/myListings/ownedBusinesses state,
   not a fabricated log) instead of a second, duplicate implementation. */
function renderAlwenCityTimeline() {
  const events = state.auth.status === "signedIn" ? deriveRealAchievements(state.auth.user) : [];
  return `
    <div class="alwen-section">
      <h2>${t("alwen.timelineTitle")}</h2>
      <p class="alwen-section-hint">${t("alwen.timelineHint")}</p>
      ${events.length
        ? `
          <div class="alwen-timeline-list">
            ${events
              .map(
                (event) => `
                  <div class="alwen-timeline-row">
                    <span class="alwen-timeline-icon" aria-hidden="true">${icon(event.icon)}</span>
                    <span class="alwen-timeline-copy"><strong>${t(event.titleKey)}</strong><small>${event.date || ""}</small></span>
                  </div>
                `
              )
              .join("")}
          </div>
        `
        : `<p class="alwen-section-empty">${t("alwen.timelineEmpty")}</p>`}
    </div>
  `;
}

function renderAlwenWorkspace() {
  return `
    <section class="alwen-workspace">
      ${renderAlwenHero()}
      ${renderAlwenQuickActions()}
      ${renderAlwenRunningTasks()}
      ${renderAlwenWaitingForYou()}
      ${renderAlwenSuggestions()}
      ${renderAlwenCityMemory()}
      ${renderAlwenSkills()}
      ${renderAlwenConnectedServices()}
      ${renderAlwenCityTimeline()}
    </section>
  `;
}

/** Honest signals only — every bullet here must trace back to real local
 * state (this device's saved places, this device's tracked business
 * activity, the count of items actually shown elsewhere on Home). Never
 * fabricate a changing number (a fake reputation delta, a fake "someone
 * viewed your profile") since nothing on this device could actually know
 * that without a backend. */
function buildTodayDigest() {
  const items = [];
  if (state.auth.status === "signedIn") {
    if (!state.auth.user.profileComplete) items.push(t("home.digest.digestCompleteProfile"));
    const saved = state.savedPlaceIds.length;
    if (saved > 0) items.push(t("home.digest.digestSavedPlaces").replace("{count}", saved));
    const totalBusinessActivity = ownedBusinesses().reduce((sum, item) => {
      const stats = businessStats(item.id);
      return sum + stats.views + stats.directions + stats.calls + stats.website;
    }, 0);
    if (totalBusinessActivity > 0) items.push(t("home.digest.digestBusinessActivity").replace("{count}", totalBusinessActivity));
  }
  if (liveAroundYou.length) items.push(t("home.digest.digestNearbyRequests").replace("{count}", liveAroundYou.length));
  if (earnToday.length) items.push(t("home.digest.digestEarnOpportunities").replace("{count}", earnToday.length));
  return items.slice(0, 4);
}

/* Weather/Events/Jobs/Apartments were four dead stat tiles — real numbers
   with nowhere to go. Each now opens the real screen that number is
   actually about, in the same order as livingCitySignals. */
const LIVING_SIGNAL_DESTINATION = [
  { view: "explore" },
  { view: "explore" },
  { view: "marketplace", category: "jobs" },
  { view: "marketplace", category: "rentals" }
];

function renderHome() {
  const daySuffix = timeOfDaySuffix();
  const displayName = state.auth.status === "signedIn" ? `, ${escapeHtml(state.auth.user.name.split(" ")[0])}` : "";
  const digest = buildTodayDigest();

  return `
    <section class="city-hero" aria-labelledby="home-question">
      <div class="city-hero-copy">
        <p class="eyebrow">${t("home.cityLife")} · ${currentAreaLabel()}</p>
        <h1 id="home-question">${t(`home.greeting.cityGreeting${daySuffix}`).replace("{name}", displayName)}</h1>
        <p>${t(`home.heroSubtitle.cityHeroSubtitle${daySuffix}`)}</p>
        ${digest.length ? `<ul class="today-digest">${digest.map((line) => `<li>${line}</li>`).join("")}</ul>` : ""}
      </div>
      ${renderAiSearch("home")}
      <div class="intent-suggestions city-intents">
        ${[
          ["home.intent.intentNeedPlumber", "hire"],
          ["home.intent.intentSellBicycle", "marketplace"],
          ["home.intent.intentWeekendEvents", "explore"],
          ["home.intent.intentEarnNearby", "contribute"]
        ].map(([label, view]) => `<button data-view="${view}">${t(label)}</button>`).join("")}
      </div>
      <div class="living-signal-row">
        ${currentLivingCitySignals().map((signal, index) => {
          const dest = LIVING_SIGNAL_DESTINATION[index] || { view: "explore" };
          return `
            <article class="living-signal-tile" role="button" tabindex="0" data-view="${dest.view}" ${dest.category ? `data-category="${dest.category}"` : ""}>
              <span>${t(signal.labelKey)}</span>
              <strong>${signal.value}</strong>
              <p>${signal.detail || t(signal.detailKey)}</p>
              <span class="living-signal-tile-arrow">${icon("arrow")}</span>
            </article>
          `;
        }).join("")}
      </div>
    </section>

    ${/* Home already has its own curated rails below (Live around you,
       Trending Marketplace, etc.) — the generic "Nearby picks"
       discover-toggle panel only ever showed up here because
       state.discoverOpen is global and was left on from Marketplace or
       Explore, and read as redundant clutter. A typed search still
       surfaces "Alwen found" results in place, same as every other
       screen; only the no-query discover fallback is suppressed. */
      state.query.trim() ? renderAiSearchResults() : ""}

    ${renderLiveAroundYou()}
    ${renderTrendingMarketplace()}
    ${renderEarnToday()}
    ${renderExploreHighlights()}
    ${renderEatingAroundYou()}
    ${renderNightlifeNearYou()}
    ${renderPlacesToStay()}
    ${renderCareNearYou()}
    ${renderHealthcareNearYou()}
    ${renderGroceriesNearYou()}
    ${renderShopsAroundYou()}
    ${renderShoppingMallsNearYou()}
    ${renderBeautyWellnessNearYou()}
    ${renderHealthFitnessNearYou()}
    ${renderAttractionsNearYou()}
    ${renderBanksAtmsNearYou()}
    ${renderPublicServicesNearYou()}
    ${renderTransportNearYou()}
    ${renderAutomobileNearYou()}
    ${renderFuelPetrolNearYou()}
    ${renderProfessionalsNearYou()}
    ${renderNeighbourhoodFeed()}
    ${renderAlwenRecommendations()}
  `;
}

function renderLivingSection(titleKey, hintKey, view, body, seeAllCategory = null) {
  return `
    <section class="living-section">
      <div class="section-title">
        <div><h2>${t(titleKey)}</h2><p>${t(hintKey)}</p></div>
        <button data-view="${view}"${seeAllCategory ? ` data-see-all-category="${seeAllCategory}"` : ""}>${t("common.seeAll")}</button>
      </div>
      ${body}
    </section>
  `;
}

function renderLiveAroundYou() {
  return renderLivingSection(
    "home.rail.liveAroundYou",
    "home.rail.liveAroundYouHint",
    "liveOpportunities",
    renderCarousel(
      "liveAroundYou",
      "living-rail live-rail",
      liveAroundYou.map((item) => {
        const opportunity = opportunityForHomeLiveItem(item);
        return `
        <a class="live-card" href="${liveOpportunityHref(opportunity.id)}" aria-label="${escapeHtml(`${t(item.titleKey)} ${item.value}`)}" data-view="liveOpportunityDetail" data-opportunity-id="${opportunity.id}">
          <div class="card-photo" style="background-image: url('${item.image}')"></div>
          <span class="floating-card-actions" aria-hidden="true"><span class="card-favourite-dot">${icon("heart")}</span></span>
          <span class="live-status-pill">${t("status.live")}</span>
          <h3>${t(item.titleKey)}</h3>
          <strong>${item.value}</strong>
          <p>${item.area} · ${t(item.urgencyKey)}</p>
          <small>${t(item.signalKey)}</small>
        </a>
      `;
      }).join("")
    )
  );
}

function renderTrendingMarketplace() {
  const trendingItems = trendingListingItems(10);
  return renderLivingSection(
    "home.rail.trendingMarketplace",
    "home.rail.trendingMarketplaceHint",
    "marketplace",
    renderCarousel(
      "trendingMarketplace",
      "living-rail marketplace-rail",
      trendingItems.map(renderMarketplaceMiniCard).join("")
    )
  );
}

function renderEarnToday() {
  return renderLivingSection(
    "home.rail.earnToday",
    "home.rail.earnTodayHint",
    "liveOpportunities",
    renderCarousel(
      "earnToday",
      "living-rail earn-rail",
      earnToday.map((item) => {
        const opportunity = opportunityForHomeEarnItem(item);
        return `
        <a class="earn-card" href="${liveOpportunityHref(opportunity.id)}" aria-label="${escapeHtml(`${t(item.titleKey)} ${item.value}`)}" data-view="liveOpportunityDetail" data-opportunity-id="${opportunity.id}">
          <div class="earn-image" style="background-image: url('${item.image}')"></div>
          <div class="earn-body">
            <span>${item.time}</span>
            <h3>${t(item.titleKey)}</h3>
            <strong>${item.value}</strong>
            <p>${item.area} · ${t(item.fitKey)}</p>
          </div>
        </a>
      `;
      }).join("")
    ),
    null,
    "today"
  );
}

function renderExploreHighlights() {
  return renderLivingSection(
    "home.rail.eventsNearYou",
    "home.rail.eventsNearYouHint",
    "explore",
    renderCarousel(
      "eventsNearYou",
      "visual-card-grid events-rail",
      exploreHighlights.map((item) => `
        <article class="visual-card tone-${item.imageTone}" data-view="explore">
          <div class="visual-card-image" style="background-image: url('${item.image}')"></div>
          <span>${t(item.typeKey)}</span>
          <h3>${t(item.titleKey)}</h3>
          <p>${item.area} · ${t(item.signalKey)}</p>
        </article>
      `).join("")
    )
  );
}

/** Nearest real, open-data places in the given categories — sorted by
 * distance from the city-centre reference point, capped for render cost.
 * An optional subcategory predicate lets one imported category (e.g.
 * "Beauty & Wellness", which covers both salons and gyms in the OSM
 * import schema) be split across multiple Home rails. */
function realPlacesByCategory(categories, limit = 10, subcategoryFilter = null) {
  return importedBusinesses
    .filter((item) => categories.includes(item.category) && (!subcategoryFilter || subcategoryFilter(item)))
    .map((item) => ({ item, distance: distanceFromCenter(item) }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, limit)
    .map(({ item }) => item);
}

/* Fixed OSM cuisine/type tag values (see normalizers.js, which keeps
   only "cuisine"/"amenity"/"shop"/"diet:vegetarian" tag values, without
   the key). Only the ones that are unambiguous specialty signals are
   listed here — values like "limited"/"only"/"local" are almost
   certainly diet:vegetarian levels, not a type, and are ambiguous
   without the key, so they're deliberately left out rather than
   guessed at. */
const PLACE_SPECIALTY_TAG_KEY = {
  italian: "placeSpecialty.italian",
  french: "placeSpecialty.french",
  indian: "placeSpecialty.indian",
  japanese: "placeSpecialty.japanese",
  georgian: "placeSpecialty.georgian",
  chinese: "placeSpecialty.chinese",
  mexican: "placeSpecialty.mexican",
  pizza: "placeSpecialty.pizza",
  ice_cream: "placeSpecialty.iceCream",
  coffee_shop: "placeSpecialty.coffeeShop",
  dessert: "placeSpecialty.dessert"
};

/** OSM-sourced records carry a generic pipeline-generated aiSummary like
 * "X is a place to eat or drink in Vilnius, imported from OpenStreetMap /
 * Overpass API." — internal-sounding provenance text, not something a
 * user should read as the place's description. Genuine descriptions
 * (Wikidata landmarks) pass through untouched; the generic one is
 * suppressed rather than shown. */
function honestPlaceDescription(item) {
  if (!item.description || /imported from/i.test(item.description)) return "";
  return item.description;
}

/** A real, non-generic one-line "why this place" signal for quick
 * decisions — built only from data actually on the record: a genuine
 * Wikidata description for landmarks, or a recognised cuisine/type tag
 * from OpenStreetMap. Deliberately does NOT fall back to the generic
 * "X is a place to eat or drink in Vilnius, imported from..." aiSummary
 * OSM records get — that just repeats the category badge and adds no
 * decision-useful signal, so it's better to show nothing than that. */
function realPlaceSpecialty(item) {
  if (item.id?.startsWith("wikidata:") && item.description && !/imported from/i.test(item.description)) {
    const text = item.description.trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  const labels = (item.tags || [])
    .flatMap((tag) => tag.split(";"))
    .map((tag) => PLACE_SPECIALTY_TAG_KEY[tag])
    .filter(Boolean)
    .map((key) => t(key));
  return [...new Set(labels)].join(" · ");
}

/** The compact (rail) member of the shared PlaceCard family — see
 * renderPlaceCard() below for the full/grid member and the design note
 * on why the two share a photo/badge structure but not an action row.
 * Same border-radius/shadow tokens and photo aspect-ratio as the grid
 * card (.place-card base class), so a place reads as the same kind of
 * object whether it's in Explore's grid or a Home rail — just smaller,
 * and with one action (save) instead of the full set. */
function renderPlaceCardCompact(item) {
  const distance = formatDistance(distanceFromCenter(item));
  const open = isOpenNow(item.openingHours);
  const statusOrAddress =
    open === true
      ? `<span class="open-now">${t("status.openNow")}</span>`
      : open === false
        ? t("status.closedNow")
        : item.address || item.neighbourhood || "Vilnius";
  const specialty = realPlaceSpecialty(item);
  const hasValidId = Boolean(item.id);
  const navAttrs = hasValidId
    ? `data-sheet="place" data-place-id="${item.id}" role="button" tabindex="0" aria-label="${escapeHtml(item.name)}"`
    : "";
  return `
    <article class="place-card place-card--compact" ${navAttrs}>
      <div class="place-card-photo">
        ${renderPlacePhoto(item)}
        <span class="place-card-category-badge" aria-hidden="true">${categoryIconFor(item)}</span>
        <button type="button" class="place-card-save ${isPlaceSaved(item) ? "is-active" : ""}" data-action="toggle-save" data-place-id="${item.id}" aria-label="${t("common.favourite")}">${icon("heart")}</button>
      </div>
      <div class="place-card-body">
        <span class="place-card-eyebrow">${item.subcategory || businessCategoryLabel(item.category)}</span>
        <h3 class="place-card-title">${item.name}</h3>
        ${specialty ? `<p class="place-card-specialty">${specialty}</p>` : ""}
        <p class="place-card-meta">${distance ? `${distance} · ` : ""}${statusOrAddress}</p>
      </div>
    </article>
  `;
}

/** Cover-Flow-style 3D scroller for real imported places in one or more
 * categories — the centered card sits flat and full-size, the rest recede
 * in perspective to either side. It's a real scrollable container
 * underneath (touch/trackpad/scrollbar all work normally); bindCoverflow()
 * just decorates each slide's transform based on its actual scroll
 * position, recomputed on every scroll frame. Renders nothing if the
 * category has no real data yet, rather than an empty section. */
/** The 3D coverflow scroller markup shared by every real-place rail —
 * Home's per-category rails (below) and Explore's Discovery rails
 * (renderExploreDiscoveryRail) both feed it an already-computed item
 * list rather than duplicating this track/slide structure. */
function renderPlaceCoverflowTrack(items, trackKey) {
  return `
    <div id="${carouselId(trackKey)}" class="coverflow-viewport" data-coverflow="true">
      <div class="coverflow-track">
        ${items.map((item, index) => `
          <div class="coverflow-slide ${index === 0 ? "is-active" : ""}">${renderPlaceCardCompact(item)}</div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRealPlacesSection(titleKey, hintKey, categories, trackKey, limit = 10, subcategoryFilter = null) {
  const items = realPlacesByCategory(categories, limit, subcategoryFilter);
  if (!items.length) return "";
  return renderLivingSection(titleKey, hintKey, "explore", renderPlaceCoverflowTrack(items, trackKey), categories.length === 1 ? categories[0] : null);
}

/** Explore's own "Discovery" rails — same coverflow presentation as the
 * Home rails above, but each fed a bespoke, honestly-derived item list
 * (open now / recently added / has a real photo / near what's saved)
 * instead of a fixed category. No "see all" button since these already
 * live on Explore itself — see renderExploreDiscoveryRails(). */
function renderExploreDiscoveryRail(titleKey, hintKey, items, trackKey) {
  if (!items.length) return "";
  return `
    <section class="living-section">
      <div class="section-title">
        <div><h2>${t(titleKey)}</h2><p>${t(hintKey)}</p></div>
      </div>
      ${renderPlaceCoverflowTrack(items, trackKey)}
    </section>
  `;
}

/** Every rail here is a real, independently-verifiable slice of the same
 * imported dataset — nothing here is inferred (no "family friendly",
 * "quiet", or "trending" claims, since no real signal for any of those
 * exists in this data). "More near what you saved" is the one
 * personalised rail: real distance from the user's most recently saved
 * place, only shown once they've actually saved something. */
function renderExploreDiscoveryRails() {
  const openNowItems = importedBusinesses
    .filter((item) => isOpenNow(item.openingHours) === true)
    .sort((a, b) => (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity))
    .slice(0, 10);
  const newlyAddedItems = [...importedBusinesses].sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || "")).slice(0, 10);
  const realPhotoItems = importedBusinesses
    .filter((item) => HAS_PHOTO_STATUSES.has(item.photoStatus))
    .sort((a, b) => (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity))
    .slice(0, 10);
  const lastSavedId = [...state.savedPlaceIds].reverse().find((id) => importedBusinesses.some((item) => item.id === id));
  const lastSaved = lastSavedId ? importedBusinesses.find((item) => item.id === lastSavedId) : null;
  const nearSavedItems = lastSaved
    ? importedBusinesses
        .filter((item) => item.id !== lastSaved.id && item.category === lastSaved.category)
        .sort((a, b) => (distanceFromCenter(a) ?? Infinity) - (distanceFromCenter(b) ?? Infinity))
        .slice(0, 10)
    : [];

  return `
    ${renderExploreDiscoveryRail("explore.rail.openNowTitle", "explore.rail.openNowHint", openNowItems, "exploreOpenNow")}
    ${nearSavedItems.length ? renderExploreDiscoveryRail("explore.rail.nearSavedTitle", "explore.rail.nearSavedHint", nearSavedItems, "exploreNearSaved") : ""}
    ${renderExploreDiscoveryRail("explore.rail.worthALookTitle", "explore.rail.worthALookHint", realPhotoItems, "exploreWorthALook")}
    ${renderExploreDiscoveryRail("explore.rail.newlyAddedTitle", "explore.rail.newlyAddedHint", newlyAddedItems, "exploreNewlyAdded")}
  `;
}

/* Each rail below is deliberately narrowed to ONE real-world grouping
   (cuisine, care type, banking vs. offices, salons vs. gyms, etc.)
   instead of bundling several unrelated OSM categories into one rail —
   e.g. pharmacies used to share a rail with hospitals/clinics, and
   banks/civic offices/transport all lived under one "Public Services"
   rail. Splitting them means every rail title accurately describes
   what's actually in it. Categories with no real imported data (e.g.
   automobile/fuel — not covered by the current Overpass import) are
   simply not given a rail, rather than showing an empty one; see
   renderRealPlacesSection's "return nothing if empty" behaviour above. */
function renderEatingAroundYou() {
  return renderRealPlacesSection("home.rail.eatingAroundYou", "home.rail.eatingAroundYouHint", ["Food & Drink"], "eatingAroundYou", 10);
}

function renderNightlifeNearYou() {
  return renderRealPlacesSection("home.rail.nightlifeNearYou", "home.rail.nightlifeNearYouHint", ["Nightlife"], "nightlifeNearYou", 10);
}

function renderCareNearYou() {
  return renderRealPlacesSection("home.rail.careNearYou", "home.rail.careNearYouHint", ["Pharmacy"], "careNearYou", 10);
}

function renderHealthcareNearYou() {
  return renderRealPlacesSection("home.rail.healthcareNearYou", "home.rail.healthcareNearYouHint", ["Healthcare"], "healthcareNearYou", 10);
}

function renderPlacesToStay() {
  return renderRealPlacesSection("home.rail.placesToStay", "home.rail.placesToStayHint", ["Hotels"], "placesToStay", 10);
}

function renderAttractionsNearYou() {
  return renderRealPlacesSection("home.rail.attractionsNearYou", "home.rail.attractionsNearYouHint", ["Attractions", "Parks"], "attractionsNearYou", 10);
}

function renderBanksAtmsNearYou() {
  return renderRealPlacesSection("home.rail.banksAtmsNearYou", "home.rail.banksAtmsNearYouHint", ["Finance"], "banksAtmsNearYou", 10);
}

function renderPublicServicesNearYou() {
  return renderRealPlacesSection("home.rail.publicServicesNearYou", "home.rail.publicServicesNearYouHint", ["Public Services"], "publicServicesNearYou", 10);
}

function renderTransportNearYou() {
  return renderRealPlacesSection("home.rail.transportNearYou", "home.rail.transportNearYouHint", ["Transport"], "transportNearYou", 10);
}

function renderGroceriesNearYou() {
  return renderRealPlacesSection("home.rail.groceriesNearYou", "home.rail.groceriesNearYouHint", ["Groceries"], "groceriesNearYou", 10);
}

function renderShopsAroundYou() {
  return renderRealPlacesSection("home.rail.shopsAroundYou", "home.rail.shopsAroundYouHint", ["Shops"], "shopsAroundYou", 10, (item) => item.subcategory !== "Shopping mall");
}

function renderShoppingMallsNearYou() {
  return renderRealPlacesSection("home.rail.shoppingMallsNearYou", "home.rail.shoppingMallsNearYouHint", ["Shops"], "shoppingMallsNearYou", 10, (item) => item.subcategory === "Shopping mall");
}

function renderBeautyWellnessNearYou() {
  return renderRealPlacesSection("home.rail.beautyWellnessNearYou", "home.rail.beautyWellnessNearYouHint", ["Beauty & Wellness"], "beautyWellnessNearYou", 10, (item) => item.subcategory !== "Gym");
}

function renderHealthFitnessNearYou() {
  return renderRealPlacesSection("home.rail.healthFitnessNearYou", "home.rail.healthFitnessNearYouHint", ["Beauty & Wellness"], "healthFitnessNearYou", 10, (item) => item.subcategory === "Gym");
}

function renderAutomobileNearYou() {
  return renderRealPlacesSection("home.rail.automobileNearYou", "home.rail.automobileNearYouHint", ["Automobile"], "automobileNearYou", 10, (item) => item.subcategory !== "Petrol station");
}

function renderFuelPetrolNearYou() {
  return renderRealPlacesSection("home.rail.fuelPetrolNearYou", "home.rail.fuelPetrolNearYouHint", ["Automobile"], "fuelPetrolNearYou", 10, (item) => item.subcategory === "Petrol station");
}

function renderProfessionalsNearYou() {
  return renderLivingSection(
    "home.rail.professionalsNearYou",
    "home.rail.professionalsNearYouHint",
    "hire",
    renderCarousel(
      "professionalsNearYou",
      "pro-strip pro-rail",
      serviceProfessionals.slice(0, 5).map((item) => `
        <article class="pro-pill" data-view="hire">
          <strong>★★★★★ ${t(item.categoryKey)}</strong>
          <span>${item.name}</span>
          <p>${item.availability} · ${item.price}</p>
        </article>
      `).join("")
    )
  );
}

function renderNeighbourhoodFeed() {
  return renderLivingSection(
    "home.rail.neighbourhood",
    "home.rail.neighbourhoodHint",
    "community",
    renderCarousel(
      "neighbourhood",
      "community-preview",
      feedPosts.map(renderPulse).join("")
    )
  );
}

const ALWEN_RECOMMENDATION_ICONS = ["spark", "calendar", "briefcase", "home", "chat"];

function renderAlwenRecommendations() {
  return `
    <section class="alwen-recommendation-card">
      <div>
        <p class="eyebrow">${t("alwen.alwenRecommendations")}</p>
        <h2>${t("alwen.alwenRecommendationsTitle")}</h2>
      </div>
      <div class="recommendation-list">
        ${alwenRecommendations.map((item, index) => `<p><span class="recommendation-icon">${icon(ALWEN_RECOMMENDATION_ICONS[index % ALWEN_RECOMMENDATION_ICONS.length])}</span>${t(item)}</p>`).join("")}
      </div>
      <button data-view="alwen">${t("home.rail.prepareWithAlwen")}</button>
    </section>
  `;
}

function renderCapabilityRail() {
  return `
    <div class="capability-rail" aria-label="${t("common.futureReady")}">
      ${marketplaceCapabilities.map((item) => `<span>${t(item)}</span>`).join(" ")}
    </div>
  `;
}

function renderAiSearch(context) {
  // Community and Explore each get their own contextual placeholder
  // immediately (the rotation in bindAiSearchPlaceholderRotation() takes
  // over from here on the next tick) rather than showing the generic
  // city-wide prompt — including "Register my business" — for even a
  // moment. Explore is "what are you looking for in the city", not a
  // business directory, so it needs need-based prompts, not the generic set.
  const placeholder =
    context === "community"
      ? t("community.communityPromptExamples")[0]
      : context === "explore"
        ? t("explore.explorePromptExamples")[0]
        : t("common.aiSearchPlaceholder");
  return `
    <div class="ai-search ${context === "home" ? "is-large" : ""}">
      <span class="alwen-mini" aria-hidden="true">${brandIconMarkup("app-icon")}</span>
      <input id="global-search" value="${escapeHtml(state.query)}" placeholder="${placeholder}" aria-label="${placeholder}" />
      <button type="button" data-action="ai-search-submit">${t("common.tellAlwen")}</button>
    </div>
  `;
}

/** Toggle for the results panel below — on Explore/Marketplace it sits
 * right under the category tile grid so there's a way to see it without
 * having to type anything into Tell Alwen first. */
function renderDiscoverToggle() {
  return `
    <button type="button" class="discover-toggle ${state.discoverOpen ? "is-active" : ""}" data-action="toggle-discover" aria-pressed="${state.discoverOpen ? "true" : "false"}">
      <span class="discover-toggle-dot" aria-hidden="true"></span>
      ${t("common.discoverNearby")}
    </button>
  `;
}

/** Cross-entity "here's what matches what you typed" panel — shown under
 * every renderAiSearch() call site so Tell Alwen surfaces relevant results
 * in place instead of navigating to a different screen. Results already
 * update live as the user types, since the #global-search input handler
 * re-renders the whole screen on every keystroke. Also opens with no
 * query typed at all when state.discoverOpen is set via the toggle above,
 * showing a default/unfiltered sample instead of search matches. */
function renderAiSearchResults(limit = 6, context = "home") {
  const hasQuery = Boolean(state.query.trim());
  if (!hasQuery && !state.discoverOpen) return "";
  const matches = topMatches(limit, context);
  return `
    <section class="section-shell ai-search-results" data-role="ai-search-results">
      <div class="section-title"><h2>${hasQuery ? t("common.aiResults") : t("common.discoverResultsTitle")}</h2></div>
      <div class="match-list">${matches.map(renderMatch).join("") || renderEmptyState(t("common.noResults"))}</div>
    </section>
  `;
}

const TYT_ACTIONS = [
  ["pay", "common.earnMoney", "contribute"],
  ["help", "common.helpSomeoneAction", "community"],
  ["service", "common.offerServiceAction", "hire"],
  ["tag", "common.sellSomethingAction", "marketplace"],
  ["chat", "common.shareKnowledge", "community"],
  ["map", "common.findOpportunities", "contribute"],
  ["heart", "common.volunteer", "community"],
  ["contribute", "common.teach", "hire"],
  ["vehicle", "common.deliver", "contribute"],
  ["plus", "common.createListingAction", "create"]
];

function renderTytOrb() {
  return `
    <button class="tyt-orb" data-sheet="tyt" aria-label="${t("tyt.tyt")} — ${t("tyt.tytTagline")}">
      <span class="tyt-orb-ring" aria-hidden="true"></span>
      <span class="tyt-orb-core">
        <span class="tyt-orb-mark">TYT</span>
      </span>
    </button>
  `;
}

function renderTytSheet() {
  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet tyt-sheet" aria-label="${t("tyt.tyt")}">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <div>
            <p class="eyebrow">${t("tyt.tyt")}</p>
            <h2>${t("tyt.tytTagline")}</h2>
            <p>${t("tyt.tytQuestion")}</p>
          </div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>
        <div class="tyt-ai-search">
          <span class="alwen-mini" aria-hidden="true">${brandIconMarkup("app-icon")}</span>
          <input id="tyt-search" placeholder="${t("tyt.tytPromptPlaceholder")}" aria-label="${t("common.tellAlwen")}" />
          <button data-view="${routeForQuery()}" data-sheet-close="true">${t("common.tellAlwen")}</button>
        </div>
        <div class="tyt-action-grid">
          ${TYT_ACTIONS.map(([iconName, labelKey, view]) => `
            <button class="tyt-action-card" data-view="${view}">
              <span class="tyt-action-icon">${icon(iconName)}</span>
              <span>${t(labelKey)}</span>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderAlwenDock() {
  const chat = state.alwenChat;
  const isLoading = chat.status === "loading";
  const canRetry = chat.status === "error" && chat.lastMessage;
  return `
    <aside class="alwen-dock ${state.alwenOpen ? "is-open" : ""}" aria-label="${t("common.tellAlwen")}">
      <button class="alwen-orb" data-alwen-toggle aria-expanded="${state.alwenOpen ? "true" : "false"}" aria-label="${t("common.tellAlwen")}" title="${t("common.tellAlwen")}">${brandIconMarkup("app-icon")}</button>
      <div class="alwen-panel" role="dialog" aria-label="${t("common.tellAlwen")}">
        <div class="alwen-panel-head">
          <div>
            <p class="eyebrow">${t("common.tellAlwen")}</p>
            <strong>${t("alwen.alwenDockTitle")}</strong>
          </div>
          <button data-alwen-toggle aria-label="${t("common.close")}">×</button>
        </div>

        <p class="alwen-panel-intro">${t("alwen.alwenDockHint")}</p>
        ${chat.status === "success" ? `
          <div class="alwen-chat-answer" role="status">
            <strong>${t("alwen.alwenChatAnswerLabel")}</strong>
            <p>${escapeHtml(chat.answer)}</p>
          </div>
        ` : ""}
        ${isLoading ? `
          <div class="alwen-status-row" role="status">
            <span class="alwen-status-dot" aria-hidden="true"></span>
            <span>${t("alwen.alwenChatLooking")}</span>
          </div>
        ` : ""}
        ${chat.status === "error" ? `
          <div class="alwen-chat-error" role="alert">
            <p>${escapeHtml(chat.error || t("alwen.alwenChatGenericError"))}</p>
            <div>
              ${canRetry ? `<button type="button" data-alwen-retry>${t("alwen.alwenChatRetry")}</button>` : ""}
              ${state.auth.status !== "signedIn" ? `<button type="button" data-view="profile">${t("common.signIn")}</button>` : ""}
            </div>
          </div>
        ` : ""}
        <form class="alwen-chat-form" data-alwen-chat-form>
          <label for="alwen-chat-input">${t("alwen.alwenChatLabel")}</label>
          <div class="alwen-chat-compose">
            <textarea id="alwen-chat-input" name="message" maxlength="2000" rows="3" placeholder="${t("alwen.alwenChatPlaceholder")}" ${isLoading ? "disabled" : ""}>${escapeHtml(chat.input)}</textarea>
            <button type="submit" ${isLoading ? "disabled" : ""}>${isLoading ? t("alwen.alwenChatSending") : t("alwen.alwenChatSend")}</button>
          </div>
        </form>
        <div class="alwen-mode-row">
          <button type="button" data-alwen-upload="image">${icon("uploadImageMode")}${t("common.uploadImage")}</button>
          <button type="button" data-alwen-upload="document">${icon("uploadDocumentMode")}${t("common.uploadDocument")}</button>
        </div>
        <input type="file" accept="image/*" id="alwen-image-input" class="translation-camera-input" />
        <input type="file" accept=".pdf,application/pdf" id="alwen-document-input" class="translation-camera-input" />
        <div class="alwen-actions">${alwenActions.slice(0, 5).map((action) => `<button data-view="${action.view}">${t(action.labelKey)}</button>`).join("")}</div>
      </div>
    </aside>
  `;
}

async function submitAlwenChat(message = state.alwenChat.input || state.alwenChat.lastMessage) {
  const trimmed = String(message || "").trim();
  state.alwenChat.input = trimmed;
  state.alwenChat.lastMessage = trimmed;
  state.alwenChat.answer = "";
  state.alwenChat.error = null;
  // Bookkeeping only, additive to the existing success path below — lets
  // the workspace page render a generated-UI card for whatever the Edge
  // Function actually created, instead of parsing the free-text answer.
  state.alwenChat.createdHelpRequest = null;
  state.alwenChat.createdListing = null;

  if (!trimmed) {
    state.alwenChat.status = "error";
    state.alwenChat.error = t("alwen.alwenChatEmptyError");
    render();
    return;
  }

  if (state.auth.status !== "signedIn") {
    state.alwenChat.status = "error";
    state.alwenChat.error = t("alwen.alwenChatSignedOutError");
    render();
    return;
  }

  state.alwenChat.status = "loading";
  render();

  try {
    const result = await sendAlwenMessage({
      message: trimmed,
      language: getCurrentLanguage(),
      city: city.name || "Vilnius",
      conversationId: state.alwenChat.conversationId
    });
    state.alwenChat.status = "success";
    state.alwenChat.answer = result.answer;
    state.alwenChat.conversationId = result.conversationId || state.alwenChat.conversationId;
    state.alwenChat.input = "";
    trackEvent("alwen_chat_succeeded", { messageLength: trimmed.length });
    if (result.createdHelpRequest) {
      applyCreatedHelpRequest(result.createdHelpRequest, { source: "alwen" });
      state.alwenChat.createdHelpRequest = result.createdHelpRequest;
    }
    if (result.createdListing) {
      applyCreatedListing(result.createdListing);
      state.alwenChat.createdListing = result.createdListing;
    }
  } catch (error) {
    const code = error?.code || "";
    state.alwenChat.status = "error";
    state.alwenChat.error =
      code === "unauthenticated"
        ? t("alwen.alwenChatExpiredError")
        : code === "provider_config_missing"
          ? t("alwen.alwenChatMissingKeyError")
          : error?.message || t("alwen.alwenChatGenericError");
    trackEvent("alwen_chat_failed", { code: code || "unknown" });
  }
  render();
}

/** One-touch voice translator, promoted to the top of the global Alwen
 * dock so it's reachable from anywhere in the app, not just the dedicated
 * Translate screen. Shares state.translateFromLanguage/translateToLanguage/
 * translateInputText/translateOutputText with renderTranslation() — same
 * translate engine, just a compact entry point into it. */
function renderAlwenQuickTranslate() {
  return `
    <div class="alwen-quick-translate">
      <div class="alwen-quick-translate-badge">${icon("translate")}<span>${t("translate.quickTranslate")}</span></div>

      <div class="alwen-quick-translate-langs">
        <select class="translation-select" aria-label="${t("common.inputLanguage")}" data-translate-from="true">
          ${["translate.language.langEnglish", ...TRANSLATE_LANGUAGE_KEYS.filter((key) => key !== "translate.language.langEnglish")].map((languageKey) => `<option value="${languageKey}" ${languageKey === state.translateFromLanguage ? "selected" : ""}>${TRANSLATE_LANGUAGE_FLAGS[languageKey]} ${t(languageKey)}</option>`).join("")}
        </select>
        <button type="button" class="translation-swap-button" data-translate-swap="true" aria-label="${t("common.swapLanguages")}">${icon("swap")}</button>
        <select class="translation-select" aria-label="${t("common.outputLanguage")}" data-translate-to="true">
          ${TRANSLATE_LANGUAGE_KEYS.map((languageKey) => `<option value="${languageKey}" ${languageKey === state.translateToLanguage ? "selected" : ""}>${TRANSLATE_LANGUAGE_FLAGS[languageKey]} ${t(languageKey)}</option>`).join("")}
        </select>
      </div>

      ${state.translateVoiceError ? `<p class="translation-voice-notice is-error">${escapeHtml(state.translateVoiceError)}</p>` : ""}
      ${state.translateVoiceNotice?.panel === "to" ? `<p class="translation-voice-notice">${escapeHtml(state.translateVoiceNotice.message)}</p>` : ""}
      ${state.translateCameraStatus === "error" ? `<p class="translation-voice-notice is-error">${escapeHtml(state.translateCameraErrorMessage)}</p>` : ""}

      <div class="alwen-quick-mic-row">
        <button type="button" class="alwen-quick-mic-button ${state.translateRecording ? "is-recording" : ""}" data-translate-record="true" aria-label="${state.translateRecording ? t("translate.stopListening") : t("translate.tapToSpeak")}" ${state.translateCameraStatus === "reading" ? "disabled" : ""}>
          ${icon(state.translateRecording ? "stop" : "recordMic")}
        </button>
        <p class="alwen-quick-translate-status">
          ${state.translateCameraStatus === "reading" ? `${t("translate.readingPhoto")} ${state.translateCameraProgress}%` : state.translateRecording ? t("translate.listening") : state.translateStatus === "loading" ? t("translate.translating") : t("translate.tapToSpeak")}
        </p>
      </div>

      ${state.translateInputText.trim() ? `<p class="alwen-quick-translate-source">${escapeHtml(state.translateInputText)}</p>` : ""}

      ${state.translateStatus === "success" ? `
        <div class="alwen-quick-translate-result">
          <p class="alwen-quick-translate-target">${escapeHtml(state.translateOutputText)}</p>
          <button type="button" class="translation-speak-button" data-translate-speak="to" aria-label="${t("translate.listenTranslation")}">${icon("speaker")}</button>
        </div>
      ` : ""}
      ${state.translateStatus === "error" ? `<p class="translation-voice-notice is-error">${t("translate.translateErrorMessage")}</p>` : ""}

      <button type="button" class="alwen-quick-translate-open" data-view="translate">${t("translate.openFullTranslator")}</button>
    </div>
  `;
}

/** Always-reachable real-time voice translation shortcut, pinned to the top
 * right — separate from the Alwen assistant dock (bottom right) so a user
 * mid-conversation with someone doesn't have to open the whole Alwen chat
 * panel just to translate a sentence. Reuses renderAlwenQuickTranslate()'s
 * language pickers/mic/result markup and its existing data-translate-*
 * bindings — only the surrounding shell (a top-right dock instead of being
 * nested in the Alwen panel) is new. Hidden on the full Translate screen for
 * the same reason the old embedded copy was: two copies of the same
 * data-translate-* controls in the DOM at once would break the
 * singular-selector bindings in bindEvents(). */
function renderQuickTranslateDock() {
  return `
    <aside class="quick-translate-dock ${state.quickTranslateOpen ? "is-open" : ""}" aria-label="${t("translate.quickTranslate")}">
      <button class="quick-translate-orb" data-quick-translate-toggle aria-expanded="${state.quickTranslateOpen ? "true" : "false"}" aria-label="${t("translate.quickTranslate")}" title="${t("translate.quickTranslate")}">${icon(state.translateRecording ? "stop" : "recordMic")}</button>
      <div class="quick-translate-panel" role="dialog" aria-label="${t("translate.quickTranslate")}">
        <div class="quick-translate-panel-head">
          <strong>${t("translate.quickTranslate")}</strong>
          <button data-quick-translate-toggle aria-label="${t("common.close")}">×</button>
        </div>
        ${renderAlwenQuickTranslate()}
      </div>
    </aside>
  `;
}


function renderMatch(match) {
  const visual = match.image
    ? `<img src="${match.image}" alt="" loading="lazy" onerror="this.closest('.match-tile-photo').classList.add('is-fallback')" />`
    : match.initials
      ? `<span class="match-tile-initials">${match.initials}</span>`
      : `<span class="match-tile-fallback-icon">${icon(match.tileIcon || "pin")}</span>`;
  return `
    <article class="match-row" data-view="${match.action}">
      <div class="match-tile-photo ${match.image ? "" : "is-fallback"}">${visual}</div>
      <span class="badge match-tile-kind">${match.kind}</span>
      <div class="match-tile-body">
        <h3>${match.title}</h3>
        <p>${match.meta}</p>
      </div>
      <button data-view="${match.action}" aria-label="${match.title}">${icon("arrow")}</button>
    </article>
  `;
}

/* type meta drives the post-type label/emoji shown on every card, the
 * filter chips, and which primary action a card offers (the action
 * itself is one of three real, already-existing behaviours — save,
 * share, or reply-in-detail-sheet — not nine bespoke flows; see
 * COMMUNITY_PRIMARY_ACTION_KIND below). */
const COMMUNITY_POST_TYPE_META = {
  question: { emoji: "❓", labelKey: "community.postType.question", actionKey: "community.postAction.question" },
  recommendation: { emoji: "⭐", labelKey: "community.postType.recommendation", actionKey: "community.postAction.recommendation" },
  alert: { emoji: "🚨", labelKey: "community.postType.alert", actionKey: "community.postAction.alert" },
  offer: { emoji: "🎁", labelKey: "community.postType.offer", actionKey: "community.postAction.offer" },
  help: { emoji: "🤝", labelKey: "community.postType.help", actionKey: "community.postAction.help" },
  lostFound: { emoji: "🐾", labelKey: "community.postType.lostFound", actionKey: "community.postAction.lostFound" },
  event: { emoji: "📅", labelKey: "community.postType.event", actionKey: "community.postAction.event" },
  update: { emoji: "📣", labelKey: "community.postType.update", actionKey: "community.postAction.update" },
  discussion: { emoji: "💬", labelKey: "community.postType.discussion", actionKey: "community.postAction.discussion" }
};

const COMMUNITY_PRIMARY_ACTION_KIND = {
  recommendation: "save",
  alert: "share"
  // every other type falls back to "reply" (opens the post-detail sheet)
};

const COMMUNITY_FILTER_META = [
  ["forYou", "community.filterForYou", "🏠"],
  ["nearby", "community.filterNearby", "📍"],
  ["question", "community.filterQuestions", "❓"],
  ["recommendation", "community.filterRecommendations", "⭐"],
  ["alert", "community.filterAlerts", "🚨"],
  ["help", "community.filterHelp", "🤝"],
  ["event", "community.filterEvents", "📅"]
];

function communityPostTypeMeta(type) {
  return COMMUNITY_POST_TYPE_META[type] || COMMUNITY_POST_TYPE_META.discussion;
}

/* Hidden posts, muted topics, and blocked authors all subtract from the
 * same feed — "hide"/"mute"/"block" are three different reasons for the
 * same effect (this stops showing up for me), so filtering happens in
 * one place rather than three separate checks scattered through the
 * render path. */
function visibleFeedPosts() {
  return feedPosts.filter(
    (post) => !state.hiddenPostIds.includes(post.id) && !state.mutedTopics.includes(post.type) && !state.blockedPeople.includes(post.author)
  );
}

/* "For you" and "Nearby" both show everything — there's no real
 * personalization or geo-distance signal in this mock data to
 * meaningfully tell them apart yet, so faking a difference between them
 * would be exactly the kind of dishonest signal the rest of this
 * redesign is trying to remove. Every other filter is a genuine
 * post.type match. */
function filteredCommunityPosts() {
  const visible = visibleFeedPosts();
  if (state.communityFilter === "forYou" || state.communityFilter === "nearby") return visible;
  return visible.filter((post) => post.type === state.communityFilter);
}

function renderPulse(post) {
  const isHelpful = state.helpfulPostIds.includes(post.id);
  const isSaved = state.savedPostIds.includes(post.id);
  const helpfulCount = (post.helpful || 0) + (isHelpful ? 1 : 0);
  const savesCount = (post.saves || 0) + (isSaved ? 1 : 0);
  const meta = communityPostTypeMeta(post.type);
  const primaryKind = COMMUNITY_PRIMARY_ACTION_KIND[post.type] || "reply";
  const primaryAttrs =
    primaryKind === "save"
      ? `data-action="toggle-post-save" data-post-id="${post.id}"`
      : primaryKind === "share"
        ? `data-action="share-post" data-post-id="${post.id}"`
        : `data-action="open-post-detail" data-post-id="${post.id}"`;
  return `
    <article class="pulse-card visual-pulse-card social-post-card type-${post.type}" data-post-id="${post.id}">
      <div class="pulse-card-header">
        <div class="pulse-author-row" role="button" tabindex="0" ${publicProfileAttrs({ id: post.authorId, name: post.author, avatar: post.avatar || reputationProfile.portrait, area: post.area, category: t(meta.labelKey), verified: post.verified, context: "community" })}>
          <img class="post-avatar" src="${post.avatar || reputationProfile.portrait}" alt="" />
          <div class="pulse-author-copy">
            <span class="pulse-author-name">${escapeHtml(post.author)}${post.verified ? `<span class="pulse-verified" title="${t("messages.verified")}">${icon("verify")}</span>` : ""}</span>
            <span class="pulse-meta-line">${escapeHtml(post.area)} · ${escapeHtml(post.time)}</span>
          </div>
        </div>
        <span class="post-type-label type-${post.type}">${meta.emoji} ${t(meta.labelKey)}</span>
        <button type="button" class="pulse-overflow" data-action="open-post-actions" data-post-id="${post.id}" aria-label="${t("community.postActionsTitle")}">⋯</button>
      </div>
      ${post.type === "alert"
        ? `
          <div class="pulse-alert-context">
            <span class="${post.active ? "is-active" : "is-resolved"}">${post.active ? t("community.alertActive") : t("community.alertResolved")}</span>
            ${post.verified ? `<span class="pulse-alert-source">${t("messages.verified")} · ${escapeHtml(post.author)}</span>` : ""}
          </div>
        `
        : ""}
      ${post.image ? `<div class="pulse-photo" style="background-image: url('${post.image}')"></div>` : ""}
      <div class="pulse-content">
        <h3>${post.titleKey ? t(post.titleKey) : escapeHtml(post.title || "")}</h3>
        <p>${post.bodyKey ? t(post.bodyKey) : escapeHtml(post.body || "")}</p>
        ${post.alwenSummaryKey ? `<div class="post-alwen-summary">${icon("spark")}<span>${t(post.alwenSummaryKey)}</span></div>` : ""}
        <div class="tag-row">${(post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </div>
      <div class="post-actions">
        <button type="button" class="post-primary-action" ${primaryAttrs}>${t(meta.actionKey)}</button>
        <button type="button" class="post-icon-action ${isHelpful ? "is-active" : ""}" data-action="toggle-helpful" data-post-id="${post.id}" aria-label="${t("common.helpful")}">${icon("star")}<span>${helpfulCount}</span></button>
        <button type="button" class="post-icon-action" data-action="open-post-detail" data-post-id="${post.id}" aria-label="${t("common.comments")}">${icon("message")}<span>${post.replies || 0}</span></button>
        <button type="button" class="post-icon-action ${isSaved ? "is-active" : ""}" data-action="toggle-post-save" data-post-id="${post.id}" aria-label="${t("common.favourite")}">${icon("heart")}<span>${savesCount}</span></button>
      </div>
    </article>
  `;
}

function renderCommunityFeedEmptyState() {
  const isFiltered = state.communityFilter !== "forYou" && state.communityFilter !== "nearby";
  return `
    <div class="notification-empty-state">
      <span class="notification-empty-icon" aria-hidden="true">${icon("people")}</span>
      <h3>${isFiltered ? t("community.emptyFilterTitle") : t("community.emptyFeedTitle")}</h3>
      <p>${isFiltered ? t("community.emptyFilterHint") : t("community.emptyFeedHint")}</p>
    </div>
  `;
}

function renderCommunitySignalStrip() {
  const needHelpCount = filteredHelpRequests().length;
  const newPostsCount = feedPosts.length;
  const alertsCount = feedPosts.filter((post) => post.type === "alert" && post.active).length;
  return `
    <div class="community-signal-strip">
      <span class="community-signal-label">${t("community.aroundYouToday")}</span>
      <div class="chip-row explore-category-row community-signal-chips">
        <button type="button" data-view="needHelp">${t("community.needHelpChip")} <span class="chip-count">${needHelpCount}</span></button>
        <button type="button" data-community-filter="forYou">${t("community.newPostsChip")} <span class="chip-count">${newPostsCount}</span></button>
        <button type="button" data-community-filter="alert">${t("community.alertsChip")} <span class="chip-count">${alertsCount}</span></button>
      </div>
    </div>
  `;
}

function renderCommunityFilterRow() {
  return renderCategoryChipRow(
    COMMUNITY_FILTER_META.map(([value, labelKey, emoji]) => ({
      label: t(labelKey),
      iconGlyph: emoji,
      isActive: state.communityFilter === value,
      attrs: `data-community-filter="${value}"`
    }))
  );
}

/* A Nextdoor/Facebook-style "what's on your mind" trigger — tapping
 * either the prompt or a quick-type chip opens the one real composer
 * sheet (renderCommunityComposerSheet), pre-selecting the post type for
 * the chips. "Add photo" is deliberately not offered here: unlike
 * marketplace listings, community posts have no photo-upload backend in
 * this app, and a button that can't actually attach anything would be
 * exactly the kind of prototype signal this redesign is removing. */
function renderCommunityComposerPrompt() {
  const avatar = state.auth.status === "signedIn" ? state.auth.user.avatar : null;
  const quickTypes = ["question", "recommendation", "alert", "help"];
  return `
    <div class="community-composer-card">
      <button type="button" class="community-composer-prompt" data-sheet="communityComposer">
        <span class="community-composer-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" />` : icon("profile")}</span>
        <span class="community-composer-placeholder">${t("community.composerPrompt")}</span>
      </button>
      <div class="chip-row explore-category-row community-composer-quick-actions">
        ${quickTypes
          .map((type) => {
            const meta = communityPostTypeMeta(type);
            const labelKey = { question: "community.composerQuickAsk", recommendation: "community.composerQuickRecommend", alert: "community.composerQuickAlert", help: "community.composerQuickOffer" }[type];
            return `<button type="button" data-sheet="communityComposer" data-community-post-type="${type}">${meta.emoji} ${t(labelKey)}</button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderCommunityComposerSheet() {
  if (state.auth.status !== "signedIn") {
    return `
      <div class="sheet-backdrop" data-sheet-close="true">
        <section class="selection-sheet" aria-label="${t("community.createPost")}">
          <div class="sheet-handle"></div>
          <div class="sheet-title">
            <div><h2>${t("community.createPost")}</h2></div>
            <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
          </div>
          <div class="auth-card">
            <p class="auth-hint">${t("community.composerSignInHint")}</p>
            <button type="button" class="auth-primary-button" data-view="profile" data-sheet-close="true">${t("common.signIn")}</button>
          </div>
        </section>
      </div>
    `;
  }
  const draft = state.communityPostDraft;
  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet community-composer-sheet" aria-label="${t("community.createPost")}">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <div><h2>${t("community.createPost")}</h2></div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>
        <form data-action="submit-community-post">
          <p class="composer-field-label">${t("community.composerPostTypeLabel")}</p>
          <div class="chip-row explore-category-row">
            ${COMMUNITY_POST_TYPES.map((type) => {
              const meta = communityPostTypeMeta(type);
              return `<button type="button" class="${draft.type === type ? "is-selected" : ""}" data-community-post-type="${type}">${meta.emoji} ${t(meta.labelKey)}</button>`;
            }).join("")}
          </div>
          <label class="composer-field">
            <span>${t("community.composerTitleLabel")}</span>
            <input type="text" name="title" placeholder="${t("community.composerTitlePlaceholder")}" value="${escapeHtml(draft.title)}" required />
          </label>
          <label class="composer-field">
            <span>${t("community.composerBodyLabel")}</span>
            <textarea name="body" placeholder="${t("community.composerBodyPlaceholder")}" required>${escapeHtml(draft.body)}</textarea>
          </label>
          <button type="submit" class="auth-primary-button">${t("community.composerSubmit")}</button>
        </form>
      </section>
    </div>
  `;
}

function renderPostActionsSheet() {
  const post = feedPosts.find((item) => item.id === state.activePostId);
  if (!post) return "";
  const isReported = state.reportedPeople.includes(post.author);
  const isBlocked = state.blockedPeople.includes(post.author);
  const isHidden = state.hiddenPostIds.includes(post.id);
  const isMuted = state.mutedTopics.includes(post.type);
  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet post-actions-sheet" aria-label="${t("community.postActionsTitle")}">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <div><h2>${t("community.postActionsTitle")}</h2></div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>
        <div class="post-actions-sheet-list">
          <button type="button" data-action="toggle-post-save" data-post-id="${post.id}" data-sheet-close="true">${icon("heart")} ${t("common.favourite")}</button>
          <button type="button" data-action="share-post" data-post-id="${post.id}" data-sheet-close="true">${icon("arrow")} ${t("common.share")}</button>
          <button type="button" class="${isHidden ? "is-active" : ""}" data-action="hide-post" data-post-id="${post.id}" ${isHidden ? "disabled" : ""}>${icon("exit")} ${t("community.hidePost")}</button>
          <button type="button" class="${isMuted ? "is-active" : ""}" data-action="mute-topic" data-post-id="${post.id}" ${isMuted ? "disabled" : ""}>${icon("bell")} ${t("community.muteTopic")}</button>
          <button type="button" class="${isReported ? "is-active" : ""}" data-action="report-post-author" data-post-id="${post.id}" ${isReported ? "disabled" : ""}>${isReported ? t("common.reportedConfirmation") : t("common.reportPersonCta")}</button>
          <button type="button" class="${isBlocked ? "is-active" : ""}" data-action="block-post-author" data-post-id="${post.id}" ${isBlocked ? "disabled" : ""}>${isBlocked ? t("common.blockedConfirmation") : t("common.blockPersonCta")}</button>
        </div>
      </section>
    </div>
  `;
}

/* The only place a post's full text + replies are shown together —
 * "Answer"/"Offer help"/"I've seen this"/"Join discussion"/"View" all
 * open this same sheet (see COMMUNITY_PRIMARY_ACTION_KIND), since the
 * underlying mechanic for all of them is the same: read the post, reply
 * to it. Replies are a flat list, not threaded — proportionate to a
 * feed that has no comment system anywhere else in the app yet. */
function renderPostDetailSheet() {
  const post = feedPosts.find((item) => item.id === state.activePostId);
  if (!post) return "";
  const meta = communityPostTypeMeta(post.type);
  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet post-detail-sheet" aria-label="${t(meta.labelKey)}">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <div>
            <p class="eyebrow">${meta.emoji} ${t(meta.labelKey)}</p>
            <h2>${post.titleKey ? t(post.titleKey) : escapeHtml(post.title || "")}</h2>
          </div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>
        <p class="post-detail-body">${post.bodyKey ? t(post.bodyKey) : escapeHtml(post.body || "")}</p>
        <div class="post-detail-replies">
          ${(post.replyList || [])
            .map(
              (reply) => `
                <div class="post-detail-reply">
                  <strong>${escapeHtml(reply.author)}</strong>
                  <p>${escapeHtml(reply.text)}</p>
                </div>
              `
            )
            .join("") || `<p class="post-detail-no-replies">${t("community.emptyFeedHint")}</p>`}
        </div>
        <form class="post-detail-composer" data-action="reply-to-post" data-post-id="${post.id}">
          <input type="text" name="reply" placeholder="${t(meta.actionKey)}…" aria-label="${t(meta.actionKey)}" autocomplete="off" />
          <button type="submit">${t("messages.send")}</button>
        </form>
      </section>
    </div>
  `;
}

function renderCreate() {
  const primaryCreationActions = [
    ["tag", "common.sellSomething", "common.sellSomethingHint", "createListing"],
    ["help", "common.requestHelp", "common.requestHelpHint", "needHelp"],
    ["city", "common.addBusiness", "common.addBusinessHint", "ops"]
  ];
  const secondaryCreationActions = [
    ["message", "common.postCommunity", "common.postCommunityHint", "community"],
    ["service", "common.offerService", "common.offerServiceHint", "hire"],
    ["stay", "common.rentSomething", "common.rentSomethingHint", "createListing", "rentals"],
    ["calendar", "common.createEvent", "common.createEventHint", "community"],
    ["briefcase", "common.findWork", "common.findWorkHint", "contribute"]
  ];

  return `
    <section class="section-shell create-shell">
      <div class="screen-heading">
        <p class="eyebrow">${t("nav.create")}</p>
        <h1>${t("common.createTitle")}</h1>
      </div>
      ${renderAiSearch("create")}
      ${renderAiSearchResults(6, "create")}
      <div class="create-command-centre" aria-label="${t("nav.create")}">
        <div class="create-primary-actions">
          ${primaryCreationActions.map(([iconName, titleKey, hintKey, view]) => `
            <button class="create-primary-action" data-view="${view}">
              <span class="create-icon">${icon(iconName)}</span>
              <span class="create-action-copy">
                <strong>${t(titleKey)}</strong>
                <small>${t(hintKey)}</small>
              </span>
              <span class="create-chevron">${icon("arrow")}</span>
            </button>
          `).join("")}
        </div>
        <div class="create-secondary-actions">
          ${secondaryCreationActions.map(([iconName, titleKey, hintKey, view, category]) => `
            <button class="create-secondary-action" data-view="${view}" ${category ? `data-category="${category}" data-target-view="${view}"` : ""}>
              <span class="create-icon">${icon(iconName)}</span>
              <span class="create-action-copy">
                <strong>${t(titleKey)}</strong>
                <small>${t(hintKey)}</small>
              </span>
              <span class="create-chevron">${icon("arrow")}</span>
            </button>
          `).join("")}
        </div>
      </div>
      ${renderAlwenListingCreator()}
    </section>
  `;
}

function renderCommunityRail() {
  const trending = [...visibleFeedPosts()].sort((a, b) => (b.helpful || 0) - (a.helpful || 0)).slice(0, 3);
  const activeAlerts = visibleFeedPosts().filter((post) => post.type === "alert" && post.active).slice(0, 3);
  const suggestedPeople = [...new Map(visibleFeedPosts().map((post) => [post.authorId, post])).values()].slice(0, 3);
  return `
    <aside class="community-rail">
      <div class="notification-rail-card">
        <h3>${t("community.trendingNearby")}</h3>
        ${trending.length
          ? `<ul class="notification-rail-list">${trending.map((post) => `<li>${post.titleKey ? t(post.titleKey) : escapeHtml(post.title || "")}</li>`).join("")}</ul>`
          : `<p class="notification-rail-empty">${t("community.emptyFeedHint")}</p>`}
      </div>
      <div class="notification-rail-card">
        <h3>${t("community.alertsChip")}</h3>
        ${activeAlerts.length
          ? `<ul class="notification-rail-list">${activeAlerts.map((post) => `<li>${post.titleKey ? t(post.titleKey) : escapeHtml(post.title || "")}</li>`).join("")}</ul>`
          : `<p class="notification-rail-empty">${t("community.alertResolved")}</p>`}
      </div>
      <div class="notification-rail-card">
        <h3>${t("community.suggestedPeople")}</h3>
        <ul class="notification-rail-list community-rail-people">
          ${suggestedPeople
            .map(
              (post) => `
                <li role="button" tabindex="0" ${publicProfileAttrs({ id: post.authorId, name: post.author, avatar: post.avatar || reputationProfile.portrait, area: post.area, verified: post.verified, context: "community" })}>
                  <img src="${post.avatar || reputationProfile.portrait}" alt="" />
                  <span>${escapeHtml(post.author)}<small>${escapeHtml(post.area)}</small></span>
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
      <div class="notification-rail-card">
        <h3>${t("community.guidelines")}</h3>
        <p class="notification-rail-hint">${t("community.guidelinesHint")}</p>
      </div>
      <div class="notification-rail-card">
        <h3>${t("alwen.alwenWorkspace")}</h3>
        <p class="notification-rail-hint">${t("alwen.alwenWorkspaceTitle")}</p>
        <button type="button" class="notification-rail-button" data-alwen-toggle>${t("community.askAlwen")}</button>
      </div>
    </aside>
  `;
}

function renderCommunity() {
  const posts = filteredCommunityPosts();
  return `
    <section class="section-shell community-shell">
      <section class="city-hero page-hero community-hero-photo community-header-compact" aria-labelledby="community-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("nav.community")} · ${currentAreaLabel()}</p>
          <h1 id="community-hero-title">${t("community.communityHeroTitle")}</h1>
          <p>${t("community.communityHeroSubtitle")}</p>
        </div>
        <div class="community-header-actions">
          <button type="button" class="community-header-primary" data-sheet="communityComposer">${t("community.createPost")}</button>
          <button type="button" class="community-header-secondary" data-alwen-toggle>${t("community.askAlwen")}</button>
        </div>
      </section>
      <div class="community-layout">
        <div class="community-main">
          ${renderAiSearch("community")}
          ${renderCommunityComposerPrompt()}
          ${renderCommunitySignalStrip()}
          ${renderCommunityFilterRow()}
          <div class="pulse-list">
            ${posts.length ? posts.map(renderPulse).join("") : renderCommunityFeedEmptyState()}
          </div>
          ${posts.length ? `<p class="community-end-of-feed">${t("community.endOfFeed")}</p>` : ""}
          ${/* Community's own feed and stats are the neighbourhood's actual
             content — Nearby picks/Alwen found used to sit above them,
             right under the hero, and outranked the real feed. Pushed
             below the feed so it reads as a supplementary find, not the
             headline. */
            renderAiSearchResults(6, "community")}
          <div class="section-title">
            <div><h2>${t("common.liveRequests")}</h2><p>${t("common.liveRequestsHint")}</p></div>
            <button data-view="needHelp">${t("needHelp.needHelpCta")}</button>
          </div>
          <div class="request-list">
            ${filteredHelpRequests().map(renderHelpRequest).join("") || renderEmptyState(t("community.emptyFeedHint"))}
          </div>
        </div>
        ${renderCommunityRail()}
      </div>
    </section>
  `;
}

function renderSavedPlaces() {
  const saved = importedBusinesses.filter((item) => state.savedPlaceIds.includes(item.id));
  return `
    <section class="section-shell">
      <div class="screen-heading">
        <p class="eyebrow">${t("nav.profile")}</p>
        <h1>${t("profile.quickActions.savedPlacesAction")}</h1>
        <p>${t("profile.quickActions.savedPlacesHint")}</p>
      </div>
      ${saved.length
        ? `<div class="imported-list">${saved.map(renderPlaceCard).join("")}</div>`
        : `
          <div class="auth-card">
            <p class="auth-hint">${t("profile.quickActions.savedPlacesEmpty")}</p>
            <button type="button" class="auth-primary-button" data-view="explore">${t("business.dashboard.businessDashboardEmptyCta")}</button>
          </div>
        `}
    </section>
  `;
}

/** A second, narrower row of "pick and choose" chips under the main
 * category row — only for categories where the underlying imported
 * data actually supports a real distinction, so nothing here is
 * fabricated: Food & Drink cuisines come from the same OSM-tag
 * whitelist used for realPlaceSpecialty(), and hotel star tiers are
 * only offered for values that genuinely exist in the seed data. */
function renderExploreSubFilterRow() {
  if (state.exploreCategory === "Food & Drink") {
    const cuisines = Object.keys(PLACE_SPECIALTY_TAG_KEY);
    return `
      <div class="chip-row explore-category-row explore-subfilter-row">
        <button class="${state.exploreCuisine === "All" ? "is-selected" : ""}" data-explore-cuisine="All">${t("common.all")}</button>
        ${cuisines.map((key) => `<button class="${state.exploreCuisine === key ? "is-selected" : ""}" data-explore-cuisine="${key}">${t(PLACE_SPECIALTY_TAG_KEY[key])}</button>`).join("")}
      </div>
    `;
  }
  if (state.exploreCategory === "Hotels") {
    const availableStars = [...new Set(importedBusinesses.filter((item) => item.category === "Hotels" && item.rating).map((item) => item.rating))].sort((a, b) => b - a);
    if (!availableStars.length) return "";
    return `
      <div class="chip-row explore-category-row explore-subfilter-row">
        <button class="${state.exploreStars === "All" ? "is-selected" : ""}" data-explore-stars="All">${t("common.all")}</button>
        ${availableStars.map((n) => `<button class="${state.exploreStars === String(n) ? "is-selected" : ""}" data-explore-stars="${n}">${icon("star").repeat(n)}</button>`).join("")}
      </div>
    `;
  }
  return "";
}

/** Three universal trust/convenience toggles — every one backed by a
 * genuinely real field (isOpenNow, isPlaceVerified, HAS_PHOTO_STATUSES).
 * Deliberately does NOT include the brief's "family friendly"/"pet
 * friendly"/"wheelchair accessible"/"halal"/"vegetarian"/"free parking"
 * filters — none of those exist as real structured data anywhere in the
 * imported dataset (checked the real OSM tag values on every record;
 * see PLACE_SPECIALTY_TAG_KEY's own comment on why even the few loose
 * tag fragments that exist are too ambiguous to filter on). Shipping
 * them would mean filters that silently return nothing or filter on the
 * wrong thing — worse than not having them. */
function renderExploreFilterRow() {
  return `
    <div class="chip-row explore-category-row explore-filter-row">
      <button class="${state.exploreOpenNowOnly ? "is-selected" : ""}" data-explore-toggle="exploreOpenNowOnly">${t("status.openNow")}</button>
      <button class="${state.exploreVerifiedOnly ? "is-selected" : ""}" data-explore-toggle="exploreVerifiedOnly">${t("status.verified")}</button>
      <button class="${state.exploreHasPhotoOnly ? "is-selected" : ""}" data-explore-toggle="exploreHasPhotoOnly">${t("explore.filterHasPhoto")}</button>
    </div>
  `;
}

/** Real time-of-day context — genuinely the current hour/day, not a
 * simulated or fabricated "AI mood". Used only to re-order the Hub's
 * category cards; it never hides a category or invents data. */
function currentExploreTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  let bucket;
  if (hour >= 5 && hour < 10) bucket = "morning";
  else if (hour >= 10 && hour < 14) bucket = "midday";
  else if (hour >= 14 && hour < 17) bucket = "afternoon";
  else if (hour >= 17 && hour < 22) bucket = "evening";
  else bucket = "night";
  return { bucket, isWeekendEvening: (day === 5 || day === 6) && hour >= 17 };
}

const EXPLORE_TIME_BOOST = {
  morning: ["Food & Drink", "Groceries", "Pharmacy", "Transport"],
  midday: ["Food & Drink", "Shops"],
  afternoon: ["Shops", "Beauty & Wellness", "Public Services"],
  evening: ["Food & Drink", "Nightlife", "Attractions"],
  night: ["Nightlife", "Pharmacy"]
};

const EXPLORE_WEEKEND_EVENING_BOOST = ["Nightlife", "Food & Drink", "Attractions"];

/** Keyword → category map used only to attribute a real, just-submitted
 * search to a category for the visit-count signal below — never to
 * silently rewrite or filter the query itself. */
const EXPLORE_SEARCH_CATEGORY_HINTS = {
  "Food & Drink": ["restaurant", "cafe", "coffee", "lunch", "dinner", "pizza", "sushi", "bakery"],
  Groceries: ["grocery", "groceries", "supermarket", "convenience"],
  Pharmacy: ["pharmacy", "medicine", "prescription"],
  Healthcare: ["doctor", "clinic", "hospital", "dentist"],
  Hotels: ["hotel", "hostel", "guesthouse"],
  Shops: ["shop", "mall", "clothing", "electronics", "store"],
  "Beauty & Wellness": ["salon", "spa", "barber", "haircut", "massage", "gym"],
  Transport: ["taxi", "bus", "metro", "parking", "train"],
  "Public Services": ["municipality", "embassy", "police"],
  Attractions: ["museum", "landmark", "attraction"],
  Parks: ["park", "playground"],
  Finance: ["bank", "atm"],
  Education: ["school", "university", "tutor"],
  Nightlife: ["bar", "club", "nightlife", "pub"],
  Automobile: ["mechanic", "garage", "fuel", "petrol", "tyres"],
  "Pet Services": ["vet", "veterinary", "pet", "grooming"],
  "Home Services": ["plumber", "electrician", "carpenter", "painter", "locksmith", "gardener", "handyman"]
};

function matchExploreSearchCategory(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const [category, keywords] of Object.entries(EXPLORE_SEARCH_CATEGORY_HINTS)) {
    if (keywords.some((word) => new RegExp(`\\b${word}\\b`).test(q))) return category;
  }
  return null;
}

/** Real session behaviour — incremented when the user actually selects a
 * category or a search of theirs is attributed to one (see bindEvents).
 * Not persisted beyond the session, same scope as state.query itself. */
function bumpExploreCategorySignal(category) {
  if (!category) return;
  state.exploreCategoryVisitCounts[category] = (state.exploreCategoryVisitCounts[category] || 0) + 1;
}

/** Combines the two real signals above into a stable sort — ties keep
 * CITY_ENTITY_CATEGORIES' original order (Array#sort is stable), so the
 * grid never jitters for categories with equal, usually zero, score. */
function sortedExploreHubCategories() {
  const { bucket, isWeekendEvening } = currentExploreTimeContext();
  const timeBoost = EXPLORE_TIME_BOOST[bucket] || [];
  const visits = state.exploreCategoryVisitCounts;
  const scoreOf = (category) => {
    let score = 0;
    if (timeBoost.includes(category)) score += 3;
    if (isWeekendEvening && EXPLORE_WEEKEND_EVENING_BOOST.includes(category)) score += 3;
    score += Math.min(visits[category] || 0, 5);
    return score;
  };
  return [...CITY_ENTITY_CATEGORIES].sort((a, b) => scoreOf(b) - scoreOf(a));
}

/** Real counts only — how many imported places actually sit in this
 * category, and how many of those are genuinely open right now
 * (isOpenNow, not a guess). Omits the "open now" line entirely rather
 * than showing 0, since a category can have real places with unknown
 * hours. */
function exploreCategoryHubMetadata(category) {
  const items = importedBusinesses.filter((item) => item.category === category);
  const openNowCount = items.filter((item) => isOpenNow(item.openingHours) === true).length;
  return { total: items.length, openNowCount };
}

function renderExploreHubCard(category, index) {
  const { total, openNowCount } = exploreCategoryHubMetadata(category);
  const tone = CATEGORY_TILE_TONES[index % CATEGORY_TILE_TONES.length];
  return `
    <button type="button" class="explore-hub-card tone-${tone}" data-explore-category="${category}">
      <span class="explore-hub-card-icon">${EXPLORE_CATEGORY_EMOJI[category] || "📍"}</span>
      <span class="explore-hub-card-name">${businessCategoryLabel(category)}</span>
      <span class="explore-hub-card-meta">
        ${total > 0 ? t("explore.hub.placesCount", { count: total }) : t("explore.hub.noPlacesYet")}
        ${openNowCount > 0 ? `<span class="explore-hub-card-open">${t("explore.hub.openNowCount", { count: openNowCount })}</span>` : ""}
      </span>
      <span class="explore-hub-card-arrow" aria-hidden="true">${icon("arrow")}</span>
    </button>
  `;
}

/** Stage 1 — orientation, not a filtered list. One search bar (jumps
 * straight into Stage 2 unfiltered on submit, same "Tell Alwen" pattern
 * as everywhere else) and a grid of destination cards, real-count
 * metadata, ordered by real time-of-day + real session behaviour. */
function renderExploreHub() {
  const categories = sortedExploreHubCategories();
  return `
    <section class="section-shell explore-shell">
      <section class="city-hero page-hero" aria-labelledby="explore-hub-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("explore.exploreEyebrow")} · ${currentAreaLabel()}</p>
          <h1 id="explore-hub-title">${t("explore.hub.title")}</h1>
          <p>${t("explore.hub.subtitle")}</p>
        </div>
        ${renderAiSearch("explore")}
      </section>
      <div class="explore-hub-grid">
        ${categories.map((category, index) => renderExploreHubCard(category, index)).join("")}
      </div>
    </section>
  `;
}

/** Stage 1 (orientation: "what do you need?") vs Stage 2 (the actual
 * discover-and-filter experience for one category, or everything when
 * exploreCategory === "All"). See renderExploreHub() for Stage 1. */
function renderExplore() {
  if (!state.exploreCategoryChosen) return renderExploreHub();
  return renderExploreCategoryPage();
}

function renderExploreCategoryPage() {
  const imported = filteredImportedBusinesses();
  const EXPLORE_PREVIEW_LIMIT = 30;
  const shown = imported.slice(0, EXPLORE_PREVIEW_LIMIT);
  const category = state.exploreCategory || "All";
  const isBrowsingAll = category === "All" && !state.query.trim();
  return `
    <section class="section-shell explore-shell">
      <button type="button" class="back-button explore-back-to-hub" data-action="explore-back-to-hub">${icon("arrow")}${t("explore.backToHub")}</button>
      <section class="city-hero page-hero" aria-labelledby="explore-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("explore.exploreEyebrow")} · ${currentAreaLabel()}</p>
          <h1 id="explore-hero-title">${t("explore.exploreTitle")}</h1>
          <p>${t("explore.exploreHeroSubtitle")}</p>
        </div>
        ${renderAiSearch("explore")}
      </section>
      ${renderCategoryChipRow(
        ["All", ...CITY_ENTITY_CATEGORIES].map((cat) => ({
          label: cat === "All" ? t("common.all") : businessCategoryLabel(cat),
          iconGlyph: cat === "All" ? "🧭" : EXPLORE_CATEGORY_EMOJI[cat] || "📍",
          isActive: category === cat,
          attrs: `data-explore-category="${cat}"`
        }))
      )}
      <div class="section-title">
        <div><h2>${category === "All" ? t("import.importedDirectory") : businessCategoryLabel(category)}</h2><p>${t(EXPLORE_CATEGORY_TAGLINE[category] || EXPLORE_CATEGORY_TAGLINE.All)}</p></div>
      </div>
      ${renderExploreFilterRow()}
      ${renderExploreSubFilterRow()}
      ${renderDiscoverToggle()}
      ${renderAiSearchResults(6, "explore")}
      ${isBrowsingAll ? renderExploreDiscoveryRails() : ""}
      <label class="explore-sort">
        <span>${t("import.sort.sortLabel")}</span>
        <select data-role="explore-sort">
          <option value="nearest" ${state.exploreSort === "nearest" ? "selected" : ""}>${t("import.sort.sortNearest")}</option>
          <option value="openNow" ${state.exploreSort === "openNow" ? "selected" : ""}>${t("import.sort.sortOpenNow")}</option>
          <option value="recentlyUpdated" ${state.exploreSort === "recentlyUpdated" ? "selected" : ""}>${t("import.sort.sortRecentlyUpdated")}</option>
          <option value="category" ${state.exploreSort === "category" ? "selected" : ""}>${t("import.sort.sortCategory")}</option>
          <option value="hasPhoto" ${state.exploreSort === "hasPhoto" ? "selected" : ""}>${t("import.sort.sortHasPhoto")}</option>
        </select>
      </label>
      <p class="import-attribution">${t("common.showingPreviewOf").replace("{shown}", shown.length).replace("{total}", imported.length)}</p>
      <div class="imported-list">
        ${shown.map(renderPlaceCard).join("") || renderEmptyState(t("explore.exploreEmptyState"))}
      </div>
    </section>
  `;
}

function renderMarketplaceMiniCard(item) {
  const isSaved = state.savedListingIds.includes(String(item.id));
  return `
    <article class="market-mini-card" data-view="listingDetail" data-listing-id="${item.id}" role="button" tabindex="0" aria-label="${escapeHtml(`${listingTitle(item)} ${item.price}`)}">
      <div class="card-photo" style="background-image: url('${item.image}')"></div>
      <button type="button" class="mini-save ${isSaved ? "is-active" : ""}" data-action="toggle-listing-save" data-listing-id="${item.id}" aria-label="${t("common.favourite")}">${icon("heart")}</button>
      <span>${categoryLabel(item.type)}</span>
      <h3>${listingTitle(item)}</h3>
      <div class="mini-price-line"><strong>${item.price}</strong><em>${item.popularity || item.aiInsight || item.status}</em></div>
      <p>${joinNonEmpty([item.area, item.distance])}</p>
    </article>
  `;
}

function marketplaceListingRail(titleKey, hintKey, items) {
  if (!items.length) return "";
  return renderLivingSection(
    titleKey,
    hintKey,
    "marketplace",
    renderCarousel(
      titleKey,
      "living-rail marketplace-rail",
      items.map(renderMarketplaceMiniCard).join("")
    )
  );
}

function renderMarketplaceCollections(items) {
  if (!items.length) return "";
  const parseCount = (value) => Number.parseInt(String(value).match(/\d+/)?.[0] ?? "0", 10);
  const parseDistance = (value) => (value === "Remote" ? Infinity : Number.parseFloat(value) || Infinity);
  const byId = (a, b) => b.id - a.id;

  const trending = [...items].sort((a, b) => parseCount(b.popularity) - parseCount(a.popularity)).slice(0, 6);
  const recentlyListed = [...items].sort(byId).slice(0, 6);
  const bestRated = items.filter((item) => item.verifiedSeller).slice(0, 6);
  const nearby = [...items].sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance)).slice(0, 6);
  const openNow = items.filter((item) => /open|available|hiring|this week/i.test(item.status)).slice(0, 6);
  const recommended = [...items].sort((a, b) => byId(a, b)).reverse().slice(0, 6);

  return `
    ${marketplaceListingRail("home.rail.trendingToday", "home.rail.trendingTodayHint", trending)}
    ${marketplaceListingRail("home.rail.recentlyListed", "home.rail.recentlyListedHint", recentlyListed)}
    ${marketplaceListingRail("home.rail.bestRated", "home.rail.bestRatedHint", bestRated)}
    ${marketplaceListingRail("home.rail.nearbyListings", "home.rail.nearbyListingsHint", nearby)}
    ${marketplaceListingRail("home.rail.openNowListings", "home.rail.openNowListingsHint", openNow)}
    ${marketplaceListingRail("home.rail.recommendedForYou", "home.rail.recommendedForYouHint", recommended)}
  `;
}

/** Real counts only — how many listings actually sit in this category
 * ("all" counts every listing), and how many of those read as currently
 * active (same open/available/hiring/this-week signal already used by
 * renderMarketplaceCollections' "Open now" rail, not a separate guess). */
function marketplaceCategoryMetadata(categoryId) {
  const items = categoryId === "all" ? listings : listings.filter((item) => item.type === categoryId);
  const activeCount = items.filter((item) => /open|available|hiring|this week/i.test(item.status)).length;
  return { total: items.length, activeCount };
}

/** Same destination-card language as renderExploreHubCard (icon, name,
 * real metadata, arrow hint) — the Marketplace picker used to be a plain
 * icon+label box grid with no metadata while Explore's Stage 1 hub got
 * the premium treatment; this brings them into the same visual family
 * per the shared card system's "same skeleton, different content" rule.
 * Reuses .explore-hub-card/.explore-hub-grid directly rather than a
 * parallel .marketplace-hub-card class, since the pattern is generic. */
function renderMarketplaceHubCard(categoryId, index) {
  const isAll = categoryId === "all";
  const { total, activeCount } = marketplaceCategoryMetadata(categoryId);
  const tone = CATEGORY_TILE_TONES[index % CATEGORY_TILE_TONES.length];
  const label = isAll ? t("common.allCategories") : t(categories.find((category) => category.id === categoryId).labelKey);
  return `
    <button type="button" class="explore-hub-card tone-${tone}" data-category="${categoryId}" data-target-view="marketplace">
      <span class="explore-hub-card-icon">${isAll ? "🧭" : MARKETPLACE_CATEGORY_EMOJI[categoryId] || "🏷️"}</span>
      <span class="explore-hub-card-name">${label}</span>
      <span class="explore-hub-card-meta">
        ${total > 0 ? t("marketplace.hub.listingsCount", { count: total }) : t("marketplace.hub.noListingsYet")}
        ${activeCount > 0 ? `<span class="explore-hub-card-open">${t("marketplace.hub.activeNowCount", { count: activeCount })}</span>` : ""}
      </span>
      <span class="explore-hub-card-arrow" aria-hidden="true">${icon("arrow")}</span>
    </button>
  `;
}

/** Marketplace's own landing screen is the category picker, not the
 * listings page — every arrival here (bottom-nav tab, any other "go to
 * Marketplace" link) resets state.marketplaceCategoryChosen to false
 * (see the [data-view] handler in bindEvents), so this branch is what
 * actually shows first. Picking any tile below — including "All" — sets
 * it back to true (see the [data-category] handler) and re-renders into
 * the full page underneath. */
function renderMarketplacePicker() {
  return `
    <section class="section-shell explore-shell marketplace-picker-shell">
      <section class="city-hero page-hero marketplace-picker-hero marketplace-hero-photo" aria-labelledby="marketplace-picker-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("home.cityOS")} · ${currentAreaLabel()}</p>
          <h1 id="marketplace-picker-title">${t("marketplace.marketplaceHeroTitle")}</h1>
          <p>${t("marketplace.marketplaceHeroSubtitle")}</p>
        </div>
        ${renderAiSearch("marketplace")}
      </section>
      ${marketplaceListingRail("home.rail.trendingMarketplace", "home.rail.trendingMarketplaceHint", trendingListingItems(10))}
      <div class="explore-hub-grid">
        ${["all", ...categories.map((category) => category.id)].map((categoryId, index) => renderMarketplaceHubCard(categoryId, index)).join("")}
      </div>
    </section>
  `;
}

function renderMarketplace() {
  if (!state.marketplaceCategoryChosen) return renderMarketplacePicker();

  const items = filteredListings();
  const pros = filteredProfessionals();

  return `
    <section class="section-shell marketplace-shell">
      <section class="city-hero page-hero marketplace-hero-photo" aria-labelledby="marketplace-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("home.cityOS")} · ${currentAreaLabel()}</p>
          <h1 id="marketplace-hero-title">${t("marketplace.marketplaceHeroTitle")}</h1>
          <p>${t("marketplace.marketplaceHeroSubtitle")}</p>
        </div>
        ${renderAiSearch("marketplace")}
      </section>
      ${renderCapabilityRail()}
      <div class="need-help-card">
        <div>
          <p class="eyebrow">${t("common.signatureFlow")}</p>
          <h2>${t("needHelp.needHelpTitle")}</h2>
          <p>${t("needHelp.needHelpBody")}</p>
        </div>
        <button data-view="needHelp">${t("needHelp.needHelpCta")}</button>
      </div>
      ${renderMarketplaceCategoryChipRow("marketplace")}
      ${renderDiscoverToggle()}
      ${renderAiSearchResults(6, "marketplace")}
      ${renderMarketplaceCollections(items)}
      ${renderAlwenListingCreator()}
      <div class="section-title">
        <div><h2>${t("home.rail.allListings")}</h2><p>${t("home.rail.allListingsHint")}</p></div>
      </div>
      <div class="market-grid">
        ${items.map(renderMarketplaceListing).join("")}
      </div>
      <div class="section-title">
        <div><h2>${t("common.verifiedPros")}</h2><p>${t("common.verifiedProsHint")}</p></div>
        <button data-view="needHelp">${t("common.requestQuote")}</button>
      </div>
      <div class="pro-list">
        ${pros.map(renderProfessional).join("")}
      </div>
    </section>
  `;
}

/** Real signals only — every count here traces to something the user
 * actually did (myListings/myHelpRequests carry a real created_at from
 * Supabase, ownedBusinesses() reflects a real claim, feedPosts is
 * filtered to posts this signed-in user actually composed, saved counts
 * are real toggle state) rather than a fabricated 0-100 "trust score" or
 * percentile claim. No leaderboard exists, so there is no "Top 4%" —
 * that would require knowing every other user's score. */
function contributeRealActivityBreakdown(user) {
  const myPosts = feedPosts.filter((post) => post.author === user.name);
  const savedCount = state.savedListingIds.length + state.savedPlaceIds.length;
  return [
    { key: "marketplace", icon: "tag", count: state.myListings.length, labelKey: "contribute.activity.marketplaceLabel", emptyKey: "contribute.activity.marketplaceEmpty", emptyCtaKey: "contribute.activity.marketplaceEmptyCta", emptyView: "createListing", activeCtaKey: "contribute.activity.marketplaceActiveCta", activeView: "profile" },
    { key: "help", icon: "help", count: state.myHelpRequests.length, labelKey: "contribute.activity.helpLabel", emptyKey: "contribute.activity.helpEmpty", emptyCtaKey: "contribute.activity.helpEmptyCta", emptyView: "needHelp", activeCtaKey: "contribute.activity.helpActiveCta", activeView: "profile" },
    { key: "community", icon: "chat", count: myPosts.length, labelKey: "contribute.activity.communityLabel", emptyKey: "contribute.activity.communityEmpty", emptyCtaKey: "contribute.activity.communityEmptyCta", emptyView: "community", activeCtaKey: "contribute.activity.communityActiveCta", activeView: "community" },
    { key: "business", icon: "shop", count: ownedBusinesses().length, labelKey: "contribute.activity.businessLabel", emptyKey: "contribute.activity.businessEmpty", emptyCtaKey: "contribute.activity.businessEmptyCta", emptyView: "businessClaim", activeCtaKey: "contribute.activity.businessActiveCta", activeView: "businessDashboard" },
    { key: "saved", icon: "heart", count: savedCount, labelKey: "contribute.activity.savedLabel", emptyKey: "contribute.activity.savedEmpty", emptyCtaKey: "contribute.activity.savedEmptyCta", emptyView: "explore", activeCtaKey: "contribute.activity.savedActiveCta", activeView: "savedPlaces" }
  ];
}

/** Real proportions, not a fabricated score — a conic-gradient ring
 * whose arcs are sized exactly by each category's real count out of the
 * real total. Renders an honest empty state instead of a ring with
 * nothing in it when the user hasn't done anything yet. */
const ECONOMY_RING_COLOR = {
  marketplace: "#0ea5e9",
  help: "#f5a524",
  community: "#34d399",
  business: "#a855f7",
  saved: "#f43f5e"
};

function renderContributeActivityRing(breakdown) {
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return `
      <div class="economy-ring-empty">
        <span class="economy-ring-empty-icon">${icon("spark")}</span>
        <p>${t("contribute.ring.emptyTitle")}</p>
        <p class="economy-ring-empty-hint">${t("contribute.ring.emptyHint")}</p>
      </div>
    `;
  }
  let cumulative = 0;
  const active = breakdown.filter((item) => item.count > 0);
  const stops = active
    .map((item) => {
      const start = (cumulative / total) * 360;
      cumulative += item.count;
      const end = (cumulative / total) * 360;
      return `${ECONOMY_RING_COLOR[item.key]} ${start}deg ${end}deg`;
    })
    .join(", ");
  return `
    <div class="economy-ring-wrap">
      <div class="economy-ring" style="background: conic-gradient(${stops})">
        <div class="economy-ring-center"><strong>${total}</strong><span>${t("contribute.ring.totalLabel")}</span></div>
      </div>
      <div class="economy-ring-legend">
        ${active.map((item) => `<span><i style="background:${ECONOMY_RING_COLOR[item.key]}"></i>${t(item.labelKey)} · ${item.count}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderContributeActivityCard(item) {
  const hasActivity = item.count > 0;
  return `
    <article class="economy-activity-card">
      <span class="tile-icon">${icon(item.icon)}</span>
      <div>
        <h3>${t(item.labelKey)}</h3>
        <p>${hasActivity ? t("contribute.activity.activeDetail", { count: item.count }) : t(item.emptyKey)}</p>
      </div>
      <button type="button" data-view="${hasActivity ? item.activeView : item.emptyView}">${t(hasActivity ? item.activeCtaKey : item.emptyCtaKey)}</button>
    </article>
  `;
}

/** Expands profileCompletenessPercent's own checks (Profile's honest
 * completeness bar) into an itemized list with a direct action per item,
 * instead of duplicating that bar here. Same four real conditions, same
 * source of truth, different presentation. */
function contributeGrowthChecklist(user) {
  return [
    { done: Boolean(user.avatar), labelKey: "contribute.checklist.addPhoto", view: "settings" },
    { done: Boolean(user.role && user.role.trim()), labelKey: "contribute.checklist.addRole", view: "settings" },
    { done: Boolean(user.emailVerified), labelKey: "contribute.checklist.verifyEmail", view: "settings" },
    { done: state.myListings.length > 0 || ownedBusinesses().length > 0, labelKey: "contribute.checklist.firstActivity", view: "createListing" }
  ];
}

function renderContributeChecklist(user) {
  const checks = contributeGrowthChecklist(user);
  if (checks.every((item) => item.done)) return "";
  return `
    <div class="economy-section economy-checklist">
      <div class="economy-section-title"><h2>${t("contribute.checklist.title")}</h2><p>${t("contribute.checklist.hint")}</p></div>
      <div class="economy-checklist-list">
        ${checks
          .map(
            (item) => `
          <div class="economy-checklist-row ${item.done ? "is-done" : ""}">
            <span class="economy-checklist-icon">${item.done ? icon("check") : ""}</span>
            <span>${t(item.labelKey)}</span>
            ${!item.done ? `<button type="button" data-view="${item.view}">${t("contribute.checklist.completeCta")}</button>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

/** An honest entry point to the real opportunities feed (renderLiveOpportunities,
 * already live and reachable elsewhere) — no fabricated per-user match
 * percentage or "because" reasoning, since no real skill/schedule/trust
 * matching engine exists to generate one. */
function renderContributeOpportunities() {
  return `
    <div class="economy-section economy-opportunity-card">
      <div>
        <p class="eyebrow">${t("contribute.opportunities.eyebrow")}</p>
        <h2>${t("contribute.opportunities.title")}</h2>
        <p>${t("contribute.opportunities.hint")}</p>
      </div>
      <button type="button" data-view="liveOpportunities">${t("contribute.opportunities.cta")}</button>
    </div>
  `;
}

/** Reuses deriveRealAchievements() as-is (Profile's exact same real,
 * verifiable-condition-derived list) rather than a second implementation —
 * shown here too because on this page it reads as "what your reputation
 * is built on" rather than "your account record". */
function renderContributeAchievements(user) {
  const achievements = deriveRealAchievements(user);
  if (!achievements.length) return "";
  return `
    <div class="economy-section">
      <div class="economy-section-title"><h2>${t("profile.achievements.achievements")}</h2></div>
      <div class="achievement-grid">
        ${achievements
          .map(
            (item) => `
          <article>
            <span>${icon(item.icon)}</span>
            <h3>${t(item.titleKey)}</h3>
            <p>${t(item.detailKey)}</p>
            ${item.date ? `<span class="achievement-date">${item.date}</span>` : ""}
          </article>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderContributeIdentityCard(user) {
  const isVerified = profileVerificationBadges(user).length > 0;
  const memberSince = profileMemberSince(user);
  return `
    <div class="economy-identity-card">
      <span class="avatar-frame economy-identity-avatar">
        ${user.avatar ? `<img class="profile-portrait" src="${escapeHtml(user.avatar)}" alt="" />` : `<span class="profile-portrait profile-portrait-fallback">${icon("profile")}</span>`}
      </span>
      <div class="economy-identity-copy">
        <h2>${escapeHtml(user.name)}${isVerified ? verifiedCheck(t("status.verified")) : ""}</h2>
        <p>${joinNonEmpty([profilePrimaryRoleLabel(user), memberSince ? t("profile.identity.memberSince", { date: memberSince }) : null])}</p>
      </div>
      <div class="economy-identity-actions">
        <button type="button" data-view="profile">${t("contribute.identity.viewProfileCta")}</button>
        <button type="button" data-action="share-profile">${t("contribute.identity.shareProfileCta")}</button>
      </div>
    </div>
  `;
}

function renderContribute() {
  if (state.auth.status !== "signedIn") {
    return `
      <section class="section-shell contribute-shell economy-shell">
        <div class="city-hero page-hero economy-hero" aria-labelledby="contribute-hero-title">
          <div class="city-hero-copy">
            <p class="eyebrow">${t("contribute.economyEyebrow")}</p>
            <h1 id="contribute-hero-title">${t("contribute.economyTitle")}</h1>
            <p>${t("contribute.economyHeroSubtitle")}</p>
          </div>
        </div>
        <div class="economy-signed-out">
          <p>${t("contribute.signedOutHint")}</p>
          <button type="button" class="auth-primary-button" data-auth-view="login">${t("profile.signedOut.profileSignInCta")}</button>
        </div>
      </section>
    `;
  }

  const user = state.auth.user;
  const breakdown = contributeRealActivityBreakdown(user);

  return `
    <section class="section-shell contribute-shell economy-shell">
      <div class="city-hero page-hero economy-hero" aria-labelledby="contribute-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("contribute.economyEyebrow")}</p>
          <h1 id="contribute-hero-title">${t("contribute.economyTitle")}</h1>
          <p>${t("contribute.economyHeroSubtitle")}</p>
        </div>
        ${renderAiSearch("contribute")}
      </div>
      ${renderAiSearchResults(6, "contribute")}

      ${renderContributeIdentityCard(user)}

      <div class="economy-section economy-ring-section">
        <div class="economy-section-title"><h2>${t("contribute.ring.title")}</h2><p>${t("contribute.ring.hint")}</p></div>
        ${renderContributeActivityRing(breakdown)}
        <div class="economy-activity-grid">
          ${breakdown.map(renderContributeActivityCard).join("")}
        </div>
      </div>

      ${renderContributeChecklist(user)}
      ${renderContributeOpportunities()}
      ${renderContributeAchievements(user)}
    </section>
  `;
}

/** Maps the marketplace's own hyphenated category ids (shared with the
 * seeded mock listings and categoryLabel()'s translation lookup) to the
 * listings table's check-constraint values, which use underscores and a
 * couple of different names ("services" -> "local_services"). */
const LISTING_CATEGORY_TO_DB = {
  "buy-sell": "buy_sell",
  rentals: "rentals",
  jobs: "jobs",
  services: "local_services",
  vehicles: "vehicles",
  property: "property"
};

const LISTING_CATEGORY_OPTIONS = ["buy-sell", "rentals", "jobs", "services", "vehicles", "property"];
const LISTING_PRICE_PERIODS = [
  ["one_time", "createListing.priceOneTime"],
  ["hour", "createListing.pricePerHour"],
  ["day", "createListing.pricePerDay"],
  ["month", "createListing.pricePerMonth"],
  ["quote", "createListing.priceQuote"]
];
const LISTING_CONDITION_OPTIONS = ["new", "likeNew", "good", "fair", "used"];
const LISTING_MAX_PHOTOS = 6;

/** The real "create a listing" form — manual counterpart to Alwen drafting
 * one conversationally (see create_marketplace_listing in
 * supabase/functions/alwen-chat). Inserts directly into the listings table
 * via Supabase from the client, since nothing here needs a secret key. */
function renderCreateListingForm() {
  const draft = state.listingDraft;
  const isLoading = state.listingSubmitStatus === "loading";
  if (state.auth.status !== "signedIn") {
    return `
      <section class="section-shell create-listing-shell">
        <button type="button" class="back-button" data-view="create">${icon("arrow")}${t("common.back")}</button>
        <div class="screen-heading">
          <p class="eyebrow">${t("nav.marketplace")}</p>
          <h1>${t("createListing.createListingTitle")}</h1>
        </div>
        <div class="post-request-signin">
          <p>${t("createListing.signInHint")}</p>
          <button type="button" class="auth-primary-button" data-auth-view="login">${t("needHelp.signInToPost")}</button>
        </div>
      </section>
    `;
  }
  return `
    <section class="section-shell create-listing-shell">
      <button type="button" class="back-button" data-view="create">${icon("arrow")}${t("common.back")}</button>
      <div class="screen-heading">
        <p class="eyebrow">${t("nav.marketplace")}</p>
        <h1>${t("createListing.createListingTitle")}</h1>
        <p>${t("createListing.createListingHint")}</p>
      </div>
      <form class="claim-form create-listing-form" data-role="create-listing-form">
        ${renderTransactionSafetyNotice()}
        <div class="auth-field">
          <label for="listing-offeror-status">Your marketplace status</label>
          <select id="listing-offeror-status" data-role="listing-offeror-status" required>
            <option value="">Select the correct status</option>
            <option value="private" ${(state.offerorStatus?.offeror_status || draft.offerorStatus) === "private" ? "selected" : ""}>Private seller/provider</option>
            <option value="trader" ${(state.offerorStatus?.offeror_status || draft.offerorStatus) === "trader" ? "selected" : ""}>Trader/business</option>
          </select>
          <p class="auth-hint">This account-level classification is recorded with the current Terms version. Private sellers must not present commercial activity as private activity.</p>
        </div>
        <label class="settings-toggle-row"><span>I confirm this classification is accurate for my marketplace activity.</span><input id="listing-offeror-confirmation" type="checkbox" required /></label>
        ${(state.offerorStatus?.offeror_status || draft.offerorStatus) === "trader" && state.traderVerification?.status !== "verified" ? `<div class="auth-error">Trader listings require current verification. <button type="button" class="auth-link" data-view="traderVerification">Open trader verification</button></div>` : ""}
        <div class="auth-field">
          <label for="listing-title">${t("field.title")}</label>
          <input id="listing-title" name="title" value="${escapeHtml(draft.title)}" placeholder="${t("createListing.titlePlaceholder")}" maxlength="120" />
        </div>

        <div class="auth-field">
          <label for="listing-category">${t("field.category")}</label>
          <select id="listing-category" data-role="listing-category">
            ${LISTING_CATEGORY_OPTIONS.map((value) => `<option value="${value}" ${draft.category === value ? "selected" : ""}>${categoryLabel(value)}</option>`).join("")}
          </select>
        </div>

        <div class="auth-field">
          <label for="listing-description">${t("field.description")}</label>
          <textarea id="listing-description" name="description" rows="3" maxlength="1000" placeholder="${t("createListing.descriptionPlaceholder")}">${escapeHtml(draft.description)}</textarea>
        </div>

        <div class="create-listing-price-row">
          <div class="auth-field">
            <label for="listing-price">${t("createListing.priceLabel")}</label>
            <input id="listing-price" name="priceAmount" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(draft.priceAmount)}" placeholder="0" />
          </div>
          <div class="auth-field">
            <label for="listing-price-period">${t("createListing.pricePeriodLabel")}</label>
            <select id="listing-price-period" data-role="listing-price-period">
              ${LISTING_PRICE_PERIODS.map(([value, labelKey]) => `<option value="${value}" ${draft.pricePeriod === value ? "selected" : ""}>${t(labelKey)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="auth-field">
          <label for="listing-neighbourhood">${t("createListing.neighbourhoodLabel")}</label>
          <input id="listing-neighbourhood" name="neighbourhood" value="${escapeHtml(draft.neighbourhood)}" placeholder="${city.name}" />
        </div>

        <div class="auth-field">
          <label for="listing-condition">${t("field.condition")} (${t("createListing.optional")})</label>
          <select id="listing-condition" data-role="listing-condition">
            <option value="" ${draft.condition === "" ? "selected" : ""}>${t("createListing.conditionUnspecified")}</option>
            ${LISTING_CONDITION_OPTIONS.map((value) => `<option value="${value}" ${draft.condition === value ? "selected" : ""}>${t(`marketplace.condition.${value}`)}</option>`).join("")}
          </select>
        </div>

        <label class="settings-toggle-row">
          <span>${t("createListing.pickupAvailableLabel")}</span>
          <input type="checkbox" id="listing-pickup" ${draft.pickupAvailable ? "checked" : ""} />
        </label>
        <label class="settings-toggle-row">
          <span>${t("createListing.deliveryAvailableLabel")}</span>
          <input type="checkbox" id="listing-delivery" ${draft.deliveryAvailable ? "checked" : ""} />
        </label>

        <div class="auth-field">
          <label for="listing-tags">${t("createListing.tagsLabel")}</label>
          <input id="listing-tags" name="tags" value="${escapeHtml(draft.tags)}" placeholder="${t("createListing.tagsPlaceholder")}" maxlength="200" />
        </div>

        <div class="auth-field">
          <label>${t("createListing.photosLabel")}</label>
          ${
            draft.photoFiles.length
              ? `<div class="create-listing-photo-grid">${draft.photoFiles
                  .map(
                    (file, index) => `
                <div class="create-listing-photo-thumb">
                  <img src="${URL.createObjectURL(file)}" alt="" />
                  <button type="button" data-role="remove-listing-photo" data-index="${index}" aria-label="${t("common.remove")}">×</button>
                </div>`
                  )
                  .join("")}</div>`
              : ""
          }
          ${
            draft.photoFiles.length < LISTING_MAX_PHOTOS
              ? `<label class="claim-file-label">
                   <span>${t("createListing.addPhotosCta")}</span>
                   <input type="file" accept="image/*" multiple data-role="listing-photos-input" />
                 </label>`
              : ""
          }
        </div>

        ${state.listingSubmitStatus === "error" ? `<p class="auth-error">${escapeHtml(state.listingSubmitError)}</p>` : ""}

        <button type="submit" class="auth-primary-button" ${isLoading || ((state.offerorStatus?.offeror_status || draft.offerorStatus) === "trader" && state.traderVerification?.status !== "verified") ? "disabled" : ""}>${isLoading ? t("createListing.publishing") : t("createListing.publishButton")}</button>
      </form>
    </section>
  `;
}

function renderAlwenListingCreator() {
  const editableChips = [
    alwenListingDraft.suggestedPrice,
    alwenListingDraft.marketplaceCategory,
    alwenListingDraft.condition,
    alwenListingDraft.pickupArea,
    alwenListingDraft.deliveryOptions[0],
    alwenListingDraft.recommendedBoost
  ];

  return `
    <section class="alwen-card alwen-listing-studio">
      <div class="section-title">
        <div><h2>${t("alwen.alwenListingTitle")}</h2><p>${t("alwen.alwenListingHint")}</p></div>
      </div>
      <div class="alwen-create-layout">
        <div class="alwen-create-copy">
          <div class="alwen-prompt">${icon("spark")}<p>${alwenListingDraft.prompt}</p></div>
          <h3>${alwenListingDraft.title}</h3>
          <p>${alwenListingDraft.description}</p>
          <div class="editable-chip-row">
            ${editableChips.map((chip) => `<button>${chip}</button>`).join("")}
          </div>
          <div class="draft-list"><strong>${t("common.keywords")}</strong><p>${alwenListingDraft.keywords.join(" · ")}</p></div>
          <div class="draft-actions"><button>${t("common.publish")}</button><button>${t("common.improve")}</button><button>${t("common.addPhotos")}</button></div>
        </div>
        <article class="market-card visual-market-card alwen-preview-card">
          <div class="market-photo" style="background-image: url('https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=1000&q=80')">
            <button class="favourite-float" aria-label="${t("common.favourite")}">${icon("heart")}</button>
          </div>
          <div class="market-card-body">
            <span class="ai-verified inline-ai-verified">${icon("spark")}${t("common.createdByAlwen")}</span>
            <div class="seller-row">
              <img src="${reputationProfile.portrait}" alt="" />
              <div><strong>${reputationProfile.name}${verifiedCheck(t("common.verifiedSeller"))}</strong><span>${alwenListingDraft.pickupArea} · ${t("common.verifiedSeller")}</span></div>
            </div>
            <h3>${alwenListingDraft.title}</h3>
            <div class="price-row"><strong>${alwenListingDraft.suggestedPrice}</strong><span>${t("common.goodPrice")}</span></div>
            <p>${alwenListingDraft.summary}</p>
            <div class="ai-price-pill">${icon("spark")}<span>${alwenListingDraft.searchOptimisation}</span></div>
          </div>
        </article>
      </div>
    </section>
  `;
}

/** One fixed size within any grid or rail — MarketplaceCard used to vary
 * card height per item.cardSize ("tall"/"wide"/"compact", a Pinterest-
 * style masonry effect via CSS column-count), which is exactly the
 * "random heights in the same carousel" the shared card system rules
 * out. item.cardSize itself is left on the mock data (harmless, unused)
 * rather than stripped from every record for no functional gain. */
function renderMarketplaceListing(item) {
  const isSaved = state.savedListingIds.includes(String(item.id));
  const personAttrs = publicProfileAttrs({ id: item.sellerId, name: item.seller, avatar: item.sellerAvatar, area: item.area, verified: item.verifiedSeller, context: "marketplace" });
  return `
    <article class="market-card visual-market-card" data-view="listingDetail" data-listing-id="${item.id}" role="button" tabindex="0">
      <div class="market-photo" style="background-image: url('${item.image}')">
        <button type="button" class="favourite-float ${isSaved ? "is-active" : ""}" data-action="toggle-listing-save" data-listing-id="${item.id}" aria-label="${t("common.favourite")}">${icon("heart")}</button>
      </div>
      <div class="market-card-body">
        <div class="seller-row" role="button" tabindex="0" ${personAttrs}>
          <img src="${item.sellerAvatar}" alt="" />
          <div><strong>${item.seller}${item.verifiedSeller ? verifiedCheck(t("common.verifiedSeller")) : ""}</strong><span>${joinNonEmpty([item.distance, item.area, item.commute, item.verifiedSeller ? t("common.verifiedSeller") : null])}</span></div>
        </div>
        <span class="badge offeror-status-badge">${item.offerorStatus === "trader" ? "Trader/business" : "Private seller/provider"}</span>
        <span class="badge">${categoryLabel(item.type)}</span>
        ${item.workMode ? `<span class="badge badge-workmode">${item.workMode}</span>` : ""}
        <h3>${listingTitle(item)}</h3>
        <div class="price-row"><strong>${item.price}</strong></div>
        <p>${listingMeta(item)}</p>
        ${item.aiPrice || item.aiMatch ? `<div class="ai-price-pill">${icon("spark")}<span>${joinNonEmpty([item.aiMatch, item.aiPrice])}</span></div>` : ""}
        ${item.popularity || item.aiInsight ? `<div class="trust-row visual-trust">${item.popularity ? `<span>${item.popularity}</span>` : ""}${item.aiInsight ? `<span>${item.aiInsight}</span>` : ""}</div>` : ""}
        <div class="market-actions"><button type="button" ${personAttrs}>${item.type === "jobs" ? t("common.apply") : t("common.contactSeller")}</button></div>
      </div>
    </article>
  `;
}

/** Full listing detail — the card above only ever showed a teaser (photo,
 * truncated title, price) with no way to see the rest. Reuses the same
 * gallery-rail / detail-strip / actions-row markup pattern as
 * renderBusinessProfile above so it reads as the same "detail screen"
 * family rather than a one-off layout. Deep-linkable via WP0's routing
 * (?view=listingDetail&id=<id>), survives refresh/back per that same
 * mechanism. */
function renderListingDetail() {
  const item = listings.find((listing) => String(listing.id) === String(state.selectedListingId));
  if (!item) {
    return `
      <section class="section-shell listing-detail-shell">
        <button type="button" class="back-button" data-view="marketplace">${icon("arrow")}${t("common.back")}</button>
        ${renderEmptyState(t("common.noResults"), "search")}
      </section>
    `;
  }

  const gallery = item.gallery && item.gallery.length ? item.gallery : [item.image];
  const isSaved = state.savedListingIds.includes(String(item.id));
  const sellerAttrs = publicProfileAttrs({ id: item.sellerId, name: item.seller, avatar: item.sellerAvatar, area: item.area, verified: item.verifiedSeller, context: "marketplace" });
  const hasFulfilment = item.pickupAvailable || item.deliveryAvailable;
  const traderDisclosure = item.offerorStatus === "trader" ? state.traderPublicProfiles[item.sellerId] : null;
  if (item.offerorStatus === "trader" && state.traderPublicProfiles[item.sellerId] === undefined) queueMicrotask(() => loadTraderDisclosure(item.sellerId));

  return `
    <section class="section-shell listing-detail-shell">
      <button type="button" class="back-button" data-view="marketplace">${icon("arrow")}${t("common.back")}</button>

      ${
        gallery.filter(Boolean).length
          ? `<div class="business-gallery-rail listing-gallery-rail">${gallery
              .filter(Boolean)
              .map((photo) => `<div class="business-gallery-photo" style="background-image: url('${photo}')"></div>`)
              .join("")}</div>`
          : `<p class="settings-section-hint">${t("marketplace.listingDetail.galleryEmpty")}</p>`
      }

      <div class="screen-heading">
        <span class="badge category-chip">${categoryLabel(item.type)}</span>
        <span class="badge offeror-status-badge">${item.offerorStatus === "trader" ? "Trader/business" : "Private seller/provider"}</span>
        <h1>${listingTitle(item)}</h1>
        <p class="price-row"><strong>${item.price}</strong></p>
      </div>

      <div class="business-detail-strip">
        <p class="business-detail-line">${pinIcon()}${joinNonEmpty([escapeHtml(item.area), escapeHtml(item.distance)])}</p>
        ${item.condition ? `<p class="business-detail-line">${t("field.condition")}: ${t(`marketplace.condition.${item.condition}`)}</p>` : ""}
      </div>

      <div class="section-title"><h2>${t("marketplace.listingDetail.aboutListing")}</h2></div>
      <p>${item.description || (item.descriptionKey ? t(item.descriptionKey) : listingMeta(item))}</p>
      ${item.offerorStatus === "trader" ? traderDisclosure ? `<div class="settings-section"><h2>Verified trader disclosure</h2><p><strong>${escapeHtml(traderDisclosure.legal_or_trading_name)}</strong> · ${escapeHtml(traderDisclosure.country)}</p><p>${escapeHtml(traderDisclosure.business_location)} · ${escapeHtml(traderDisclosure.public_email)} · ${escapeHtml(traderDisclosure.public_phone)}</p><p>${escapeHtml(traderDisclosure.trade_register_name || "Trade register not applicable")} ${escapeHtml(traderDisclosure.registration_number || "")}</p><p>${escapeHtml(traderDisclosure.vat_display || "VAT status not provided")}</p></div>` : `<p class="settings-section-hint">Loading verified trader disclosure…</p>` : `<p class="settings-section-hint">This offer is from a private individual. EU consumer rights that apply to trader-to-consumer contracts may not apply.</p>`}

      ${
        hasFulfilment
          ? `<div class="section-title"><h2>${t("marketplace.listingDetail.fulfilment")}</h2></div>
             <div class="business-detail-strip">
               <p class="business-detail-line">${t("field.pickup")}: ${item.pickupAvailable ? t("marketplace.listingDetail.pickupAvailable") : t("marketplace.listingDetail.notOffered")}</p>
               <p class="business-detail-line">${t("field.deliveryOptions")}: ${item.deliveryAvailable ? t("marketplace.listingDetail.deliveryAvailable") : t("marketplace.listingDetail.notOffered")}</p>
             </div>`
          : ""
      }

      <div class="section-title"><h2>${t("common.contactSeller")}</h2></div>
      ${renderTransactionSafetyNotice()}
      <div class="seller-row" role="button" tabindex="0" ${sellerAttrs}>
        <img src="${item.sellerAvatar}" alt="" />
        <div>
          <strong>${escapeHtml(item.seller)}${item.verifiedSeller ? verifiedCheck(t("common.verifiedSeller")) : ""}</strong>
          <span>${joinNonEmpty([
            item.sellerResponseTime ? `${t("common.responseTime")}: ${t(`marketplace.responseTime.${item.sellerResponseTime}`)}` : null,
            item.sellerReputation != null ? `${t("profile.reputation.overallReputation")} ${item.sellerReputation}` : null
          ])}</span>
        </div>
      </div>
      <button type="button" class="settings-row-button" ${sellerAttrs}>${t("common.viewProfile")}</button>

      <div class="business-profile-actions listing-detail-actions">
        <button type="button" data-view="messages">${t("common.message")}</button>
        ${
          item.sellerPhone
            ? `<a class="directions-btn" href="tel:${item.sellerPhone}" title="${t("marketplace.listingDetail.callOpensPhone")}">${t("common.call")}</a>`
            : `<button type="button" disabled>${t("common.call")}</button>`
        }
        <button type="button" class="${isSaved ? "is-active" : ""}" data-action="toggle-listing-save" data-listing-id="${item.id}">${t("common.favourite")}</button>
        <button type="button" data-action="share-listing" data-listing-id="${item.id}">${t("common.share")}</button>
        <button type="button" data-report-target="listing" data-report-id="${item.id}">Report listing</button>
      </div>
    </section>
  `;
}

function renderProfessional(item) {
  const personAttrs = publicProfileAttrs({ id: `pro-${item.id}`, name: item.name, area: item.area, category: t(item.categoryKey), rating: item.rating, reviews: item.reviews, verified: item.verified, context: "hire", skills: item.skills, responseTime: item.responseTime, price: item.price, availability: item.availability, distance: item.distance });
  return `
    <article class="pro-card">
      <div class="pro-card-identity" role="button" tabindex="0" ${personAttrs}>
        <div class="business-logo pro-card-avatar">${initials(item.name)}</div>
        <div>
          <h3>${item.name}${item.verified ? verifiedCheck(t("status.verified")) : ""}</h3>
          <p>${t(item.categoryKey)} · ${item.area}</p>
          <div class="pro-card-stats">
            <span class="pro-stat-rating">${icon("star")} ${item.rating} <small>(${item.reviews})</small></span>
            <span class="pro-stat-price">${item.price}</span>
            <span class="pro-stat-availability">${item.availability}</span>
          </div>
        </div>
      </div>
      <button data-view="needHelp">${t("nav.book")}</button>
      <button ${personAttrs}>${t("common.contact")}</button>
    </article>
  `;
}

function renderHire() {
  const pros = filteredProfessionals();
  return `
    <section class="section-shell hire-shell">
      ${renderTransactionSafetyNotice()}
      <section class="city-hero page-hero hire-hero-photo" aria-labelledby="hire-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("hire.hireEyebrow")} · ${currentAreaLabel()}</p>
          <h1 id="hire-hero-title">${t("hire.hireTitle")}</h1>
          <p>${t("hire.hireHint")}</p>
        </div>
        ${renderAiSearch("hire")}
      </section>
      ${renderAiSearchResults(6, "hire")}
      <button class="need-help-wide" data-view="needHelp">${icon("help")}<span class="need-help-wide-text"><strong>${t("needHelp.needHelpTitle")}</strong><small>${t("needHelp.needHelpHint")}</small></span></button>
      ${renderPostRequestForm()}
      <div class="category-cloud">
        ${professionalCategories.map(({ value, labelKey }) => `<button type="button" class="${state.hireCategory === value ? "is-selected" : ""}" data-hire-category="${escapeHtml(value)}">${t(labelKey)}</button>`).join("")}
      </div>
      <div class="pro-list">
        ${pros.map(renderProfessional).join("") || renderEmptyState(t("common.noResults"), "people")}
      </div>
    </section>
  `;
}

function renderNeedHelp() {
  const pros = filteredProfessionals();
  const requests = filteredHelpRequests();

  return `
    <section class="section-shell help-shell">
      ${renderTransactionSafetyNotice()}
      <div class="screen-heading">
        <p class="eyebrow">${t("common.activeMarketplace")}</p>
        <h1>${t("needHelp.needHelpTitle")}</h1>
      </div>
      ${renderPostRequestForm()}
      <div class="connection-flow">
        <article><strong>1</strong><span>${t("common.describeNeed")}</span></article>
        <article><strong>2</strong><span>${t("common.prosRespond")}</span></article>
        <article><strong>3</strong><span>${t("common.bookPay")}</span></article>
      </div>
      <div class="section-title">
        <div><h2>${t("common.matchingPros")}</h2><p>${t("common.matchingProsHint")}</p></div>
      </div>
      <div class="pro-list">
        ${pros.map(renderProfessional).join("") || renderEmptyState(t("common.noResults"), "people")}
      </div>
      <div class="section-title">
        <div><h2>${t("common.liveRequests")}</h2><p>${t("common.liveRequestsHint")}</p></div>
      </div>
      <div class="request-list">
        ${requests.map(renderHelpRequest).join("")}
      </div>
    </section>
  `;
}

const LIVE_OPPORTUNITIES = [
  { id: "airport-pickup", title: "Airport pickup", category: "Transport", price: 25, priceLabel: "€25", distance: 2, time: "Starts in 30 min", requester: "Verified traveller", trust: 4.9, urgent: true, today: true, description: "Pick up one traveller at Vilnius Airport and drive them to the Old Town.", tags: ["Car required", "1 passenger"], action: "Accept", image: "https://images.unsplash.com/photo-1515569067071-ec3b51335dd0?auto=format&fit=crop&w=1200&q=82" },
  { id: "babysitter", title: "Need babysitter", category: "Childcare", price: 40, priceLabel: "€40/hr", distance: 1.4, time: "Tonight · 19:00", requester: "Verified family", trust: 4.8, urgent: true, today: true, description: "Help with two children for three hours while their parents attend an event.", tags: ["Experience required", "3 hours"], action: "Apply", image: "https://images.unsplash.com/photo-1602030028438-4cf153cbae9e?auto=format&fit=crop&w=1200&q=82" },
  { id: "deliver-package", title: "Deliver package", category: "Delivery", price: 15, priceLabel: "€15", distance: 0.9, time: "45 min", requester: "Verified neighbour", trust: 4.7, urgent: true, today: true, description: "Pick up a prepaid parcel near Old Town and deliver it along your route.", tags: ["On your route", "Light parcel"], action: "Accept", image: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&q=82" },
  { id: "help-move-sofa", title: "Help move sofa", category: "Moving", price: 35, priceLabel: "€35", distance: 2.4, time: "Today · 17:30", requester: "Verified resident", trust: 4.8, urgent: true, today: true, description: "Two people needed to move a sofa from a flat into a van in Žvėrynas.", tags: ["2 people needed", "Heavy lifting"], action: "Accept", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=82" },
  { id: "translate-document", title: "Translate document", category: "Translation", price: 22, priceLabel: "€22", distance: 0, time: "30 min", requester: "Verified resident", trust: 4.9, urgent: false, today: true, description: "Translate a short English-Lithuanian document and explain the key points in simple language.", tags: ["Remote", "Matches languages"], action: "Apply", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=82" },
  { id: "teach-english", title: "Teach English", category: "Tutoring", price: 30, priceLabel: "€30/hr", distance: 2.7, time: "Tomorrow", requester: "Verified learner", trust: 4.8, urgent: false, today: false, description: "One-hour conversational English lesson for a beginner near Užupis.", tags: ["Profile match", "Beginner"], action: "Apply", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=82" },
  { id: "furniture", title: "Assemble furniture", category: "Home services", price: 40, priceLabel: "€40", distance: 3.1, time: "Tonight", requester: "Verified homeowner", trust: 5.0, urgent: false, today: true, description: "Assemble a flat-pack chair and small shelving unit in Šnipiškės. Tools preferred.", tags: ["Tools required", "Indoor"], action: "View details", image: "https://images.unsplash.com/photo-1581539250439-c96689b516dd?auto=format&fit=crop&w=1200&q=82" },
  { id: "dog-walk", title: "Evening dog walk", category: "Pet care", price: 18, priceLabel: "€18", distance: 0.8, time: "Today · 18:30", requester: "Verified neighbour", trust: 4.7, urgent: false, today: true, description: "Take a friendly golden retriever for a 45-minute walk around Bernardine Garden.", tags: ["Pet friendly", "45 min"], action: "Accept", image: "https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1200&q=82" },
  { id: "photo-event", title: "Event photographer", category: "Creative", price: 120, priceLabel: "€120", distance: 4.2, time: "Saturday · 16:00", requester: "Verified organiser", trust: 4.9, urgent: false, today: false, description: "Photograph a small community event and deliver a curated digital gallery.", tags: ["Portfolio", "2 hours"], action: "Apply", image: "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=1200&q=82" },
  { id: "grocery-delivery", title: "Grocery delivery", category: "Delivery", price: 22, priceLabel: "€22", distance: 1.1, time: "Within 1 hour", requester: "Verified resident", trust: 4.6, urgent: true, today: true, description: "Collect a prepaid grocery order and deliver it to a nearby apartment.", tags: ["Quick task", "No stairs"], action: "Accept", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=82" },
  { id: "language-help", title: "Lithuanian conversation practice", category: "Tutoring", price: 30, priceLabel: "€30/hr", distance: 2.7, time: "Tomorrow · 17:00", requester: "Verified learner", trust: 4.8, urgent: false, today: false, description: "Friendly conversation practice for an English speaker learning Lithuanian.", tags: ["Lithuanian", "Beginner"], action: "View details", image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=82" },
  { id: "moving-boxes", title: "Help moving boxes", category: "Moving", price: 75, priceLabel: "€75", distance: 3.6, time: "Today · 15:00", requester: "Verified homeowner", trust: 4.9, urgent: true, today: true, description: "Move packed boxes from a second-floor flat into a waiting van.", tags: ["Physical task", "2 hours"], action: "Accept", image: "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=1200&q=82" }
];

const HOME_LIVE_OPPORTUNITY_IDS = ["airport-pickup", "babysitter", "photo-event", "language-help"];
const HOME_EARN_OPPORTUNITY_IDS = ["deliver-package", "help-move-sofa", "translate-document", "dog-walk", "teach-english", "furniture"];

function opportunityForHomeLiveItem(item) {
  const index = liveAroundYou.indexOf(item);
  return LIVE_OPPORTUNITIES.find((opportunity) => opportunity.id === HOME_LIVE_OPPORTUNITY_IDS[index]) || LIVE_OPPORTUNITIES[0];
}

function opportunityForHomeEarnItem(item) {
  const index = earnToday.indexOf(item);
  return LIVE_OPPORTUNITIES.find((opportunity) => opportunity.id === HOME_EARN_OPPORTUNITY_IDS[index]) || LIVE_OPPORTUNITIES[0];
}

function findOpportunityById(id) {
  return LIVE_OPPORTUNITIES.find((item) => String(item.id) === String(id)) || null;
}

function liveOpportunityHref(id) {
  return `?view=liveOpportunityDetail&id=${encodeURIComponent(id)}`;
}

function openLiveOpportunityDetail(id) {
  const item = findOpportunityById(id) || LIVE_OPPORTUNITIES[0];
  state.selectedOpportunityId = item.id;
  state.activeView = "liveOpportunityDetail";
  state.activeSheet = null;
  state.alwenOpen = false;
  state.quickTranslateOpen = false;
  render();
}

function filteredLiveOpportunities() {
  let items = LIVE_OPPORTUNITIES.filter((item) => {
    const categoryMatch = state.opportunityCategory === "all" || item.category === state.opportunityCategory;
    const distanceMatch = state.opportunityDistance === "all" || item.distance <= Number(state.opportunityDistance);
    const filterMatch = state.opportunityFilter === "nearby" || (state.opportunityFilter === "today" && item.today) || (state.opportunityFilter === "urgent" && item.urgent) || state.opportunityFilter === "verified" || state.opportunityFilter === "highest";
    return categoryMatch && distanceMatch && filterMatch;
  });
  if (state.opportunityFilter === "highest") items = [...items].sort((a, b) => b.price - a.price);
  else items = [...items].sort((a, b) => a.distance - b.distance);
  return items;
}

function opportunityText(item, field, fallback = item[field]) {
  const key = `opportunities.items.${item.id}.${field}`;
  const value = t(key);
  return value === key ? fallback : value;
}

function opportunityTags(item) {
  return item.tags.map((tag, index) => opportunityText(item, `tag${index + 1}`, tag));
}

function renderOpportunityCard(item) {
  const title = opportunityText(item, "title");
  const category = opportunityText(item, "category");
  const time = opportunityText(item, "time");
  const requester = opportunityText(item, "requester");
  const description = opportunityText(item, "description");
  const action = opportunityText(item, "action");
  return `<article class="opportunity-card" role="button" tabindex="0" aria-label="${escapeHtml(`${title} ${item.priceLabel}`)}" data-view="liveOpportunityDetail" data-opportunity-id="${item.id}">
    <div class="opportunity-cover" style="background-image:url('${item.image}')"><span>${category}</span>${item.urgent ? `<strong>${t("common.urgentLabel")}</strong>` : ""}</div>
    <div class="opportunity-body"><div class="opportunity-price-row"><h2>${title}</h2><b>${item.priceLabel}</b></div>
    <p class="opportunity-meta">${t("common.opportunityDistanceMeta", { distance: item.distance, time })}</p>
    <p>${description}</p><div class="opportunity-trust"><span>✓ ${requester}</span><span>★ ${t("common.trustScore", { score: item.trust })}</span></div>
    <div class="opportunity-tags">${opportunityTags(item).map((tag) => `<span>${tag}</span>`).join("")}</div>
    <div class="opportunity-actions"><button type="button" class="opportunity-primary" data-view="messages">${action}</button><a href="${liveOpportunityHref(item.id)}" data-view="liveOpportunityDetail" data-opportunity-id="${item.id}">${t("common.viewDetails")}</a></div></div>
  </article>`;
}

function renderLiveOpportunityDetail() {
  const item = findOpportunityById(state.selectedOpportunityId) || LIVE_OPPORTUNITIES[0];
  state.selectedOpportunityId = item.id;
  const title = opportunityText(item, "title");
  const category = opportunityText(item, "category");
  const time = opportunityText(item, "time");
  const requester = opportunityText(item, "requester");
  const description = opportunityText(item, "description");
  const action = opportunityText(item, "action");
  const related = LIVE_OPPORTUNITIES
    .filter((candidate) => candidate.id !== item.id && (candidate.category === item.category || candidate.today === item.today))
    .slice(0, 3);
  return `<section class="section-shell opportunity-detail-shell">
    ${renderTransactionSafetyNotice()}
    <button type="button" class="back-button" data-view="liveOpportunities">${icon("arrow")}${t("common.back")} · ${t("common.liveRequests")}</button>
    <article class="opportunity-detail-card">
      <div class="opportunity-detail-hero" style="background-image:url('${item.image}')">
        <div class="opportunity-detail-badges">
          <span>${category}</span>
          ${item.urgent ? `<strong>${t("common.urgentLabel")}</strong>` : ""}
          ${item.today ? `<span>${t("common.today")}</span>` : ""}
        </div>
      </div>
      <div class="opportunity-detail-body">
        <div class="opportunity-detail-title">
          <div>
            <p class="eyebrow">${t("common.opportunityEyebrow", { area: currentAreaLabel() })}</p>
            <h1>${title}</h1>
            <p>${t("common.opportunityDistanceMeta", { distance: item.distance, time })}</p>
          </div>
          <strong>${item.priceLabel}</strong>
        </div>
        <div class="opportunity-detail-grid">
          <article><span>${t("common.postedBy")}</span><strong>${requester}</strong></article>
          <article><span>${t("common.trust")}</span><strong>★ ${item.trust}</strong></article>
          <article><span>${t("common.response")}</span><strong>${item.urgent ? t("common.fastMatch") : t("common.openRequest")}</strong></article>
        </div>
        <div class="opportunity-detail-section">
          <h2>${t("common.whatTheyNeed")}</h2>
          <p>${description}</p>
        </div>
        <div class="opportunity-tags">${opportunityTags(item).map((tag) => `<span>${tag}</span>`).join("")}</div>
        <div class="opportunity-detail-actions">
          <button type="button" class="opportunity-primary" data-view="messages">${action}</button>
          <button type="button" data-view="messages">${t("common.message")}</button>
          <button type="button" data-view="needHelp">${t("needHelp.needHelpCta")}</button>
        </div>
      </div>
    </article>
    ${related.length ? `<section class="opportunity-related">
      <div class="section-title"><div><h2>${t("common.similarNearby")}</h2><p>${t("common.liveRequestsHint")}</p></div></div>
      <div class="opportunity-feed">${related.map(renderOpportunityCard).join("")}</div>
    </section>` : ""}
  </section>`;
}

function renderLiveOpportunities() {
  const items = filteredLiveOpportunities();
  const categories = [...new Set(LIVE_OPPORTUNITIES.map((item) => item.category))];
  const earnings = LIVE_OPPORTUNITIES.filter((item) => item.today).reduce((sum, item) => sum + item.price, 0);
  return `<section class="section-shell opportunities-shell">
    ${renderTransactionSafetyNotice()}
    <header class="opportunities-hero"><p class="eyebrow">Alwenda marketplace · ${currentAreaLabel()}</p><h1>${t("common.liveOpportunitiesTitle")}</h1><p>${t("common.liveOpportunitiesSubtitle")}</p>
      <div class="opportunity-stats"><article><strong>${LIVE_OPPORTUNITIES.length}</strong><span>${t("common.activeOpportunitiesNearby")}</span></article><article><strong>€${earnings}</strong><span>${t("common.estimatedEarningsToday")}</span></article></div>
    </header>
    <div class="opportunity-toolbar" aria-label="Opportunity filters"><div class="chip-row explore-category-row opportunity-filter-row">
      ${[["nearby",t("common.nearby")],["today",t("common.today")],["highest",t("common.highestPaying")],["urgent",t("common.urgentLabel")],["verified",t("common.verified")]].map(([value,label]) => `<button type="button" class="${state.opportunityFilter === value ? "is-active" : ""}" data-opportunity-filter="${value}">${label}</button>`).join("")}
      <label>${t("common.category")}<select data-opportunity-category><option value="all">${t("common.allCategoriesLabel")}</option>${categories.map((category) => {
        const match = LIVE_OPPORTUNITIES.find((item) => item.category === category);
        const label = match ? opportunityText(match, "category", category) : category;
        return `<option value="${category}" ${state.opportunityCategory === category ? "selected" : ""}>${label}</option>`;
      }).join("")}</select></label>
      <label>${t("common.distance")}<select data-opportunity-distance><option value="all">${t("common.anyDistance")}</option>${[1,2,5].map((distance) => `<option value="${distance}" ${state.opportunityDistance === String(distance) ? "selected" : ""}>${t("common.withinDistance", { distance })}</option>`).join("")}</select></label>
    </div></div>
    <div class="opportunity-feed-heading"><div><h2>${t("common.whatCanYouEarnToday")}</h2><p>${t("common.freshVerifiedRequests")}</p></div><span>${t("common.matches", { count: items.length })}</span></div>
    <div class="opportunity-feed">${items.map(renderOpportunityCard).join("") || renderEmptyState(t("common.noOpportunitiesMatch"))}</div>
    <section class="opportunity-post-cta"><p class="eyebrow">${t("common.needHelpInstead")}</p><h2>${t("common.postYourOwnRequest")}</h2><p>${t("common.postYourOwnRequestHint")}</p><button type="button" data-view="needHelp">${t("common.createRequest")}</button></section>
  </section>`;
}

const QUICK_HELP_CATEGORIES = professionalCategories.filter((category) =>
  ["plumber", "electrician", "cleaner", "carpenter", "moving help", "tutor"].includes(category.value)
);

const HELP_URGENCY_OPTIONS = [
  ["today", "needHelp.urgencyToday"],
  ["thisWeek", "needHelp.urgencyThisWeek"],
  ["flexible", "needHelp.urgencyFlexible"]
];

function renderPostRequestForm() {
  if (state.auth.status !== "signedIn") {
    return `
      <section class="post-request-card">
        <div class="section-title">
          <div><h2>${t("alwen.alwenServiceTitle")}</h2><p>${t("alwen.alwenServiceHint")}</p></div>
        </div>
        <div class="post-request-signin">
          <p>${t("needHelp.signInToPostHint")}</p>
          <button type="button" class="auth-primary-button" data-auth-view="login">${t("needHelp.signInToPost")}</button>
        </div>
      </section>
    `;
  }

  if (state.helpRequestPosted) {
    const posted = state.helpRequestPosted;
    return `
      <section class="post-request-card">
        <div class="post-request-success">
          <span class="post-request-success-icon">${icon("verify")}</span>
          <h2>${t("needHelp.postedTitle")}</h2>
          <p>${t("needHelp.postedHint")}</p>
          <blockquote>${escapeHtml(posted.title)}</blockquote>
          <button type="button" class="auth-primary-button" data-role="post-another-request">${t("needHelp.postAnother")}</button>
        </div>
      </section>
    `;
  }

  const draft = state.helpRequestDraft;
  return `
    <section class="post-request-card">
      <div class="section-title">
        <div><h2>${t("alwen.alwenServiceTitle")}</h2><p>${t("alwen.alwenServiceHint")}</p></div>
      </div>
      <textarea id="help-request-text" class="post-request-input" rows="3" placeholder="${t("needHelp.needHelpPlaceholder")}">${escapeHtml(draft.text)}</textarea>
      ${state.helpRequestError ? `<p class="auth-error">${escapeHtml(state.helpRequestError)}</p>` : ""}
      <div class="post-request-refine">
        <p class="post-request-refine-label">${t("needHelp.categoryPrompt")}</p>
        <div class="chip-row">
          ${QUICK_HELP_CATEGORIES.map(({ value, labelKey }) => `<button type="button" class="chip ${state.hireCategory === value ? "is-active" : ""}" data-hire-category="${escapeHtml(value)}">${t(labelKey)}</button>`).join("")}
        </div>
        ${state.hireCategory ? renderInlineProSuggestions(state.hireCategory) : ""}
      </div>
      <div class="post-request-refine">
        <p class="post-request-refine-label">${t("needHelp.urgencyPrompt")}</p>
        <div class="chip-row">
          ${HELP_URGENCY_OPTIONS.map(([value, labelKey]) => `<button type="button" class="chip ${draft.urgency === value ? "is-active" : ""}" data-help-urgency="${value}">${t(labelKey)}</button>`).join("")}
        </div>
      </div>
      <button type="button" class="auth-primary-button post-request-submit" data-role="submit-help-request" ${state.helpRequestSubmitStatus === "loading" ? "disabled" : ""}>${state.helpRequestSubmitStatus === "loading" ? t("needHelp.needHelpPosting") : t("needHelp.needHelpCta")}</button>
    </section>
  `;
}

/* Live preview of matching professionals right where the category chip
   was clicked — previously the only feedback for picking "Plumber" was
   the chip itself changing state; the actual matches only showed up in
   a "Matching pros" list much further down the page, so most users
   never realized the filter had already worked. */
function renderInlineProSuggestions(category) {
  const categoryLabelKey = professionalCategories.find((item) => item.value === category)?.labelKey;
  const categoryName = categoryLabelKey ? t(categoryLabelKey) : category;
  const matches = serviceProfessionals.filter((item) => hireCategoryMatches(item, category));

  if (!matches.length) {
    return `<p class="inline-pro-suggestions-empty">${t("needHelp.instantMatchesNone").replace("{category}", categoryName)}</p>`;
  }

  const top = matches.slice(0, 3);
  return `
    <div class="inline-pro-suggestions">
      <p class="inline-pro-suggestions-label">${t("needHelp.instantMatchesFound").replace("{count}", matches.length).replace("{category}", categoryName)}</p>
      <div class="inline-pro-suggestions-list">
        ${top.map((item) => {
          const personAttrs = publicProfileAttrs({ id: `pro-${item.id}`, name: item.name, area: item.area, category: t(item.categoryKey), rating: item.rating, reviews: item.reviews, verified: item.verified, context: "hire", skills: item.skills, responseTime: item.responseTime, price: item.price, availability: item.availability, distance: item.distance });
          return `
            <button type="button" class="inline-pro-chip" ${personAttrs}>
              <span class="inline-pro-avatar">${initials(item.name)}</span>
              <span class="inline-pro-chip-body">
                <strong>${item.name}${item.verified ? verifiedCheck(t("status.verified")) : ""}</strong>
                <small>${icon("star")} ${item.rating} · ${item.availability}</small>
              </span>
            </button>
          `;
        }).join("")}
      </div>
      ${matches.length > top.length ? `<button type="button" class="inline-pro-suggestions-more" data-view="hire">${t("needHelp.instantMatchesSeeAll")} (${matches.length})</button>` : ""}
    </div>
  `;
}

/** Shared shape for a real help_requests row (whichever path created it —
 * see applyCreatedHelpRequest below) so Hire/Need Help renders it the same
 * way regardless of source. */
function shapeHelpRequestForDisplay(created) {
  const matchedCategory = professionalCategories.find((item) => item.value.toLowerCase() === String(created.category || "").toLowerCase());
  const matchedUrgency = HELP_URGENCY_OPTIONS.find(([value]) => value === created.urgency);
  return {
    id: created.id,
    title: created.description,
    area: created.area || created.city || city.name || "Vilnius",
    budget: null,
    urgency: t(matchedUrgency?.[1] || "needHelp.urgencyFlexible"),
    status: t(`status.${created.status}`) || t("status.open"),
    quotes: [],
    category: matchedCategory ? t(matchedCategory.labelKey) : created.category
  };
}

/** Called after a real insert — either the manual Need Help form
 * (submitHelpRequest) or Alwen's own request creation (the
 * create_hire_request tool in supabase/functions/alwen-chat) — so a
 * request either path creates shows up in Hire/Need Help identically,
 * not as a second, differently-shaped kind of card. */
function applyCreatedHelpRequest(created, { source = "manual" } = {}) {
  const request = shapeHelpRequestForDisplay(created);
  helpRequests.unshift(request);
  state.myHelpRequests.unshift(created);
  trackEvent("help_request_posted", { hasCategory: Boolean(created.category), urgency: created.urgency, source });
  return request;
}

/** Fire-and-forget, called both right after sign-in and every time the user
 * opens Profile or Hire — mirrors refreshMyListings() so a transient network
 * hiccup doesn't leave "My Requests" empty for the rest of the session. */
async function refreshMyHelpRequests() {
  try {
    state.myHelpRequests = await fetchMyHelpRequests();
    for (const item of state.myHelpRequests) {
      if (!helpRequests.some((existing) => String(existing.id) === String(item.id))) {
        helpRequests.unshift(shapeHelpRequestForDisplay(item));
      }
    }
    render();
  } catch (error) {
    console.warn("[helpRequests] Failed to load my help requests.", error);
  }
}

async function submitHelpRequest() {
  const draft = state.helpRequestDraft;
  const text = draft.text.trim();
  if (text.length < 8) {
    state.helpRequestError = t("needHelp.requestTooShort");
    render();
    return;
  }
  if (state.auth.status !== "signedIn") {
    state.helpRequestError = t("needHelp.signInToPost");
    render();
    return;
  }

  state.helpRequestSubmitStatus = "loading";
  state.helpRequestError = null;
  render();

  try {
    const created = await createHelpRequest({
      category: state.hireCategory || "general",
      description: text,
      urgency: draft.urgency,
      area: state.area === "All" ? null : state.area,
      city: city.name
    });
    const request = applyCreatedHelpRequest(created);
    state.helpRequestPosted = request;
    state.helpRequestSubmitStatus = "idle";
  } catch (error) {
    state.helpRequestSubmitStatus = "idle";
    state.helpRequestError = error?.message || t("needHelp.postError");
  }
  render();
}

function resetHelpRequestDraft() {
  state.helpRequestDraft = { text: "", urgency: "flexible" };
  state.helpRequestPosted = null;
  state.helpRequestError = null;
  state.hireCategory = null;
  render();
}

function formatListingPrice(priceAmount, pricePeriod, currency = "EUR") {
  if (!priceAmount) return t("createListing.priceQuote");
  const amount = formatCurrency(Number(priceAmount), currency);
  const suffix = { hour: "/hr", day: "/day", month: "/mo" }[pricePeriod];
  return suffix ? `${amount}${suffix}` : amount;
}

/** Shapes a real listings-table row into whatever renderMarketplaceListing()
 * and friends already expect from the seeded mock data, and adds it to both
 * the local `listings` list (so it appears in Marketplace immediately, same
 * convention as submitHelpRequest()/applyAlwenCreatedHelpRequest() use for
 * Hire) and state.myListings (Profile's "My Listings"). Shared by the manual
 * form below and by Alwen's create_marketplace_listing tool result. */
/** Shapes a real listings-table row into whatever renderMarketplaceListing()
 * and friends already expect from the seeded mock data. Shared by the
 * manual form/Alwen's tool result (a listing just created THIS session) and
 * refreshMyListings() below (listings created in an earlier session, which
 * otherwise only ever exist in state.myListings and never actually appear
 * anywhere you'd browse them, since the `listings` array driving Marketplace
 * is a plain in-memory array with no database backing of its own). */
function shapeListingForDisplay(created) {
  const uiCategory = Object.keys(LISTING_CATEGORY_TO_DB).find((key) => LISTING_CATEGORY_TO_DB[key] === created.category) || "buy-sell";
  const user = state.auth.user;
  const metadata = created.metadata || {};
  const images = (created.images || []).map((img) => img.publicUrl);
  return {
    id: created.id,
    sellerId: created.owner_user_id || user?.id,
    type: uiCategory,
    title: created.title,
    meta: created.description || "",
    description: created.description || "",
    area: created.neighbourhood || created.location_label || city.name,
    price: formatListingPrice(created.price_amount, created.price_period, created.price_currency),
    status: t("status.published"),
    condition: metadata.condition || null,
    // Every field below reflects real, known data only — no fabricated
    // "usually replies within an hour"/reputation-100 placeholders. A
    // brand-new listing genuinely doesn't have a response-time track
    // record yet, so that line is omitted entirely rather than invented;
    // reputation is the user's real (currently always-0-until-earned)
    // public_profiles.reputation_score, not a made-up number.
    image: images[0] || "",
    gallery: images,
    seller: user?.name || "",
    sellerAvatar: user?.avatar || "",
    sellerPhone: null,
    sellerResponseTime: null,
    sellerReputation: user?.publicProfile?.reputation_score ?? 0,
    pickupAvailable: Boolean(metadata.pickupAvailable),
    deliveryAvailable: Boolean(metadata.deliveryAvailable),
    offerorStatus: created.offeror_status || metadata.offerorStatus || "private",
    verifiedSeller: Boolean(user?.emailVerified),
    distance: "",
    popularity: "",
    aiPrice: "",
    aiInsight: "",
    cardSize: "compact"
  };
}

function applyCreatedListing(created) {
  listings.unshift(shapeListingForDisplay(created));
  state.myListings.unshift(created);
  trackEvent("listing_created", { category: created.category, hasPrice: Boolean(created.price_amount) });
}

/** Fire-and-forget, called both right after sign-in and every time the
 * user opens Profile or Marketplace — a transient network hiccup on the
 * sign-in call previously left "My Listings" empty for the rest of the
 * session with no way to recover short of a full reload. Also merges any
 * fetched listing that isn't already in the local `listings` array (i.e.
 * one created in an earlier session) so it actually shows up in Marketplace
 * too, not just Profile. */
async function refreshMyListings() {
  try {
    state.myListings = await fetchMyListings();
    for (const item of state.myListings) {
      if (!listings.some((existing) => String(existing.id) === String(item.id))) {
        listings.unshift(shapeListingForDisplay(item));
      }
    }
    render();
  } catch (error) {
    console.warn("[listings] Failed to load my listings.", error);
  }
}

async function submitListingForm() {
  const draft = state.listingDraft;
  const title = draft.title.trim();
  if (!title) {
    state.listingSubmitStatus = "error";
    state.listingSubmitError = t("createListing.missingTitleError");
    render();
    return;
  }
  if (!draft.offerorStatus) {
    state.listingSubmitStatus = "error";
    state.listingSubmitError = "Select whether you are a private seller/provider or a trader/business.";
    render();
    return;
  }
  if (draft.offerorStatus === "trader" && state.traderVerification?.status !== "verified") {
    state.listingSubmitStatus = "error";
    state.listingSubmitError = "Complete trader verification before publishing trader listings.";
    render();
    return;
  }

  state.listingSubmitStatus = "loading";
  state.listingSubmitError = null;
  render();

  try {
    state.offerorStatus = await confirmOfferorStatus({ status: draft.offerorStatus, termsVersion: LEGAL_POLICY_VERSION, reason: "Confirmed before listing publication" });
    const created = await createListing({
      title,
      description: draft.description.trim(),
      category: LISTING_CATEGORY_TO_DB[draft.category] || "buy_sell",
      priceAmount: draft.priceAmount ? Number(draft.priceAmount) : null,
      pricePeriod: draft.priceAmount ? draft.pricePeriod : null,
      neighbourhood: draft.neighbourhood.trim(),
      condition: draft.condition || null,
      pickupAvailable: draft.pickupAvailable,
      deliveryAvailable: draft.deliveryAvailable,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    });

    // The listing itself already exists at this point regardless of what
    // happens next — a photo upload failing shouldn't undo that or block
    // the user from seeing their (photo-less) listing; it's only ever
    // logged, never surfaced as the whole submission having failed.
    if (draft.photoFiles.length) {
      const uploads = await Promise.allSettled(
        draft.photoFiles.map((file, index) => uploadListingPhoto({ listingId: created.id, file, sortOrder: index }))
      );
      created.images = uploads.filter((result) => result.status === "fulfilled").map((result) => result.value);
      uploads
        .filter((result) => result.status === "rejected")
        .forEach((result) => console.warn("[listings] Photo upload failed", result.reason));
    }

    applyCreatedListing(created);
    state.listingSubmitStatus = "success";
    state.listingDraft = {
      title: "",
      description: "",
      category: "buy-sell",
      priceAmount: "",
      pricePeriod: "one_time",
      neighbourhood: "",
      condition: "",
      pickupAvailable: false,
      deliveryAvailable: false,
      offerorStatus: "",
      tags: "",
      photoFiles: []
    };
    state.activeView = "listingDetail";
    state.selectedListingId = created.id;
  } catch (error) {
    state.listingSubmitStatus = "error";
    state.listingSubmitError = error?.message || t("createListing.genericError");
  }
  render();
}

function renderHelpRequest(request) {
  const title = request.title || t(request.titleKey);
  const urgency = request.urgency || t(request.urgencyKey);
  const status = request.status || t(request.statusKey);
  return `
    <article class="request-card">
      <span class="badge">${escapeHtml(urgency)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(request.area)}${request.budget ? ` · ${escapeHtml(request.budget)}` : ""} · ${escapeHtml(status)}</p>
      ${request.quotes.length ? `<div class="quote-list">${request.quotes.map((quote) => `<span>${escapeHtml(quote)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

function marketplaceCategoryTiles(targetView) {
  return [
    { label: t("common.allCategories"), iconGlyph: "🧭", isActive: state.category === "all", attrs: `data-category="all" data-target-view="${targetView}"` },
    ...categories.map((category) => ({
      label: t(category.labelKey),
      iconGlyph: MARKETPLACE_CATEGORY_EMOJI[category.id] || "🏷️",
      isActive: state.category === category.id,
      attrs: `data-category="${category.id}" data-target-view="${targetView}"`
    }))
  ];
}

function renderCategoryTabs(targetView = "marketplace") {
  return renderCategoryTileGrid(marketplaceCategoryTiles(targetView));
}

/** Chip-row version for the full Marketplace results page — the picker
 * screen in front of it already showed the box grid, so repeating it
 * here would read as a second picker rather than a filter on results
 * already in view. See renderCategoryChipRow. */
function renderMarketplaceCategoryChipRow(targetView = "marketplace") {
  return renderCategoryChipRow(marketplaceCategoryTiles(targetView));
}

function renderListings() {
  const items = filteredListings();
  return `
    <section class="section-shell">
      <div class="screen-heading">
        <p class="eyebrow">${currentAreaLabel()}</p>
        <h1>${t("common.localListings")}</h1>
      </div>
      ${renderCategoryTabs("listings")}
      <div class="stack-list">
        ${items
          .map(
            (item) => `
            <article class="content-card">
              <span class="badge">${item.status}</span>
              <h3>${listingTitle(item)}</h3>
              <p>${item.area} · ${listingMeta(item)}</p>
              <div><strong>${item.price}</strong><button>${t("common.view")}</button></div>
            </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderBusinesses() {
  const items = filteredBusinesses();
  return `
    <section class="section-shell">
      <section class="city-hero page-hero businesses-hero-photo" aria-labelledby="businesses-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("home.cityOS")} · ${currentAreaLabel()}</p>
          <h1 id="businesses-hero-title">${t("common.localPlaces")}</h1>
          <p>${t("common.localPlacesHint")}</p>
        </div>
        ${renderAiSearch("businesses")}
      </section>
      ${renderAiSearchResults(6, "businesses")}
      <div class="visual-business-grid">
        ${items
          .map(
            (item) => `
            <article class="business-card visual-business-card">
              <div class="business-photo" style="background-image: url('${item.image}')">
                <span>${item.hours}</span>
              </div>
              <div>
                <h3>${item.name}${verifiedCheck(t("status.verified"))}</h3>
                <p>${item.area} · ${item.distance} · ★ ${item.rating}</p>
                <div class="tag-row">${item.tagKeys.map((tagKey) => `<span>${t(tagKey)}</span>`).join("")}</div>
                <div class="ai-price-pill">${icon("spark")}<span>${t(item.aiInsightKey)}</span></div>
                ${item.ecosystem ? `<div class="business-platform">${item.ecosystem.map((capability) => `<span>${capability}</span>`).join("")}</div>` : ""}
              </div>
              <div class="market-actions">
                <button data-view="businessProfile" data-business-id="${item.id}">${t("common.viewProfile")}</button>
                <button data-view="reservations">${t("common.reserve")}</button>
              </div>
            </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

const BUSINESS_TYPE_LABEL_KEY = {
  restaurants: "category.business.bizCatFoodDrink",
  hotels: "category.business.bizCatHotels",
  "service-apartments": "category.business.bizCatHotels",
  pharmacies: "category.business.bizCatPharmacy",
  clinics: "category.business.bizCatHealthcare",
  grocery: "category.business.bizCatGroceries",
  repair: "category.business.bizCatShops",
  shops: "category.business.bizCatShops"
};

function businessTypeLabel(type) {
  const key = BUSINESS_TYPE_LABEL_KEY[type];
  return key ? t(key) : type;
}

const OPENING_HOURS_DAY_LABEL_KEY = {
  "Mon–Fri": "field.days.monFri",
  "Mon–Sat": "field.days.monSat",
  Sat: "field.days.sat",
  "Sat–Sun": "field.days.satSun",
  "Tue–Sun": "field.days.tueSun",
  "Every day": "field.days.everyDay"
};

function openingHoursDayLabel(days) {
  const key = OPENING_HOURS_DAY_LABEL_KEY[days];
  return key ? t(key) : days;
}

function renderBusinessProfile() {
  const item = businesses.find((business) => business.id === state.selectedBusinessId) || businesses[0];
  const gallery = [item.image, ...(item.gallery || [])];

  return `
    <section class="section-shell business-profile-shell">
      <button class="back-button" data-view="businesses">${icon("arrow")}${t("common.back")}</button>
      <div class="business-profile-hero" style="background-image: url('${item.image}')">
        <div class="business-profile-hero-copy">
          <h1>${item.name}${item.verified ? verifiedCheck(t("status.verified")) : ""}</h1>
          <p>${item.area} · ${item.distance} · ${icon("star")}${item.rating}</p>
        </div>
      </div>
      ${
        gallery.length > 1
          ? `<div class="business-gallery-rail">${gallery.map((photo) => `<div class="business-gallery-photo" style="background-image: url('${photo}')"></div>`).join("")}</div>`
          : ""
      }
      <div class="ai-price-pill">${icon("spark")}<span>${item.aiSummaryKey ? t(item.aiSummaryKey) : t(item.aiInsightKey)}</span></div>

      <div class="business-detail-strip">
        ${item.type ? `<span class="badge category-chip">${businessTypeLabel(item.type)}</span>` : ""}
        ${item.address ? `<p class="business-detail-line">${pinIcon()}${escapeHtml(item.address)}</p>` : ""}
        ${item.phone ? `<a class="business-detail-line business-detail-phone" href="tel:${item.phone}">${phoneIcon()}${escapeHtml(item.phone)}</a>` : ""}
      </div>
      ${item.tagKeys?.length ? `<div class="quote-list">${item.tagKeys.map((key) => `<span>${t(key)}</span>`).join("")}</div>` : ""}

      <div class="business-profile-actions">
        <button type="button" data-view="reservations">${t("common.bookNow")}</button>
        ${renderDirectionsButton(item)}
        ${item.phone ? `<a class="directions-btn" href="tel:${item.phone}">${phoneIcon()}${t("common.call")}</a>` : ""}
        <button type="button" data-view="messages">${t("common.message")}</button>
      </div>
      ${
        item.services
          ? `<div class="section-title"><h2>${t("common.services")}</h2></div>
             <div class="business-services-list">${item.services.map((service) => `<div class="business-service-row"><span>${t(service.nameKey)}</span><strong>${service.price}</strong></div>`).join("")}</div>`
          : ""
      }
      ${
        item.openingHours
          ? `<div class="section-title"><h2>${t("field.openingHours")}</h2></div>
             <div class="business-hours-list">${item.openingHours.map((row) => `<div class="business-hours-row"><span>${openingHoursDayLabel(row.days)}</span><strong>${row.hours}</strong></div>`).join("")}</div>`
          : ""
      }
      <div class="section-title"><h2>${t("common.reviews")}</h2></div>
      <div class="review-grid">
        ${profileReviews.map((review) => `
          <article>
            <div class="review-author-row" role="button" tabindex="0" ${publicProfileAttrs({ id: review.id, name: review.author, avatar: review.avatar, context: "review" })}>
              <img src="${review.avatar}" alt="" />
              <div><strong>${review.author}</strong><span>${"★".repeat(review.rating)}</span></div>
            </div>
            <p>${t(review.textKey)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

/* Inbox & Notification Centre — a single hub with two modes (segmented
   control below), not two unrelated screens. Both "notifications" and
   "messages" routes render this same shell; state.activeView (already
   the thing [data-view] buttons set) doubles as the tab selector, so
   switching tabs is just a normal navigation click — no extra state
   field needed to keep it in sync with the URL/back-button. */

const NOTIFICATION_TYPE_META = {
  alwen: { emoji: "✨", labelKey: "notification.category.alwen" },
  marketplace: { emoji: "🛍️", labelKey: "notification.category.marketplace" },
  booking: { emoji: "📅", labelKey: "notification.category.booking" },
  business: { emoji: "🏢", labelKey: "notification.category.business" },
  community: { emoji: "🤝", labelKey: "notification.category.community" },
  payment: { emoji: "💳", labelKey: "notification.category.payment" },
  tyt: { emoji: "🔁", labelKey: "notification.category.tyt" },
  profile: { emoji: "👤", labelKey: "notification.category.profile" },
  system: { emoji: "⚙️", labelKey: "notification.category.system" }
};

const CONVERSATION_TYPE_META = {
  professional: { emoji: "🛠️", labelKey: "messages.conversationTypeProfessional" },
  business: { emoji: "🏢", labelKey: "messages.conversationTypeBusiness" },
  marketplace: { emoji: "🛍️", labelKey: "messages.conversationTypeMarketplace" },
  alwen: { emoji: "✨", labelKey: "messages.conversationTypeAlwen" }
};

const CONVERSATION_CONTEXT_LABEL_KEY = {
  quote: "messages.contextQuote",
  booking: "messages.contextBooking",
  listing: "messages.contextListing",
  plan: "messages.contextPlan"
};

const NOTIFICATION_PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, success: 3 };

const NOTIFICATION_TIME_GROUPS = [
  ["now", "notification.groupNow"],
  ["today", "notification.groupToday"],
  ["yesterday", "notification.groupYesterday"],
  ["week", "notification.groupWeek"],
  ["earlier", "notification.groupEarlier"]
];

function notificationsForFilter(filter) {
  if (filter === "all") return notifications;
  if (filter === "needsAction") return notifications.filter((item) => !item.completed && (item.priority === "urgent" || item.priority === "high"));
  return notifications.filter((item) => item.type === filter);
}

function sortedNotifications(list) {
  return [...list].sort((a, b) => {
    const rankDiff = NOTIFICATION_PRIORITY_RANK[a.priority] - NOTIFICATION_PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return 0;
  });
}

function dismissNotification(id) {
  const index = notifications.findIndex((item) => item.id === Number(id));
  if (index !== -1) notifications.splice(index, 1);
}

function toggleNotificationRead(id) {
  const item = notifications.find((entry) => entry.id === Number(id));
  if (item) item.unread = !item.unread;
}

function markAllNotificationsRead() {
  notifications.forEach((item) => { item.unread = false; });
}

function archiveConversation(id) {
  const index = messageThreads.findIndex((thread) => thread.id === Number(id));
  if (index !== -1) messageThreads.splice(index, 1);
}

function toggleConversationRead(id) {
  const thread = messageThreads.find((entry) => entry.id === Number(id));
  if (thread) thread.unread = thread.unread > 0 ? 0 : 1;
}

/* Swipe-to-act wrapper shared by notification cards and conversation
   rows — two action glyphs sit behind the card, revealed by dragging
   the foreground surface; bindSwipeRows() in bindEvents() does the
   actual touch handling. data-swipe-type + data-swipe-id tell that one
   shared handler which array/action to mutate. */
function renderSwipeRow(type, id, leftGlyph, rightGlyph, innerHtml) {
  return `
    <div class="swipe-row" data-swipe-type="${type}" data-swipe-id="${id}">
      <span class="swipe-action swipe-action-left" aria-hidden="true">${leftGlyph}</span>
      <span class="swipe-action swipe-action-right" aria-hidden="true">${rightGlyph}</span>
      <div class="swipe-surface">${innerHtml}</div>
    </div>
  `;
}

function renderNotificationCard(item) {
  const meta = NOTIFICATION_TYPE_META[item.type] || NOTIFICATION_TYPE_META.system;
  const primaryAttrs = item.primaryActionSheet ? `data-sheet="${item.primaryActionSheet}"` : `data-view="${item.primaryActionView || "notifications"}"`;
  return `
    <article class="notification-card priority-${item.priority} ${item.unread ? "is-unread" : ""}">
      <span class="notification-card-icon" aria-hidden="true">${meta.emoji}</span>
      <div class="notification-card-body">
        <div class="notification-card-top">
          <span class="notification-card-source">${t(meta.labelKey)}</span>
          ${item.unread ? `<span class="notification-unread-dot" aria-hidden="true"></span>` : ""}
          ${item.priority === "urgent" && !item.completed ? `<span class="notification-urgent-badge">${t("notification.urgentLabel")}</span>` : ""}
          <span class="notification-card-time">${t(item.timeKey)}</span>
        </div>
        <h3>${t(item.titleKey)}</h3>
        <p>${t(item.summaryKey)}</p>
        ${item.completed
          ? `<span class="notification-completed-badge">${icon("check")}${t("notification.completedLabel")}</span>`
          : `
            <div class="notification-card-actions">
              <button type="button" class="notification-primary-action" data-action="notification-primary" data-id="${item.id}" ${primaryAttrs}>${t(item.primaryActionKey)}</button>
              <button type="button" class="notification-secondary-action" data-action="dismiss-notification" data-id="${item.id}">${t("notification.dismiss")}</button>
            </div>
          `}
      </div>
    </article>
  `;
}

function renderNotificationCardSwipeable(item) {
  return renderSwipeRow("notification", item.id, "✓", "🗑️", renderNotificationCard(item));
}

function renderNeedsActionSummary(items) {
  return `
    <div class="needs-action-summary">
      <h2>${t("notification.needsAction")}</h2>
      <div class="needs-action-strip">
        ${items.map((item) => {
          const meta = NOTIFICATION_TYPE_META[item.type] || NOTIFICATION_TYPE_META.system;
          const primaryAttrs = item.primaryActionSheet ? `data-sheet="${item.primaryActionSheet}"` : `data-view="${item.primaryActionView || "notifications"}"`;
          return `
            <button type="button" class="needs-action-card priority-${item.priority}" data-action="notification-primary" data-id="${item.id}" ${primaryAttrs}>
              <span aria-hidden="true">${meta.emoji}</span>
              <span>${t(item.titleKey)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderNotificationFilterChips() {
  const counts = {};
  notifications.forEach((item) => { counts[item.type] = (counts[item.type] || 0) + 1; });
  const needsActionCount = notifications.filter((item) => !item.completed && (item.priority === "urgent" || item.priority === "high")).length;
  const chips = [
    ["all", t("common.all"), notifications.length],
    ["needsAction", t("notification.needsAction"), needsActionCount],
    ...NOTIFICATION_FILTERS.filter((type) => type !== "needsAction").map((type) => [type, t(`notification.category.${type}`), counts[type] || 0])
  ];
  return `
    <div class="chip-row explore-category-row notification-filter-row">
      ${chips.map(([value, label, count]) => `
        <button type="button" class="${state.notificationFilter === value ? "is-selected" : ""}" data-notification-filter="${value}">
          ${label}${count ? ` <span class="chip-count">${count}</span>` : ""}
        </button>
      `).join("")}
    </div>
  `;
}

function renderNotificationsBody() {
  const filtered = notificationsForFilter(state.notificationFilter);
  const needsAction = sortedNotifications(notifications.filter((item) => !item.completed && (item.priority === "urgent" || item.priority === "high"))).slice(0, 3);
  const groups = NOTIFICATION_TIME_GROUPS
    .map(([key, labelKey]) => [key, labelKey, sortedNotifications(filtered.filter((item) => item.timeGroup === key))])
    .filter(([, , items]) => items.length);
  return `
    ${needsAction.length ? renderNeedsActionSummary(needsAction) : ""}
    ${renderNotificationFilterChips()}
    ${groups.length
      ? groups.map(([, labelKey, items]) => `
        <div class="notification-time-group">
          <h2>${t(labelKey)}</h2>
          <div class="notification-card-list">${items.map(renderNotificationCardSwipeable).join("")}</div>
        </div>
      `).join("")
      : `
        <div class="notification-empty-state">
          <span class="notification-empty-icon" aria-hidden="true">${icon("bell")}</span>
          <h3>${state.notificationFilter === "needsAction" ? t("notification.needsActionEmpty") : t("notification.emptyTitle")}</h3>
          <p>${t("notification.emptyHint")}</p>
        </div>
      `}
  `;
}

function renderConversationRow(thread) {
  const meta = CONVERSATION_TYPE_META[thread.type] || CONVERSATION_TYPE_META.business;
  const initials = thread.participant.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  return `
    <article class="conversation-row ${thread.unread ? "is-unread" : ""}" data-view="conversation" data-conversation-id="${thread.id}">
      <div class="conversation-avatar ${thread.type === "alwen" ? "is-alwen" : ""}">
        ${thread.type === "alwen" ? brandIconMarkup("app-icon") : `<span>${escapeHtml(initials)}</span>`}
      </div>
      <div class="conversation-body">
        <div class="conversation-top">
          <h3>${escapeHtml(thread.participant)}${thread.verified ? `<span class="conversation-verified" title="${t("messages.verified")}">${icon("verify")}</span>` : ""}</h3>
          <span class="conversation-time">${t(thread.timeKey)}</span>
        </div>
        <p class="conversation-preview">${escapeHtml(thread.preview)}</p>
        <div class="conversation-meta-row">
          <span class="conversation-type-tag">${meta.emoji} ${t(meta.labelKey)}</span>
          ${thread.unread ? `<span class="conversation-unread-count">${thread.unread}</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderConversationRowSwipeable(thread) {
  return renderSwipeRow("conversation", thread.id, "✓", "🗑️", renderConversationRow(thread));
}

function renderInboxBody() {
  if (!messageThreads.length) {
    return `
      <div class="notification-empty-state">
        <span class="notification-empty-icon" aria-hidden="true">${icon("message")}</span>
        <h3>${t("messages.emptyTitle")}</h3>
        <p>${t("messages.emptyHint")}</p>
      </div>
    `;
  }
  return `<div class="conversation-list">${messageThreads.map(renderConversationRowSwipeable).join("")}</div>`;
}

function renderNotificationHeader(isInbox) {
  const unreadNotifications = notifications.filter((item) => item.unread).length;
  const unreadMessages = messageThreads.reduce((sum, thread) => sum + thread.unread, 0);
  const actionCount = notifications.filter((item) => !item.completed && (item.priority === "urgent" || item.priority === "high")).length;
  return `
    <div class="notification-header">
      <div>
        <h1>${isInbox ? t("notification.tabInbox") : t("notification.tabNotifications")}</h1>
        <p>
          ${isInbox
            ? t("notification.unreadCount").replace("{count}", unreadMessages)
            : `${t("notification.unreadCount").replace("{count}", unreadNotifications)} · ${t("notification.requireActionCount").replace("{count}", actionCount)}`}
        </p>
      </div>
      <div class="notification-header-actions">
        ${!isInbox ? `<button type="button" class="notification-header-icon" data-action="mark-all-read" aria-label="${t("notification.markAllRead")}" title="${t("notification.markAllRead")}">${icon("check")}</button>` : ""}
        <button type="button" class="notification-header-icon" data-view="settings" aria-label="${t("notification.settings")}" title="${t("notification.settings")}">${icon("settings")}</button>
      </div>
    </div>
  `;
}

function renderNotificationsHub() {
  const isInbox = state.activeView === "messages";
  return `
    <section class="section-shell notification-hub">
      ${renderNotificationHeader(isInbox)}
      <div class="inbox-tabs" role="tablist">
        <button type="button" role="tab" class="${!isInbox ? "is-active" : ""}" data-view="notifications" aria-selected="${!isInbox}">${t("notification.tabNotifications")}</button>
        <button type="button" role="tab" class="${isInbox ? "is-active" : ""}" data-view="messages" aria-selected="${isInbox}">${t("notification.tabInbox")}</button>
      </div>
      <div class="notification-hub-layout">
        <div class="notification-hub-main">
          ${isInbox ? renderInboxBody() : renderNotificationsBody()}
        </div>
        <aside class="notification-hub-rail">
          <div class="notification-rail-card">
            <h3>${t("notification.needsAction")}</h3>
            ${(() => {
              const items = sortedNotifications(notifications.filter((item) => !item.completed && (item.priority === "urgent" || item.priority === "high"))).slice(0, 4);
              if (!items.length) return `<p class="notification-rail-empty">${t("notification.needsActionEmpty")}</p>`;
              return `<ul class="notification-rail-list">${items.map((item) => `<li>${t(item.titleKey)}</li>`).join("")}</ul>`;
            })()}
          </div>
          <div class="notification-rail-card">
            <h3>${t("alwen.alwenWorkspace")}</h3>
            <p class="notification-rail-hint">${t("alwen.alwenWorkspaceTitle")}</p>
            <button type="button" class="notification-rail-button" data-view="alwen">${t("common.tellAlwen")}</button>
          </div>
          <button type="button" class="notification-rail-settings" data-view="settings">${icon("settings")} ${t("notification.settings")}</button>
        </aside>
      </div>
    </section>
  `;
}

function renderConversationDetail() {
  const thread = messageThreads.find((entry) => entry.id === state.activeConversationId);
  if (!thread) {
    state.activeView = "messages";
    return renderNotificationsHub();
  }
  const meta = CONVERSATION_TYPE_META[thread.type] || CONVERSATION_TYPE_META.business;
  const initials = thread.participant.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  return `
    <section class="section-shell conversation-detail-shell">
      <div class="conversation-detail-header">
        <button type="button" class="conversation-back" data-view="messages" aria-label="${t("messages.backToInbox")}">${icon("arrow")}</button>
        <div class="conversation-avatar ${thread.type === "alwen" ? "is-alwen" : ""}">
          ${thread.type === "alwen" ? brandIconMarkup("app-icon") : `<span>${escapeHtml(initials)}</span>`}
        </div>
        <div class="conversation-detail-identity">
          <h2>${escapeHtml(thread.participant)}${thread.verified ? `<span class="conversation-verified" title="${t("messages.verified")}">${icon("verify")}</span>` : ""}</h2>
          <span class="conversation-type-tag">${meta.emoji} ${t(meta.labelKey)}</span>
        </div>
      </div>
      ${thread.context ? `
        <div class="conversation-context-card">
          <span class="conversation-context-kind">${t(CONVERSATION_CONTEXT_LABEL_KEY[thread.context.kind] || "messages.contextPlan")}</span>
          <h3>${t(thread.context.titleKey)}</h3>
          <p>${t(thread.context.metaKey)}</p>
        </div>
      ` : ""}
      ${renderTransactionSafetyNotice()}
      <button type="button" class="settings-row-button" data-report-target="user" data-report-id="${thread.id}">Report user</button>
      <div class="conversation-history">
        ${thread.messages.map((message) => `
          <div class="conversation-message ${message.from === "me" ? "is-me" : "is-them"}">
            <p>${message.textKey ? t(message.textKey) : escapeHtml(message.text)}</p>
            <span>${message.timeKey ? t(message.timeKey) : escapeHtml(message.time || "")}</span>
          </div>
        `).join("")}
      </div>
      <form class="conversation-composer" data-action="send-message" data-conversation-id="${thread.id}">
        <input type="text" id="conversation-composer-input" name="message" placeholder="${t("messages.composerPlaceholder")}" value="${escapeHtml(state.composerDraft)}" aria-label="${t("messages.composerPlaceholder")}" autocomplete="off" />
        <button type="submit">${t("messages.send")}</button>
      </form>
    </section>
  `;
}

function renderOffers() {
  return `
    <section class="section-shell">
      ${renderTransactionSafetyNotice()}
      <div class="screen-heading">
        <p class="eyebrow">${currentAreaLabel()}</p>
        <h1>${t("common.localOffers")}</h1>
      </div>
      <div class="offer-list">
        ${offers
          .map(
            (offer) => `
            <article class="offer-card">
              <span>${offer.expires}</span>
              <h3>${offer.value}</h3>
              <p>${t(offer.titleKey)}</p>
              <small role="button" tabindex="0" ${publicProfileAttrs({ id: `offer-${offer.id}`, name: offer.vendor, area: offer.area, context: "marketplace" })}>${offer.vendor} · ${offer.area}</small>
              <button>${t("business.claim.claimOffer")}</button>
            </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

const RESERVATION_STATUS_TONE = {
  "Pending confirmation": "status-badge-amber",
  "Quote requested": "status-badge-sky",
  "Awaiting slot": "status-badge-muted",
  Confirmed: "status-badge-green"
};

const RESERVATION_TYPE_ICON = {
  Restaurant: "food",
  "Service apartment": "stay",
  Service: "tool"
};

const RESERVATION_BOOKABLE_TYPES = ["restaurants", "hotels", "service-apartments", "repair", "clinics"];

function renderReservationCard(request) {
  const match = businesses.find((item) => item.name === request.target);
  return `
    <article class="reservation-card">
      <div class="reservation-card-photo" ${match ? `style="background-image: url('${match.image}')"` : ""}>
        ${!match ? `<span class="reservation-card-icon">${icon(RESERVATION_TYPE_ICON[request.type] || "calendar")}</span>` : ""}
      </div>
      <div class="reservation-card-body">
        <span class="badge ${RESERVATION_STATUS_TONE[request.status] || ""}">${request.status}</span>
        <h3>${request.target}</h3>
        <p>${request.type} · ${request.date} · ${request.party}</p>
      </div>
      ${match ? `<button data-view="businessProfile" data-business-id="${match.id}">${t("common.viewProfile")}</button>` : ""}
    </article>
  `;
}

function renderReservationSuggestion(item) {
  return `
    <article class="reservation-suggestion-card" data-view="businessProfile" data-business-id="${item.id}">
      <div class="card-photo" style="background-image: url('${item.image}')"></div>
      <h3>${item.name}</h3>
      <p>${item.area} · ★ ${item.rating}</p>
      <button type="button" data-view="businessProfile" data-business-id="${item.id}">${t("common.reserve")}</button>
    </article>
  `;
}

function renderReservations() {
  const suggestions = businesses.filter((item) => RESERVATION_BOOKABLE_TYPES.includes(item.type));
  return `
    <section class="section-shell reservations-shell">
      <section class="city-hero page-hero reservations-hero-photo" aria-labelledby="reservations-hero-title">
        <div class="city-hero-copy">
          <p class="eyebrow">${t("nav.book")} · ${currentAreaLabel()}</p>
          <h1 id="reservations-hero-title">${t("common.reservationTitle")}</h1>
          <p>${t("common.reservationHeroSubtitle")}</p>
        </div>
        ${renderAiSearch("reservations")}
      </section>

      ${renderAiSearchResults(6, "reservations")}

      <div class="request-form-card">
        <h2>${t("common.newRequestTitle")}</h2>
        <form class="request-form">
          <label>${icon("shop")}<input placeholder="${t("common.requestPlaceholder")}" /></label>
          <label>${icon("calendar")}<input placeholder="${t("common.datePlaceholder")}" /></label>
          <label>${icon("people")}<input placeholder="${t("common.notesPlaceholder")}" /></label>
          <button type="button">${t("entity.request")}</button>
        </form>
      </div>

      <div class="section-title">
        <div><h2>${t("common.myRequestsTitle")}</h2></div>
      </div>
      <div class="reservation-list">
        ${reservations.map(renderReservationCard).join("")}
      </div>

      ${suggestions.length ? `
        <div class="section-title">
          <div><h2>${t("common.popularToBookTitle")}</h2><p>${t("common.popularToBookHint")}</p></div>
        </div>
        ${renderCarousel("popularToBook", "living-rail", suggestions.map(renderReservationSuggestion).join(""))}
      ` : ""}
    </section>
  `;
}

const TRANSLATE_LANGUAGE_KEYS = [
  "translate.language.langLithuanian",
  "translate.language.langEnglish",
  "translate.language.langRussian",
  "translate.language.langPolish",
  "translate.language.langGerman",
  "translate.language.langFrench"
];

const TRANSLATE_LANGUAGE_FLAGS = {
  "translate.language.langLithuanian": "🇱🇹",
  "translate.language.langEnglish": "🇬🇧",
  "translate.language.langRussian": "🇷🇺",
  "translate.language.langPolish": "🇵🇱",
  "translate.language.langGerman": "🇩🇪",
  "translate.language.langFrench": "🇫🇷"
};

/** ISO 639-1 codes for the MyMemory translation API's langpair param. */
const TRANSLATE_LANGUAGE_ISO = {
  "translate.language.langLithuanian": "lt",
  "translate.language.langEnglish": "en",
  "translate.language.langRussian": "ru",
  "translate.language.langPolish": "pl",
  "translate.language.langGerman": "de",
  "translate.language.langFrench": "fr"
};

/** BCP-47 tags for the Web Speech API's SpeechSynthesisUtterance.lang. */
const TRANSLATE_LANGUAGE_SPEECH_LOCALE = {
  "translate.language.langLithuanian": "lt-LT",
  "translate.language.langEnglish": "en-GB",
  "translate.language.langRussian": "ru-RU",
  "translate.language.langPolish": "pl-PL",
  "translate.language.langGerman": "de-DE",
  "translate.language.langFrench": "fr-FR"
};

/** Tesseract OCR's trained-data language codes (3-letter, not the 2-letter
 * ISO codes used elsewhere) for reading text out of a captured photo. */
const TRANSLATE_LANGUAGE_TESSERACT = {
  "translate.language.langLithuanian": "lit",
  "translate.language.langEnglish": "eng",
  "translate.language.langRussian": "rus",
  "translate.language.langPolish": "pol",
  "translate.language.langGerman": "deu",
  "translate.language.langFrench": "fra"
};

let tesseractLoadPromise = null;

/** Loads the real Tesseract.js OCR engine from a CDN on first use only —
 * it's a genuine WebAssembly OCR library (no API key, no server), just not
 * worth bundling into every page load since most visits never touch the
 * camera mode. Cached so a second photo doesn't re-fetch the script. */
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("Tesseract failed to initialise")));
    script.onerror = () => reject(new Error("Failed to load OCR engine"));
    document.head.appendChild(script);
  });
  return tesseractLoadPromise;
}

/** Real OCR + real translation for a photo — no fabricated text. Reads
 * whatever Tesseract actually recognises in the source language, feeds it
 * into the same translateInputText/runTranslation pipeline the type and
 * voice modes use, and reports an honest error if the photo has no
 * readable text or the OCR engine can't be reached. */
async function handleCameraCapture(file) {
  if (!file) return;
  state.translateCameraStatus = "reading";
  state.translateCameraProgress = 0;
  state.translateCameraErrorMessage = null;
  state.translateInputMode = "text";
  render();
  try {
    const Tesseract = await loadTesseract();
    const lang = TRANSLATE_LANGUAGE_TESSERACT[state.translateFromLanguage];
    const { data } = await Tesseract.recognize(file, lang, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          state.translateCameraProgress = Math.round((message.progress || 0) * 100);
          render();
        }
      }
    });
    const extractedText = (data?.text || "").trim();
    if (!extractedText) {
      state.translateCameraStatus = "error";
      state.translateCameraErrorMessage = t("translate.noTextFound");
      render();
      return;
    }
    state.translateCameraStatus = "idle";
    state.translateInputText = extractedText;
    render();
    await runTranslation();
  } catch {
    state.translateCameraStatus = "error";
    state.translateCameraErrorMessage = t("translate.cameraError");
    render();
  }
}

let pdfjsLoadPromise = null;

/** Loads the real pdf.js engine (Mozilla's own PDF renderer/text-extraction
 * library, the same one behind Firefox's built-in PDF viewer) from a CDN on
 * first use — same lazy, keyless, no-backend pattern as loadTesseract(). */
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs";
    window.pdfjsLib = mod;
    return mod;
  });
  return pdfjsLoadPromise;
}

const DOCUMENT_TEXT_CHAR_LIMIT = 600;

/** Real PDF text extraction via pdf.js — reads the actual embedded text
 * layer (not OCR, since PDFs already carry real text), then feeds it into
 * the same translateInputText/runTranslation pipeline as every other input
 * mode. Only PDF is supported honestly: Word/Pages documents need a
 * different parser this app doesn't have, so those are rejected with a
 * clear message instead of silently producing nothing. Long documents are
 * capped to a translatable excerpt rather than firing hundreds of chunk
 * requests at the free translation API. */
async function handleDocumentCapture(file) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    state.translateCameraStatus = "error";
    state.translateCameraErrorMessage = t("translate.documentTypeUnsupported");
    render();
    return;
  }
  state.translateCameraStatus = "reading";
  state.translateCameraProgress = 0;
  state.translateCameraErrorMessage = null;
  state.translateInputMode = "text";
  render();
  try {
    const pdfjsLib = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      fullText += `${content.items.map((item) => item.str).join(" ")} `;
      state.translateCameraProgress = Math.round((pageNumber / pdf.numPages) * 100);
      render();
      if (fullText.trim().length >= DOCUMENT_TEXT_CHAR_LIMIT) break;
    }
    const extractedText = fullText.trim().slice(0, DOCUMENT_TEXT_CHAR_LIMIT);
    if (!extractedText) {
      state.translateCameraStatus = "error";
      state.translateCameraErrorMessage = t("translate.noTextFound");
      render();
      return;
    }
    state.translateCameraStatus = "idle";
    state.translateInputText = extractedText;
    render();
    await runTranslation();
  } catch {
    state.translateCameraStatus = "error";
    state.translateCameraErrorMessage = t("translate.cameraError");
    render();
  }
}

/** Words that commonly start a new question/clause in English. Used only to
 * split a run-on, punctuation-free transcript (exactly what speech
 * recognition produces — it never inserts periods or commas) into pieces
 * MyMemory can actually translate in full. MyMemory is a translation-memory
 * / phrase-matching service, not a neural MT model: fed one long unbroken
 * string it silently returns its best single phrase match and drops the
 * rest, which is why "Hey how are you doing how much is this" came back
 * as just "Labas, kaip tau sekasi?" (only the first question survived). */
const CLAUSE_STARTER_WORDS = new Set([
  "how", "what", "where", "when", "why", "who", "which",
  "is", "are", "am", "do", "does", "did",
  "can", "could", "will", "would", "should", "have", "has", "may", "might"
]);

/** Splits text into chunks that can each be sent to MyMemory separately.
 * Real punctuation (from typed input) is always respected as-is. Only when
 * there's no punctuation at all does the clause-starter heuristic kick in,
 * and only after at least 3 words have accumulated — short questions like
 * "What time is it" are left whole. This is a heuristic, not a real parser:
 * it fixes the specific run-on pattern voice input produces without
 * pretending to be a general sentence segmenter. */
function splitIntoTranslatableChunks(text) {
  if (/[.!?]/.test(text)) {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 6) return [text];
  const chunks = [];
  let current = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const bareWord = words[i].toLowerCase().replace(/[^a-zà-ÿ']/gi, "");
    if (current.length >= 3 && CLAUSE_STARTER_WORDS.has(bareWord)) {
      chunks.push(current.join(" "));
      current = [words[i]];
    } else {
      current.push(words[i]);
    }
  }
  chunks.push(current.join(" "));
  return chunks;
}

/** One real MyMemory call for a single chunk — throws on any failure so the
 * caller can treat the whole translation as failed rather than show a
 * partially-translated, silently-garbled result. */
async function translateChunk(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || data.responseStatus !== 200) throw new Error("No translation returned");
  return translated;
}

/** Real, free, keyless machine translation via MyMemory — no fabricated
 * output: a network/API failure surfaces as an honest error state rather
 * than a canned "translation". Long, punctuation-free input (typically from
 * voice) is split into clauses and translated piece by piece so the full
 * meaning survives instead of MyMemory silently returning just its best
 * single phrase match. */
async function runTranslation() {
  const text = state.translateInputText.trim();
  if (!text) return;
  state.translateStatus = "loading";
  render();
  try {
    const from = TRANSLATE_LANGUAGE_ISO[state.translateFromLanguage];
    const to = TRANSLATE_LANGUAGE_ISO[state.translateToLanguage];
    const chunks = splitIntoTranslatableChunks(text);
    const translatedChunks = await Promise.all(chunks.map((chunk) => translateChunk(chunk, from, to)));
    state.translateOutputText = translatedChunks.length > 1
      ? translatedChunks
          .map((chunk) => chunk.trim())
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .map((chunk) => (/[.!?]$/.test(chunk) ? chunk : `${chunk}.`))
          .join(" ")
      : translatedChunks[0];
    state.translateStatus = "success";
    trackEvent("translation_completed", { from, to, length: text.length, chunkCount: chunks.length });
  } catch {
    state.translateOutputText = "";
    state.translateStatus = "error";
  }
  render();
}

/** Novelty/"fun" system voices (macOS's classic joke voices, plus a few
 * dated robotic ones on other platforms) — real human speech they are not,
 * so voice selection actively skips these rather than ever landing on one. */
const NOVELTY_VOICE_NAMES = new Set([
  "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos",
  "Fred", "Good News", "Jester", "Junior", "Kathy", "Organ", "Ralph",
  "Superstar", "Trinoids", "Whisper", "Wobble", "Zarvox"
]);

/** Voices browsers load asynchronously on first call — resolves once the
 * real list is available instead of racing an empty array. */
function getSpeechVoices() {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length) return resolve(existing);
    const onVoices = () => {
      synth.removeEventListener("voiceschanged", onVoices);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onVoices);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoices);
      resolve(synth.getVoices());
    }, 500);
  });
}

/** Picks the most natural-sounding installed voice for a language, or null
 * if the device has none — callers must show an honest "not available"
 * state rather than let a mismatched voice mispronounce the text. */
async function pickBestVoice(bcp47) {
  const voices = await getSpeechVoices();
  const baseLang = bcp47.split("-")[0];
  const candidates = voices.filter((voice) => voice.lang === bcp47 || voice.lang.startsWith(`${baseLang}-`) || voice.lang === baseLang);
  if (!candidates.length) return null;
  const clean = candidates.filter((voice) => !NOVELTY_VOICE_NAMES.has(voice.name.split(" (")[0]));
  const pool = clean.length ? clean : candidates;
  return (
    pool.find((voice) => /google/i.test(voice.name) && !voice.localService) ||
    pool.find((voice) => voice.default) ||
    pool.find((voice) => !voice.localService) ||
    pool[0]
  );
}

/** Real text-to-speech via the browser's Web Speech API — reads back
 * whatever text is actually there (typed input or a real translation
 * result), never a fabricated readout, using the best real voice this
 * device actually has installed for that language. Clicking again while
 * speaking stops it, mirroring a play/stop toggle. */
async function speakText(text, bcp47, button, panel) {
  if (!text || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (synth.speaking) {
    synth.cancel();
    button?.classList.remove("is-speaking");
    return;
  }
  const voice = await pickBestVoice(bcp47);
  if (!voice) {
    state.translateVoiceNotice = { panel, message: t("translate.noVoiceInstalled") };
    render();
    window.setTimeout(() => {
      if (state.translateVoiceNotice?.panel === panel) {
        state.translateVoiceNotice = null;
        render();
      }
    }, 4000);
    return;
  }
  state.translateVoiceNotice = null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.onstart = () => button?.classList.add("is-speaking");
  utterance.onend = () => button?.classList.remove("is-speaking");
  utterance.onerror = () => button?.classList.remove("is-speaking");
  synth.speak(utterance);
}

let activeSpeechRecognition = null;

/** One-touch voice input: real speech-to-text via the browser's Web Speech
 * API (Chrome/Safari support it; Firefox doesn't — feature-detected, no
 * fabricated transcript on unsupported browsers). Tapping the mic while
 * already recording stops it early, same toggle pattern as the speaker
 * buttons. On a successful capture it chains straight into a real
 * translation and then speaks the result — record once, hear the answer,
 * matching a true "one touch translator" flow. */
function startVoiceInput() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    state.translateVoiceError = t("translate.voiceNotSupported");
    render();
    return;
  }
  if (state.translateRecording) {
    activeSpeechRecognition?.stop();
    return;
  }

  const recognition = new Ctor();
  activeSpeechRecognition = recognition;
  recognition.lang = TRANSLATE_LANGUAGE_SPEECH_LOCALE[state.translateFromLanguage];
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.translateRecording = true;
    state.translateVoiceError = null;
    state.translateOutputText = "";
    state.translateStatus = "idle";
    render();
  };

  recognition.onresult = (event) => {
    state.translateInputText = Array.from(event.results).map((result) => result[0].transcript).join(" ");
    render();
  };

  recognition.onerror = (event) => {
    state.translateVoiceError = event.error === "not-allowed" || event.error === "service-not-allowed"
      ? t("translate.voiceMicDenied")
      : event.error === "no-speech"
        ? t("translate.voiceNoSpeech")
        : t("translate.voiceRecognitionError");
  };

  recognition.onend = async () => {
    state.translateRecording = false;
    activeSpeechRecognition = null;
    render();
    if (!state.translateInputText.trim()) return;
    await runTranslation();
    if (state.translateStatus === "success") {
      const speakButton = document.querySelector('[data-translate-speak="to"]');
      speakText(state.translateOutputText.trim(), TRANSLATE_LANGUAGE_SPEECH_LOCALE[state.translateToLanguage], speakButton, "to");
    }
  };

  try {
    recognition.start();
  } catch {
    state.translateVoiceError = t("translate.voiceRecognitionError");
    render();
  }
}

function renderTranslation() {
  const suggestionKeys = [
    "translate.translateMenu",
    "common.talkDoctor",
    "common.askGovernmentOffice",
    "common.messageLandlord",
    "common.readContract",
    "common.speakTaxiDriver"
  ];
  const intelligenceKeys = ["translate.formal", "translate.casual", "translate.simple", "translate.explain", "translate.pronounce"];

  return `
    <section class="section-shell translator translator-premium">
      <div class="translator-hero">
        <p class="eyebrow">${t("common.aiPowered")}</p>
        <h1>${t("translate.translateHeroTitle")}</h1>
        <p>${t("translate.translateHeroSubtitle")}</p>
      </div>

      <div class="translation-card">
        <div class="translation-mode-cards" aria-label="${t("translate.translationModes")}">
          ${[
            ["translateTextMode", "translate.text", "translate.translateTextModeHint", "text"],
            ["recordMic", "translate.voice", "translate.translateVoiceModeHint", "voice"],
            ["translateCameraMode", "translate.camera", "translate.translateCameraModeHint", "camera"]
          ].map(([iconName, labelKey, hintKey, mode]) => `
            <button type="button" class="${state.translateInputMode === mode ? "is-active" : ""}" data-translate-mode="${mode}">
              ${icon(iconName)}
              <strong>${t(labelKey)}</strong>
              <span>${t(hintKey)}</span>
            </button>
          `).join("")}
        </div>
        <input type="file" accept="image/*" capture="environment" id="translation-camera-input" class="translation-camera-input" />

        <div class="translation-panels">
          <article class="translation-panel">
            <div class="translation-panel-top">
              <span>${t("translate.from")}</span>
              <select class="translation-select" aria-label="${t("common.inputLanguage")}" data-translate-from="true">
                ${["translate.language.langEnglish", ...TRANSLATE_LANGUAGE_KEYS.filter((key) => key !== "translate.language.langEnglish")].map((languageKey) => `<option value="${languageKey}" ${languageKey === state.translateFromLanguage ? "selected" : ""}>${TRANSLATE_LANGUAGE_FLAGS[languageKey]} ${t(languageKey)}</option>`).join("")}
              </select>
              <button type="button" class="translation-speak-button" data-translate-speak="from" aria-label="${t("translate.listenSource")}" ${state.translateInputText.trim() ? "" : "disabled"}>${icon("speaker")}</button>
            </div>
            ${state.translateVoiceNotice?.panel === "from" ? `<p class="translation-voice-notice">${escapeHtml(state.translateVoiceNotice.message)}</p>` : ""}
            ${state.translateVoiceError ? `<p class="translation-voice-notice is-error">${escapeHtml(state.translateVoiceError)}</p>` : ""}
            ${state.translateRecording ? `<p class="translation-recording-indicator"><span class="translation-recording-dot"></span>${t("translate.listening")}</p>` : ""}
            ${state.translateCameraStatus === "reading" ? `<p class="translation-recording-indicator"><span class="translation-recording-dot"></span>${t("translate.readingPhoto")} ${state.translateCameraProgress}%</p>` : ""}
            ${state.translateCameraStatus === "error" ? `<p class="translation-voice-notice is-error">${escapeHtml(state.translateCameraErrorMessage)}</p>` : ""}
            <div class="translation-input-wrap">
              <textarea id="translation-input" class="translation-input" placeholder="${t("translate.translatePlaceholder")}">${escapeHtml(state.translateInputText)}</textarea>
              <button type="button" class="translation-record-button ${state.translateRecording ? "is-recording" : ""}" data-translate-record="true" aria-label="${state.translateRecording ? t("translate.stopListening") : t("translate.tapToSpeak")}">${icon(state.translateRecording ? "stop" : "recordMic")}</button>
              ${state.translateInputText.length ? `<span class="translation-char-count">${state.translateInputText.length}</span>` : ""}
            </div>
          </article>

          <article class="translation-panel translation-panel-output">
            <div class="translation-panel-top">
              <span>${t("translate.to")}</span>
              <select class="translation-select" aria-label="${t("common.outputLanguage")}" data-translate-to="true">
                ${TRANSLATE_LANGUAGE_KEYS.map((languageKey) => `<option value="${languageKey}" ${languageKey === state.translateToLanguage ? "selected" : ""}>${TRANSLATE_LANGUAGE_FLAGS[languageKey]} ${t(languageKey)}</option>`).join("")}
              </select>
              <button type="button" class="translation-speak-button" data-translate-speak="to" aria-label="${t("translate.listenTranslation")}" ${state.translateStatus === "success" && state.translateOutputText.trim() ? "" : "disabled"}>${icon("speaker")}</button>
            </div>
            ${state.translateVoiceNotice?.panel === "to" ? `<p class="translation-voice-notice">${escapeHtml(state.translateVoiceNotice.message)}</p>` : ""}
            <div class="translation-output premium-output ${state.translateStatus === "error" ? "is-error" : ""}">
              ${state.translateStatus === "loading" ? `
                <strong class="translation-loading-label">${t("translate.translating")}<span class="translation-loading-dots"><span></span><span></span><span></span></span></strong>
              ` : state.translateStatus === "error" ? `
                <strong>${t("translate.translateErrorMessage")}</strong>
              ` : state.translateStatus === "success" ? `
                <p class="translation-result">${escapeHtml(state.translateOutputText)}</p>
              ` : `
                <strong>${t("translate.translationOutputTitle")}</strong>
                <p>${t("translate.translationOutput")}</p>
              `}
            </div>
          </article>
        </div>

        <div class="quick-language-row" aria-label="${t("translate.quickLanguages")}">
          ${TRANSLATE_LANGUAGE_KEYS.map((languageKey) => `
            <button type="button" class="${languageKey === state.translateToLanguage ? "is-selected" : ""}" data-translate-quick-lang="${languageKey}">
              <span aria-hidden="true">${TRANSLATE_LANGUAGE_FLAGS[languageKey]}</span> ${t(languageKey)}
            </button>
          `).join("")}
        </div>

        <div class="translation-actions">
          <button type="button" class="translation-submit-button" data-translate-action="true" ${state.translateStatus === "loading" || !state.translateInputText.trim() ? "disabled" : ""}>${state.translateStatus === "loading" ? t("translate.translating") : t("translate.translateAction")}</button>
          <div class="translation-actions-secondary">
            <button type="button" class="translation-swap-button" data-translate-swap="true" aria-label="${t("common.swapLanguages")}">${icon("swap")}</button>
            <button type="button" data-translate-clear="true">${t("common.clear")}</button>
            <button type="button" data-translate-copy="true" ${state.translateStatus === "success" && state.translateOutputText.trim() ? "" : "disabled"}>${t("common.copyResult")}</button>
          </div>
        </div>
      </div>

      <div class="translator-support-grid">
        <section class="smart-suggestions">
          <div class="section-title compact-title">
            <div><h2>${t("translate.smartSuggestions")}</h2><p>${t("translate.smartSuggestionsHint")}</p></div>
          </div>
          <div class="suggestion-chip-grid">
            ${suggestionKeys.map((key) => `<button>${t(key)}</button>`).join("")}
          </div>
        </section>

        <aside class="alwen-insight-panel">
          <span class="alwen-mini">${brandIconMarkup("app-icon")}</span>
          <div>
            <h3>${t("alwen.alwenTranslationInsightTitle")}</h3>
            <p>${t("alwen.alwenTranslationInsight")}</p>
            <div class="insight-chip-row">
              ${intelligenceKeys.map((key) => `<button>${t(key)}</button>`).join("")}
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

const BOOKING_SLOT_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];
const BOOKING_DAY_COUNT = 6;

/** Real slot logic, not decorative: for "today" only future slots are
 * offered (an hour of lead time), and each of the next few days gets a
 * fixed daily template — no different from how a real per-professional
 * calendar would be summarised before a backend exists to drive it. */
function bookingSlotsForDay(dayOffset) {
  if (dayOffset > 0) return BOOKING_SLOT_TIMES;
  const cutoffHour = new Date().getHours() + 1;
  return BOOKING_SLOT_TIMES.filter((time) => Number.parseInt(time.split(":")[0], 10) >= cutoffHour);
}

function bookingDayLabel(dayOffset) {
  if (dayOffset === "flexible") return t("booking.anytimeFlexible");
  if (dayOffset === 0) return t("common.today");
  if (dayOffset === 1) return t("common.tomorrow");
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return formatDate(date, { weekday: "short", day: "numeric", month: "short" });
}

function renderBookingSheet() {
  const person = state.publicProfile;
  if (!person) return "";

  if (state.bookingConfirmed) {
    const booking = state.bookingConfirmed;
    return `
      <div class="sheet-backdrop" data-sheet-close="true">
        <section class="selection-sheet booking-sheet" aria-label="${t("booking.bookingConfirmedTitle")}">
          <div class="sheet-handle"></div>
          <div class="post-request-success">
            <span class="post-request-success-icon">${icon("verify")}</span>
            <h2>${t("booking.bookingConfirmedTitle")}</h2>
            <p>${t("booking.bookingConfirmedHint").replace("{name}", escapeHtml(person.name))}</p>
            <blockquote>${escapeHtml(booking.date)}</blockquote>
            <button type="button" class="auth-primary-button" data-role="close-booking-sheet">${t("common.close")}</button>
            <button type="button" class="auth-link" data-role="view-my-bookings">${t("booking.viewMyBookings")}</button>
          </div>
        </section>
      </div>
    `;
  }

  const draft = state.bookingDraft;
  const isFlexible = draft.dateIndex === "flexible";
  const hasSpecificDay = draft.dateIndex !== null && !isFlexible;
  const slots = hasSpecificDay ? bookingSlotsForDay(draft.dateIndex) : [];
  const canConfirm = isFlexible || (hasSpecificDay && Boolean(draft.time));

  return `
    <div class="sheet-backdrop" data-sheet-close="true">
      <section class="selection-sheet booking-sheet" aria-label="${t("booking.bookingSheetTitle").replace("{name}", person.name)}">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <div>
            <h2>${t("booking.bookingSheetTitle").replace("{name}", escapeHtml(person.name))}</h2>
            <p>${t("booking.bookingSheetHint")}</p>
          </div>
          <button data-sheet-close="true" aria-label="${t("common.close")}">×</button>
        </div>

        <p class="booking-section-label">${t("booking.chooseDate")}</p>
        <div class="chip-row booking-day-row">
          ${Array.from({ length: BOOKING_DAY_COUNT }, (_, dayOffset) => `
            <button type="button" class="chip ${draft.dateIndex === dayOffset ? "is-active" : ""}" data-booking-day="${dayOffset}">${bookingDayLabel(dayOffset)}</button>
          `).join("")}
          <button type="button" class="chip booking-flexible-chip ${isFlexible ? "is-active" : ""}" data-booking-day="flexible">${icon("calendar")}${t("booking.anytimeFlexible")}</button>
        </div>

        ${isFlexible ? `<p class="booking-flexible-hint">${t("booking.anytimeFlexibleHint")}</p>` : ""}

        ${hasSpecificDay ? `
          <p class="booking-section-label">${t("booking.chooseTime")}</p>
          ${slots.length ? `
            <div class="chip-row booking-time-row">
              ${slots.map((time) => `<button type="button" class="chip ${draft.time === time ? "is-active" : ""}" data-booking-time="${time}">${time}</button>`).join("")}
            </div>
          ` : `<p class="booking-no-slots">${t("booking.noSlotsToday")}</p>`}
        ` : ""}

        <button type="button" class="auth-primary-button booking-confirm-button" data-role="confirm-booking" ${canConfirm ? "" : "disabled"}>${t("booking.confirmBooking")}</button>
      </section>
    </div>
  `;
}

function submitBooking() {
  const person = state.publicProfile;
  const draft = state.bookingDraft;
  const isFlexible = draft.dateIndex === "flexible";
  if (!person || draft.dateIndex === null || (!isFlexible && !draft.time)) return;

  const booking = {
    id: Date.now(),
    target: person.name,
    type: person.category || t("entity.professional"),
    date: isFlexible ? bookingDayLabel("flexible") : `${bookingDayLabel(draft.dateIndex)} · ${draft.time}`,
    status: "Confirmed",
    party: person.price || ""
  };

  reservations.unshift(booking);
  trackEvent("booking_confirmed", { professional: person.name, dayOffset: draft.dateIndex, time: draft.time || "flexible" });
  state.bookingConfirmed = booking;
  render();
}

function resetBookingDraft() {
  state.bookingDraft = { dateIndex: null, time: null };
  state.bookingConfirmed = null;
  state.activeSheet = null;
  render();
}

const PUBLIC_PROFILE_CONTEXT_HINT = {
  community: "profile.public.publicProfileContextCommunity",
  marketplace: "profile.public.publicProfileContextMarketplace",
  hire: "profile.public.publicProfileContextHire",
  review: "profile.public.publicProfileContextReview"
};

/** Everything below reads only real, currently-tracked fields — Supabase
 * Auth's own email/phone verification flags, public_profiles.verification_
 * status, real listing rows the user actually created. There is no reviews/
 * completed-job/response-time tracking anywhere in this app yet (see
 * supabase/migrations — the reviews table exists but nothing ever queries
 * it), so those simply aren't shown rather than being invented. */

function profileVerificationBadges(user) {
  const badges = [];
  if (user.emailVerified) badges.push({ icon: "verify", labelKey: "profile.identity.emailVerified" });
  if (user.phoneVerified) badges.push({ icon: "verify", labelKey: "profile.identity.phoneVerified" });
  if (user.publicProfile?.verification_status === "verified") badges.push({ icon: "verify", labelKey: "profile.identity.identityVerified" });
  return badges;
}

function profileMemberSince(user) {
  return user.createdAt ? formatDate(user.createdAt, { year: "numeric", month: "long" }) : null;
}

function profilePrimaryRoleLabel(user) {
  return user.role && user.role.trim() ? escapeHtml(user.role.trim()) : t("profile.identity.memberDefaultRole");
}

/** A simple, honest completeness check — not a trust score. Each item is
 * something the user directly controls and can see reflected immediately. */
function profileCompletenessPercent(user) {
  const checks = [Boolean(user.avatar), Boolean(user.role && user.role.trim()), Boolean(user.emailVerified), state.myListings.length > 0 || ownedBusinesses().length > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/** Derived from real, verifiable conditions only, recomputed on every
 * render rather than stored — each one names exactly what earned it and
 * links back to a real timestamp instead of a fabricated "earned" date. */
function deriveRealAchievements(user) {
  const achievements = [];
  if (user.emailVerified) {
    achievements.push({ icon: "verify", titleKey: "profile.achievements.verifiedIdentityTitle", detailKey: "profile.achievements.verifiedIdentityDetail", date: profileMemberSince(user) });
  }
  if (state.myListings.length > 0) {
    const earliest = [...state.myListings].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    achievements.push({
      icon: "tag",
      titleKey: "profile.achievements.firstListingTitle",
      detailKey: "profile.achievements.firstListingDetail",
      date: earliest.created_at ? formatDate(earliest.created_at, { year: "numeric", month: "long" }) : null
    });
  }
  if (ownedBusinesses().length > 0) {
    achievements.push({ icon: "shop", titleKey: "profile.achievements.businessOwnerTitle", detailKey: "profile.achievements.businessOwnerDetail", date: profileMemberSince(user) });
  }
  return achievements.slice(0, 3);
}

/** "Recent activity" is real listing-creation events — genuine things the
 * user actually did — not a fabricated completed-job/transaction timeline. */
function deriveRealActivity() {
  return [...state.myListings]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3)
    .map((item) => ({ title: item.title, date: item.created_at ? formatDate(item.created_at, { day: "numeric", month: "short" }) : "" }));
}

function renderPublicProfile() {
  const person = state.publicProfile;
  if (!person) return renderProfileSignedOut();
  const isBlocked = state.blockedPeople.includes(person.name);
  const metaLine = [person.category, person.area, city.name].filter(Boolean).join(" · ");
  const contextKey = PUBLIC_PROFILE_CONTEXT_HINT[person.context];
  const skillsList = (person.skills || "").split(",").map((skill) => skill.trim()).filter(Boolean);
  const isHireContext = person.context === "hire";

  const stats = [
    person.rating ? { label: t("common.rating"), value: `${icon("star")} ${person.rating}${person.reviews ? ` (${person.reviews})` : ""}` } : null,
    person.price ? { label: t("field.budget"), value: escapeHtml(person.price) } : null,
    person.availability ? { label: t("common.available"), value: escapeHtml(person.availability) } : null,
    person.distance ? { label: t("common.distance"), value: escapeHtml(person.distance) } : person.responseTime ? { label: t("common.responseTime"), value: escapeHtml(person.responseTime) } : null
  ].filter(Boolean);

  return `
    <section class="section-shell profile-panel">
      <button type="button" class="back-button" data-view="home">${icon("arrow")}${t("common.close")}</button>
      <div class="public-profile-identity">
        <span class="avatar-frame public-profile-avatar">
          ${person.avatar ? `<img class="profile-portrait" src="${escapeHtml(person.avatar)}" alt="" />` : `<span class="public-profile-initials">${escapeHtml(initials(person.name))}</span>`}
        </span>
        <div>
          <p class="eyebrow">${t("profile.public.publicProfileEyebrow")}</p>
          <h1>${escapeHtml(person.name)}${person.verified ? verifiedCheck(t("status.verified")) : ""}</h1>
          ${metaLine ? `<p class="public-profile-meta">${escapeHtml(metaLine)}</p>` : ""}
        </div>
      </div>

      ${stats.length ? `
        <div class="public-profile-decision-strip">
          ${stats.map((stat) => `<div class="decision-stat"><span>${stat.label}</span><strong>${stat.value}</strong></div>`).join("")}
        </div>
      ` : ""}

      ${contextKey ? `<p class="public-profile-context-hint">${t(contextKey)}</p>` : ""}

      <div class="public-profile-primary-actions">
        ${isHireContext ? `<button type="button" class="auth-primary-button" data-person-action="book">${t("common.bookNow")}</button>` : ""}
        <button type="button" class="${isHireContext ? "auth-link" : "auth-primary-button"}" data-person-action="message">${t("common.messagePersonCta")}</button>
      </div>

      ${
        person.listings?.length
          ? `<div class="profile-visual-section">
               <div class="section-title"><div><h2>${t("profile.public.activeListings")}</h2></div></div>
               <div class="my-business-list">
                 ${person.listings
                   .map(
                     (item) => `
                   <button type="button" class="my-business-row" data-view="listingDetail" data-listing-id="${item.id}">
                     <div>
                       <strong>${escapeHtml(item.title)}</strong>
                       <span>${categoryLabel(Object.keys(LISTING_CATEGORY_TO_DB).find((key) => LISTING_CATEGORY_TO_DB[key] === item.category) || "buy-sell")} · ${formatListingPrice(item.price_amount, item.price_period, item.price_currency)}</span>
                     </div>
                     ${icon("arrow")}
                   </button>`
                   )
                   .join("")}
               </div>
             </div>`
          : ""
      }

      ${skillsList.length ? `
        <div class="profile-visual-section">
          <div class="section-title"><div><h2>${t("profile.reputation.skillsExpertiseTitle")}</h2></div></div>
          <div class="quote-list">${skillsList.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
        </div>
      ` : ""}

      <div class="public-profile-secondary-actions">
        <span class="badge offeror-status-badge">${person.context === "hire" ? "Trader/business" : "Private seller/provider"}</span>
        <button type="button" data-report-target="user" data-report-id="${escapeHtml(person.id)}">Report user</button>
        <button type="button" data-person-action="block" ${isBlocked ? "disabled" : ""}>${isBlocked ? t("common.blockedConfirmation") : t("common.blockPersonCta")}</button>
      </div>
    </section>
  `;
}

function renderProfileSignedOut() {
  return `
    <section class="section-shell auth-shell">
      <div class="auth-card">
        <p class="eyebrow">${t("nav.profile")}</p>
        <h1>${t("profile.signedOut.profileSignedOutTitle")}</h1>
        <p class="auth-hint">${t("profile.signedOut.profileSignedOutHint")}</p>
        <button type="button" class="auth-primary-button" data-auth-view="login">${t("profile.signedOut.profileSignInCta")}</button>
        <button type="button" class="auth-link" data-view="settings">${t("settings.settingsTitle")}</button>
      </div>
    </section>
  `;
}

function renderProfile() {
  if (state.auth.status !== "signedIn") return renderProfileSignedOut();
  const user = state.auth.user;
  const badges = profileVerificationBadges(user);
  const memberSince = profileMemberSince(user);
  const completeness = profileCompletenessPercent(user);
  const achievements = deriveRealAchievements(user);
  const activity = deriveRealActivity();
  const savedCount = state.savedPlaceIds.length + state.savedListingIds.length;
  const ownOfferorStatus = state.myListings.some((item) => item.metadata?.offerorStatus === "trader") ? "Trader/business" : state.myListings.length ? "Private seller/provider" : null;

  return `
    <section class="section-shell profile-panel identity-profile">
      <div class="identity-hero">
        <button type="button" class="identity-edit-button" data-settings-edit-profile="true" aria-label="${t("profile.quickActions.editProfileAction")}">${icon("ops")}</button>
        <span class="avatar-frame identity-avatar">
          ${user.avatar ? `<img class="profile-portrait" src="${escapeHtml(user.avatar)}" alt="" />` : `<span class="profile-portrait profile-portrait-fallback">${icon("profile")}</span>`}
        </span>
        <h1>${escapeHtml(user.name)}</h1>
        <p class="identity-role">${profilePrimaryRoleLabel(user)}</p>
        ${ownOfferorStatus ? `<span class="badge offeror-status-badge">${ownOfferorStatus}</span>` : ""}
        <p class="identity-meta">${joinNonEmpty([escapeHtml(user.publicProfile?.city || city.name), memberSince ? t("profile.identity.memberSince", { date: memberSince }) : null])}</p>
        ${badges.length ? `<div class="quote-list identity-badges">${badges.map((badge) => `<span class="verified-chip">${icon(badge.icon)}${t(badge.labelKey)}</span>`).join("")}</div>` : ""}
      </div>

      ${
        completeness < 100
          ? `<div class="profile-completeness">
               <div class="profile-completeness-row"><span>${t("profile.completeness.title")}</span><strong>${completeness}%</strong></div>
               <div class="profile-completeness-bar"><span style="width:${completeness}%"></span></div>
             </div>`
          : ""
      }

      ${renderProfileQuickActions()}
      ${renderMyListings()}
      ${renderMyHelpRequests()}
      ${renderMyBusinesses()}

      <div class="settings-section trust-section">
        <div class="section-title"><div><h2>${t("profile.trust.title")}</h2><p>${t("profile.trust.hint")}</p></div></div>
        <p class="trust-headline">${t("profile.trust.buildingTrust")}</p>
        ${
          badges.length
            ? `<div class="quote-list identity-badges">${badges.map((badge) => `<span class="verified-chip">${icon(badge.icon)}${t(badge.labelKey)}</span>`).join("")}</div>`
            : `<p class="settings-section-hint">${t("profile.trust.noVerificationYet")}</p>`
        }
        <details class="trust-details">
          <summary>${t("profile.trust.howCalculated")}</summary>
          <ul>
            <li>${t("profile.trust.factorIdentity")}</li>
            <li>${t("profile.trust.factorTransactions")}</li>
            <li>${t("profile.trust.factorReviews")}</li>
            <li>${t("profile.trust.factorResponse")}</li>
            <li>${t("profile.trust.factorCommunity")}</li>
          </ul>
        </details>
      </div>

      <div class="settings-section">
        <div class="section-title"><div><h2>${t("profile.activity.title")}</h2></div></div>
        ${
          activity.length
            ? `<div class="timeline-list">${activity.map((item) => `<article><span>${item.date}</span><div><h3>${escapeHtml(item.title)}</h3><p>${t("profile.activity.published")}</p></div></article>`).join("")}</div>`
            : `<p class="settings-section-hint">${t("profile.activity.empty")}</p>`
        }
      </div>

      ${
        achievements.length
          ? `<div class="settings-section">
               <div class="section-title"><div><h2>${t("profile.achievements.achievements")}</h2></div></div>
               <div class="achievement-grid">
                 ${achievements
                   .map(
                     (item) => `
                   <article>
                     <span>${icon(item.icon)}</span>
                     <h3>${t(item.titleKey)}</h3>
                     <p>${t(item.detailKey)}</p>
                     ${item.date ? `<span class="achievement-date">${item.date}</span>` : ""}
                   </article>`
                   )
                   .join("")}
               </div>
             </div>`
          : ""
      }

      <div class="profile-list">
        <button type="button" data-view="savedPlaces"><strong>${savedCount}</strong><span>${t("profile.savedPlaces")}</span></button>
        <button type="button" data-view="settings">${t("settings.settingsTitle")}</button>
      </div>
    </section>
  `;
}

function renderProfileQuickActions() {
  const actions = [
    ["profile.quickActions.editProfileAction", "verify", "completeProfile"],
    ["profile.quickActions.savedPlacesAction", "heart", "savedPlaces"],
    ...(ownedBusinesses().length ? [["profile.business.myBusinessesAction", "shop", "businessDashboard"]] : []),
    ["settings.settingsAction", "ops", "settings"],
    ["common.signOut", "exit", "signOut"]
  ];
  const attrsFor = (view) => {
    if (view === "completeProfile") return 'data-settings-edit-profile="true"';
    if (view === "signOut") return 'data-profile-signout="true"';
    return `data-view="${view}"`;
  };
  return `
    <div class="profile-quick-actions">
      ${actions.map(([labelKey, iconName, view]) => `
        <button type="button" class="profile-quick-action" ${attrsFor(view)}>
          <span class="profile-quick-action-icon">${icon(iconName)}</span>
          <span>${t(labelKey)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

/** state.myListings holds real rows straight from the listings table
 * (populated by refreshMyListings()), so field names here are the DB's own
 * (price_amount, price_period, price_currency) rather than the mock
 * display shape renderMarketplaceListing() expects — this is a different,
 * simpler card, not a reuse of that component. */
function renderMyListings() {
  if (state.auth.status !== "signedIn" || !state.myListings.length) return "";
  return `
    <div class="settings-section">
      <h3>${t("createListing.myListingsTitle")}</h3>
      <div class="my-business-list">
        ${state.myListings
          .map(
            (item) => `
          <button type="button" class="my-business-row" data-view="listingDetail" data-listing-id="${item.id}">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${categoryLabel(Object.keys(LISTING_CATEGORY_TO_DB).find((key) => LISTING_CATEGORY_TO_DB[key] === item.category) || "buy-sell")} · ${t(`status.${item.status}`) || item.status}</span>
            </div>
            ${icon("arrow")}
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

/** state.myHelpRequests holds real rows straight from the help_requests
 * table (populated by refreshMyHelpRequests()) — mirrors renderMyListings()
 * above. There's no dedicated per-request detail screen, so each row just
 * opens Hire, where the request also appears in the general list. */
function renderMyHelpRequests() {
  if (state.auth.status !== "signedIn" || !state.myHelpRequests.length) return "";
  return `
    <div class="settings-section">
      <h3>${t("needHelp.myRequestsTitle")}</h3>
      <div class="my-business-list">
        ${state.myHelpRequests
          .map((item) => {
            const matchedCategory = professionalCategories.find((category) => category.value.toLowerCase() === String(item.category || "").toLowerCase());
            return `
          <button type="button" class="my-business-row" data-view="hire">
            <div>
              <strong>${escapeHtml(item.description)}</strong>
              <span>${matchedCategory ? t(matchedCategory.labelKey) : escapeHtml(item.category)} · ${t(`status.${item.status}`) || item.status}</span>
            </div>
            ${icon("arrow")}
          </button>
        `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderMyBusinesses() {
  const owned = ownedBusinesses();
  if (!owned.length) return "";
  return `
    <div class="settings-section">
      <h3>${t("profile.business.myBusinessesTitle")}</h3>
      <div class="my-business-list">
        ${owned.map((item) => `
          <button type="button" class="my-business-row" data-view="businessDashboard" data-place-id="${item.id}">
            <div class="my-business-photo" style="background-image: url('${item.photoUrl}')"></div>
            <div>
              <strong>${item.name}</strong>
              <span>${businessCategoryLabel(item.category)}${item.boosted ? ` · ${t("business.dashboard.businessBoostToggle")}` : ""}</span>
            </div>
            ${icon("arrow")}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderOps() {
  return `
    <section class="section-shell">
      <div class="screen-heading">
        <p class="eyebrow">${t("nav.ops")}</p>
        <h1>${t("common.opsTitle")}</h1>
      </div>
      <div class="ops-list">
        ${adminStats.map((stat) => `<article><strong>${stat.value}</strong><span>${t(stat.labelKey)}</span><em>${stat.trend}</em></article>`).join("")}
      </div>
      <div class="ops-actions">
        ${[
          ["marketplace", "nav.marketplace"],
          ["businesses", "nav.businesses"],
          ["hire", "nav.hire"],
          ["offers", "nav.offers"],
          ["reservations", "nav.reservations"],
          ["cityImport", "import.cityImport"]
        ].map(([view, labelKey]) => `<button data-view="${view}">${t(labelKey)}<span>${t("common.manage")}</span></button>`).join("")}
      </div>
      ${renderAlwenBusinessCreator()}
      ${renderCityGraph()}
      ${renderCityImport()}
      <div class="integration-list">
        ${integrations.map((item) => `<article><strong>${t(item.titleKey)}</strong><p>${item.description}</p></article>`).join("")}
      </div>
    </section>
  `;
}

function renderAlwenBusinessCreator() {
  const draftRows = [
    ["field.name", alwenBusinessDraft.name],
    ["field.cuisine", alwenBusinessDraft.cuisine],
    ["field.openingHours", alwenBusinessDraft.openingHours],
    ["nav.reservations", alwenBusinessDraft.reservationSettings],
    ["field.location", alwenBusinessDraft.locationPlaceholder],
    ["business.claim.cta", alwenBusinessDraft.claimStatus]
  ];

  return `
    <section class="alwen-card">
      <div class="section-title">
        <div><h2>${t("alwen.alwenBusinessTitle")}</h2><p>${t("alwen.alwenBusinessHint")}</p></div>
      </div>
      <div class="alwen-prompt">${icon("spark")}<p>${alwenBusinessDraft.prompt}</p></div>
      <p class="draft-description">${alwenBusinessDraft.description}</p>
      <div class="draft-grid">${draftRows.map(([label, value]) => `<article><span>${t(label)}</span><strong>${value}</strong></article>`).join("")}</div>
      <div class="quote-list">${[...alwenBusinessDraft.categories, ...alwenBusinessDraft.popularKeywords].map((item) => `<span>${item}</span>`).join("")}</div>
      <div class="draft-list"><strong>${t("common.menuSections")}</strong><p>${alwenBusinessDraft.menuSections.join(" · ")}</p></div>
      <div class="draft-list"><strong>${t("common.suggestedPhotos")}</strong><p>${alwenBusinessDraft.suggestedPhotos.join(" · ")}</p></div>
      <div class="draft-actions"><button>${t("common.improveWithAlwen")}</button><button>${t("common.reviewPublish")}</button></div>
    </section>
  `;
}

function renderCityGraph() {
  return `
    <div class="section-title">
      <div><h2>${t("import.graph.cityGraph")}</h2><p>${t("import.graph.cityGraphHint")}</p></div>
    </div>
    <div class="ops-list">
      ${Object.entries(cityGraph).map(([key, value]) => `<article><strong>${value}</strong><span>${key.replace(/([A-Z])/g, " $1")}</span></article>`).join("")}
    </div>
  `;
}

function renderCityImportRunner() {
  const run = state.cityImportRun;
  const categoryOptions = IMPORT_SOURCE_CATEGORIES[run.source];
  return `
    <div class="import-runner">
      <div class="section-title">
        <div><h2>${t("common.runNewImport")}</h2><p>${t("common.runNewImportHint")}</p></div>
      </div>
      <div class="import-controls">
        <label>
          <span>${t("import.importSourceLabel")}</span>
          <select data-role="import-source">
            ${Object.entries(IMPORT_SOURCE_LABELS).map(([value, label]) => `<option value="${value}" ${run.source === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>${t("import.importCategoryLabel")}</span>
          <select data-role="import-category">
            ${categoryOptions.map((option) => `<option value="${option.value}" ${run.category === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>${t("common.chooseArea")}</span>
          <select data-role="import-area">
            ${["Vilnius", ...neighbourhoods].map((area) => `<option value="${area}" ${run.area === area ? "selected" : ""}>${area}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>${t("import.importModeLabel")}</span>
          <select data-role="import-mode">
            <option value="nearby" ${run.mode === "nearby" ? "selected" : ""}>${t("import.importModeNearby")}</option>
            <option value="district" ${run.mode === "district" ? "selected" : ""}>${t("import.importModeDistrict")}</option>
            <option value="citywide" ${run.mode === "citywide" ? "selected" : ""}>${t("import.importModeCitywide")}</option>
          </select>
        </label>
        <button data-action="run-import" ${run.status === "loading" ? "disabled" : ""}>${run.status === "loading" ? t("import.importRunning") : t("common.runImport")}</button>
        <button type="button" class="ghost" data-action="clear-import-cache">${t("common.clearCache")}</button>
      </div>
      ${
        run.attribution
          ? `<p class="import-attribution">${run.fromCache ? `${t("status.fromCache")} · ` : ""}${run.attribution}${run.lastRunAt ? ` · ${t("common.lastUpdated")} ${new Date(run.lastRunAt).toLocaleString()}` : ""}</p>`
          : ""
      }
      ${run.error ? `<p class="import-warning">${t("import.importFallbackNotice")}</p>` : ""}
      ${
        run.results.length
          ? `<p class="import-attribution">${t("common.showingPreviewOf").replace("{shown}", run.results.length).replace("{total}", run.totalFound)}</p>
             <div class="import-preview-list">${run.results.map(renderImportPreviewCard).join("")}</div>`
          : ""
      }
      ${renderTrancheImportPanel()}
    </div>
  `;
}

function renderTrancheImportPanel() {
  const { tranche, mode } = state.cityImportRun;
  const totals = tranche.results.reduce(
    (acc, row) => ({
      totalFound: acc.totalFound + row.totalFound,
      imported: acc.imported + row.imported,
      duplicates: acc.duplicates + row.duplicates,
      missingPhoto: acc.missingPhoto + row.missingPhoto,
      missingAddress: acc.missingAddress + row.missingAddress
    }),
    { totalFound: 0, imported: 0, duplicates: 0, missingPhoto: 0, missingAddress: 0 }
  );
  return `
    <div class="tranche-import">
      <div class="section-title">
        <div><h2>${t("common.runTrancheImport")}</h2><p>${t("common.runTrancheImportHint")}</p></div>
        <button type="button" data-action="run-tranche-import" ${tranche.running ? "disabled" : ""}>${tranche.running ? t("import.tranche.trancheRunning").replace("{category}", tranche.currentCategory || "") : `${t("common.runTrancheImport")} · ${IMPORT_MODE_RADIUS[mode] / 1000} km`}</button>
      </div>
      ${
        tranche.results.length
          ? `<div class="tranche-summary">
               ${tranche.results.map((row) => `
                 <article class="tranche-row">
                   <span class="tranche-row-category">${row.category}</span>
                   <span class="tranche-row-stats">${row.totalFound} ${t("import.tranche.trancheFound")} · ${row.imported} ${t("import.tranche.trancheImported")} · ${row.duplicates} ${t("import.tranche.trancheSkipped")}${row.fromCache ? ` · ${t("status.fromCache")}` : ""}</span>
                   <span class="tranche-row-stats tranche-row-quality">${row.missingPhoto} ${t("import.tranche.trancheMissingPhoto")} · ${row.missingAddress} ${t("import.tranche.trancheMissingAddress")} · ${t("business.updatedLabel")} ${formatDate(row.lastUpdated)}</span>
                 </article>
               `).join("")}
             </div>
             <p class="import-attribution">${totals.totalFound} ${t("import.tranche.trancheFound")} · ${totals.imported} ${t("import.tranche.trancheImported")} · ${totals.duplicates} ${t("import.tranche.trancheSkipped")} · ${totals.missingPhoto} ${t("import.tranche.trancheMissingPhoto")} · ${totals.missingAddress} ${t("import.tranche.trancheMissingAddress")}</p>`
          : ""
      }
    </div>
  `;
}

function renderImportPreviewCard(entity) {
  return `
    <article class="import-preview-card">
      <div class="import-preview-head">
        <h3>${entity.name}</h3>
        ${
          entity.isDuplicate
            ? `<span class="badge badge-duplicate">${t("status.duplicate")}</span>`
            : entity.published
              ? `<span class="badge badge-workmode">${t("status.published")}</span>`
              : ""
        }
      </div>
      <p>${entity.category} · ${entity.address || entity.neighbourhood || "—"}</p>
      <p class="import-ai-summary">${icon("spark")}${entity.aiSummary}</p>
      ${
        entity.validationWarnings.length
          ? `<div class="tag-row">${entity.validationWarnings.map((warning) => `<span>${warning}</span>`).join("")}</div>`
          : ""
      }
      <div class="trust-row">
        <span>${entity.source}</span>
        <span>${entity.lastUpdated}</span>
      </div>
      <button data-action="publish-import" data-entity-id="${entity.id}" ${entity.isDuplicate || entity.published ? "disabled" : ""}>${entity.published ? t("status.published") : t("common.publishImport")}</button>
    </article>
  `;
}

function renderCityImport() {
  return `
    <section class="city-import">
      <div class="section-title">
        <div><h2>${t("import.cityImport")}</h2><p>${t("import.cityImportHint")}</p></div>
      </div>
      ${renderCityImportRunner()}
      <div class="section-title">
        <div><h2>${t("common.liveDirectory")}</h2><p>${t("common.liveDirectoryHint").replace("{count}", SEED_CITY_META.totalEntities).replace("{date}", SEED_CITY_META.generatedAt)}</p></div>
      </div>
      <div class="import-source-grid">
        ${Object.entries(SEED_CITY_META.byCategory).map(([category, count]) => `
          <article>
            <span class="badge">${category}</span>
            <h3>${count}</h3>
            <p>${t("common.seedRecords")}</p>
          </article>
        `).join("")}
      </div>
      <p class="import-attribution">${SEED_CITY_META.attributions.join(" · ")}</p>
      <div class="import-source-grid">
        ${importSources.map((source) => `
          <article>
            <span class="badge">${source.status}</span>
            <h3>${source.name}</h3>
            <p>${source.records} ${t("common.sampleRecords")} · ${source.lastRun}</p>
            <div class="tag-row">${source.fields.slice(0, 4).map((field) => `<span>${field}</span>`).join("")}</div>
          </article>
        `).join("")}
      </div>
      <p class="import-attribution">${t("common.showingPreviewOf").replace("{shown}", Math.min(24, importedBusinesses.length)).replace("{total}", importedBusinesses.length)}</p>
      <div class="imported-list">
        ${importedBusinesses.slice(0, 24).map(renderPlaceCard).join("")}
      </div>
      ${renderClaimFlow()}
    </section>
  `;
}

/** Wolt-style colourful category grid — a handful of tone tiles cycled
 * across however many categories there are, so the grid reads as
 * scannable/colourful without needing a bespoke colour per category.
 * tiles: [{ label, iconGlyph, isActive, attrs }], attrs is a raw string
 * of data-* attributes (e.g. `data-category="x" data-target-view="y"`)
 * so the existing click handlers for each caller keep working unchanged. */
const CATEGORY_TILE_TONES = ["mint", "gold", "sky", "rose"];

function renderCategoryTileGrid(tiles) {
  return `
    <div class="category-tile-grid" role="list">
      ${tiles
        .map(
          (tile, index) => `
            <button type="button" class="category-tile tone-${CATEGORY_TILE_TONES[index % CATEGORY_TILE_TONES.length]} ${tile.isActive ? "is-active" : ""}" ${tile.attrs}>
              <span class="category-tile-icon">${tile.iconGlyph}</span>
              <span class="category-tile-label">${tile.label}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

/** Compact pill-row version of the same tile data — used on the full
 * Marketplace/Explore results pages instead of renderCategoryTileGrid's
 * big boxes, since the box grid is what the picker screen in front of
 * this page already showed; repeating it here just to let someone
 * switch category reads as a second picker, not a filter. Same
 * {label, iconGlyph, isActive, attrs} tile shape, so callers can reuse
 * whatever list they already built for the box grid version. */
function renderCategoryChipRow(tiles) {
  return `
    <div class="chip-row explore-category-row" role="list">
      ${tiles
        .map(
          (tile) => `
            <button type="button" class="${tile.isActive ? "is-selected" : ""}" ${tile.attrs}>
              <span aria-hidden="true">${tile.iconGlyph}</span> ${tile.label}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

/** Real, colourful emoji instead of the app's usual minimal line-icons —
 * deliberately a different, richer register for this one "browse by
 * category" picker, matching the emoji already used for individual
 * business subcategory badges elsewhere (SUBCATEGORY_ICON below) rather
 * than inventing a new icon language. */
const EXPLORE_CATEGORY_EMOJI = {
  "Food & Drink": "🍽️",
  Groceries: "🛒",
  Pharmacy: "💊",
  Healthcare: "🏥",
  Hotels: "🏨",
  Shops: "🛍️",
  "Beauty & Wellness": "💆",
  Transport: "🚌",
  "Public Services": "🏛️",
  Attractions: "🎡",
  Parks: "🌳",
  Finance: "🏦",
  Education: "🎓",
  Nightlife: "🌃",
  Automobile: "🚗",
  "Pet Services": "🐾",
  "Home Services": "🏠"
};

/** One-line editorial taglines shown under the section title when a
 * specific category is selected on Explore, so each destination reads
 * with its own personality instead of the generic "Places, services and
 * experiences nearby." repeated everywhere. Pure copy, not derived from
 * data — same category of decision as any other static UI string in
 * this file (rail hints, empty-state text). */
const EXPLORE_CATEGORY_TAGLINE = {
  All: "explore.category.taglineAll",
  "Food & Drink": "explore.category.taglineFoodDrink",
  Groceries: "explore.category.taglineGroceries",
  Pharmacy: "explore.category.taglinePharmacy",
  Healthcare: "explore.category.taglineHealthcare",
  Hotels: "explore.category.taglineHotels",
  Shops: "explore.category.taglineShops",
  "Beauty & Wellness": "explore.category.taglineBeautyWellness",
  Transport: "explore.category.taglineTransport",
  "Public Services": "explore.category.taglinePublicServices",
  Attractions: "explore.category.taglineAttractions",
  Parks: "explore.category.taglineParks",
  Finance: "explore.category.taglineFinance",
  Education: "explore.category.taglineEducation",
  Nightlife: "explore.category.taglineNightlife",
  Automobile: "explore.category.taglineAutomobile",
  "Pet Services": "explore.category.taglinePetServices",
  "Home Services": "explore.category.taglineHomeServices"
};

const MARKETPLACE_CATEGORY_EMOJI = {
  "buy-sell": "🏷️",
  rentals: "🔑",
  jobs: "💼",
  services: "🛠️",
  vehicles: "🚗",
  property: "🏘️",
  "business-listings": "🏢",
  "community-requests": "🤝"
};

const CATEGORY_ICON = {
  "Food & Drink": "◒",
  Nightlife: "◐",
  Groceries: "▥",
  Pharmacy: "✚",
  Healthcare: "⚕",
  Hotels: "⌂",
  Shops: "◇",
  "Beauty & Wellness": "✿",
  Transport: "➜",
  "Public Services": "▦",
  Attractions: "★",
  Parks: "✤",
  Finance: "€",
  Education: "◫",
  Automobile: "▲",
  "Pet Services": "●",
  "Home Services": "⌂"
};

/** Real subcategory strings (OSM/Wikidata `subcategory` values, lowercased)
 * mapped to a distinct emoji each — CATEGORY_ICON above is too coarse to
 * tell a Cafe from a Restaurant or a Bank from an ATM since they share one
 * top-level category. This is purely a richer icon lookup, not new data:
 * every key here is a subcategory value that already exists in the real
 * imported records. */
const SUBCATEGORY_ICON = {
  cafe: "☕",
  restaurant: "🍽️",
  bakery: "🥐",
  bar: "🍸",
  pub: "🍺",
  nightclub: "🪩",
  hotel: "🏨",
  guesthouse: "🛏️",
  hostel: "🛏️",
  pharmacy: "💊",
  dentist: "🦷",
  "doctor's office": "🩺",
  clinic: "🏥",
  hospital: "🏥",
  supermarket: "🛒",
  "convenience store": "🏪",
  bookshop: "📚",
  "clothing store": "👗",
  "shopping mall": "🏬",
  "hair salon": "💇",
  "beauty salon": "💅",
  gym: "🏋️",
  "yoga studio": "🧘",
  museum: "🏛️",
  landmark: "🏛️",
  memorial: "🗿",
  park: "🌳",
  bank: "🏦",
  atm: "💳",
  library: "📖",
  "post office": "📮",
  "bus stop": "🚌",
  "tram stop": "🚊",
  parking: "🅿️",
  "car repair": "🔧",
  "car dealer": "🚗",
  tyres: "🛞",
  "petrol station": "⛽",
  "veterinary clinic": "🐾",
  "pet boarding": "🐕",
  "pet shop": "🐾",
  "pet grooming": "✂️",
  plumber: "🔧",
  electrician: "⚡",
  carpenter: "🪚",
  painter: "🖌️",
  locksmith: "🔐",
  gardener: "🌿"
};

/** Best available icon for a place: a distinct emoji for its real
 * subcategory when we recognise it, falling back to the coarser
 * top-level CATEGORY_ICON glyph, then a generic placeholder. */
function categoryIconFor(item) {
  const subcategoryIcon = SUBCATEGORY_ICON[(item?.subcategory || "").trim().toLowerCase()];
  return subcategoryIcon || CATEGORY_ICON[item?.category] || "◈";
}

function categorySlug(category) {
  return (category || "uncategorised").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const BUSINESS_CATEGORY_TRANSLATION_KEY = {
  "Food & Drink": "category.business.bizCatFoodDrink",
  Groceries: "category.business.bizCatGroceries",
  Pharmacy: "category.business.bizCatPharmacy",
  Healthcare: "category.business.bizCatHealthcare",
  Hotels: "category.business.bizCatHotels",
  Shops: "category.business.bizCatShops",
  "Beauty & Wellness": "category.business.bizCatBeautyWellness",
  Transport: "category.business.bizCatTransport",
  "Public Services": "category.business.bizCatPublicServices",
  Attractions: "category.business.bizCatAttractions",
  Parks: "category.business.bizCatParks",
  Finance: "category.business.bizCatFinance",
  Education: "category.business.bizCatEducation",
  Nightlife: "category.business.bizCatNightlife",
  Automobile: "category.business.bizCatAutomobile",
  "Pet Services": "category.business.bizCatPetServices",
  "Home Services": "category.business.bizCatHomeServices"
};

function businessCategoryLabel(category) {
  const key = BUSINESS_CATEGORY_TRANSLATION_KEY[category];
  return key ? t(key) : category;
}

function renderCategoryPlaceholder(item) {
  return `<span class="category-placeholder category-placeholder-${categorySlug(item?.category)}" aria-hidden="true">${categoryIconFor(item)}</span>`;
}

/** Real photo when available, category-representative photo otherwise —
 * the category-icon tile only ever shows as an underlay safety net if an
 * image URL fails to load at runtime, never as the primary visual. */
function renderPlacePhoto(item) {
  const url = item.photoUrl || (item.photos && item.photos[0]) || null;
  const isLogo = /\.svg(\?|$)/i.test(url || "") || / logo /i.test(` ${item.photoAttribution || ""} `);
  return `
    <div class="place-photo${isLogo ? " place-photo-logo" : ""}">
      ${renderCategoryPlaceholder(item)}
      ${url ? `<img src="${url}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ""}
    </div>
  `;
}

/** Every record here really is sourced from OpenStreetMap/Wikidata/etc.,
 * and small-print source metadata is still shown — but the raw label
 * ("OpenStreetMap / Overpass API") reads as an internal API name, not a
 * place a user recognises. This trims it to the source a person actually
 * knows, without hiding it. */
const SOURCE_DISPLAY_LABEL = {
  "OpenStreetMap / Overpass API": "OpenStreetMap"
};

function friendlySourceLabel(item) {
  return SOURCE_DISPLAY_LABEL[item.source] || item.source;
}

/** The universal action row (Directions/Waze/Call/Website) plus whatever
 * category-specific actions apply (Menu/Reserve/Book/Hours/Documents).
 * Shared by the directory card and the place-detail sheet so both stay
 * in sync automatically. */
function renderDirectionsButton(item) {
  return `<button type="button" class="directions-btn" data-role="open-directions" data-place-id="${item.id}" data-directions-google="${directionsUrl(item)}" data-directions-apple="${appleMapsUrl(item)}" data-directions-waze="${wazeUrl(item)}">${pinIcon()}${t("common.directions")}</button>`;
}

function renderPlaceActionButtons(item) {
  const primary = [renderDirectionsButton(item)];
  if (item.phone) primary.push(`<a class="directions-btn" data-place-id="${item.id}" href="tel:${item.phone}">${phoneIcon()}${t("common.call")}</a>`);
  if (item.website) primary.push(`<a class="directions-btn" data-place-id="${item.id}" href="${item.website}" target="_blank" rel="noopener noreferrer">${t("common.website")}</a>`);

  const secondary = categoryActionsFor(item)
    .map((action) => {
      if (action === "menu" && item.website) return `<a class="directions-btn" href="${item.website}" target="_blank" rel="noopener noreferrer">${t("common.menu")}</a>`;
      if (action === "reserve") return `<button data-view="reservations">${t("common.reserve")}</button>`;
      if (action === "book") return `<button data-view="reservations">${t("nav.book")}</button>`;
      if (action === "hours" && item.openingHours) return `<span class="badge hours-chip">${escapeHtml(item.openingHours)}</span>`;
      if (action === "documents") return `<span class="badge hours-chip">${t("common.documents")}</span>`;
      return "";
    })
    .filter(Boolean);

  return `
    <div class="imported-card-actions">${primary.join("")}</div>
    ${secondary.length ? `<div class="imported-card-actions imported-card-actions-secondary">${secondary.join("")}</div>` : ""}
  `;
}

/** Save/share/claim — small, secondary, bottom-of-card. Claim is a quiet
 * text link here, never the card's main label. */
function renderPlaceFooterActions(item) {
  return `
    <div class="imported-card-footer">
      <span class="imported-source-meta">${t("business.sourceLabel")}: ${friendlySourceLabel(item)} · ${t("business.updatedLabel")}: ${formatDate(item.lastUpdated)}</span>
      <div class="place-footer-actions">
        <button type="button" class="icon-action ${isPlaceSaved(item) ? "is-active" : ""}" data-action="toggle-save" data-place-id="${item.id}" aria-label="${t("common.favourite")}">${icon("heart")}</button>
        <button type="button" class="icon-action" data-action="share-place" data-place-id="${item.id}" aria-label="${t("common.share")}">${icon("arrow")}</button>
        <button type="button" class="claim-subtle" data-view="businessClaim" data-place-id="${item.id}">${t("business.claim.claimThisPlace")}</button>
      </div>
    </div>
  `;
}

function renderOpenStatusBadge(item) {
  const open = isOpenNow(item.openingHours);
  if (open === true) return `<span class="badge open-now-badge">${t("status.openNow")}</span>`;
  if (open === false) return `<span class="badge">${t("status.closedNow")}</span>`;
  return "";
}

/** The full/grid member of the shared PlaceCard family (Explore's
 * browsable list, Saved Places, the admin import review screen). Shares
 * a photo aspect-ratio, border-radius and shadow token with the compact
 * rail member above (both use the .place-card base class) — the
 * difference between them is deliberate, not accidental: this one has
 * the full action set (directions/call/website/save/share/claim)
 * because it's the primary place to act on a place, where the compact
 * rail card is a lighter preview whose one job is to invite a tap
 * through to the same detail sheet either card opens. */
function renderPlaceCard(item) {
  const distance = formatDistance(distanceFromCenter(item));
  const photoCount = (item.photos && item.photos.length) || (item.photoUrl ? 1 : 0);
  const hasValidId = Boolean(item.id);
  // Mouse-only trigger on the photo (kept out of the tab order to avoid a
  // duplicate stop for the same action) plus a real role="button" on the
  // body — the primary keyboard target — so Tab reaches the card exactly
  // once and Enter/Space there opens the same sheet a click does.
  const photoNavAttrs = hasValidId ? `data-sheet="place" data-place-id="${item.id}"` : "";
  const bodyNavAttrs = hasValidId ? `data-sheet="place" data-place-id="${item.id}" role="button" tabindex="0" aria-label="${escapeHtml(item.name)}"` : "";
  return `
    <article class="place-card">
      <div class="place-card-photo" ${photoNavAttrs}>
        ${renderPlacePhoto(item)}
        <div class="place-photo-overlay place-photo-overlay-top">
          <span class="badge category-chip">${categoryIconFor(item)} ${businessCategoryLabel(item.category)}</span>
          <span class="place-photo-overlay-right">
            ${isPlaceVerified(item) ? `<span class="badge verified-badge">${icon("check")} ${t("status.verified")}</span>` : ""}
            ${renderOpenStatusBadge(item)}
          </span>
        </div>
        <div class="place-photo-overlay place-photo-overlay-bottom">
          ${distance ? `<span class="badge badge-distance">${pinIcon()}${distance}</span>` : ""}
          ${item.rating ? `<span class="badge badge-rating">${icon("star")}${item.rating}</span>` : ""}
          ${photoCount > 1 ? `<span class="badge photo-count-badge">${icon("camera")}${photoCount}</span>` : ""}
        </div>
      </div>
      <div class="place-card-body" ${bodyNavAttrs}>
        <h3 class="place-card-title">${item.name}</h3>
        <p class="place-card-meta">${pinIcon()}${item.address || item.neighbourhood || "Vilnius"}</p>
        ${honestPlaceDescription(item) ? `<p class="place-card-description">${honestPlaceDescription(item)}</p>` : ""}
      </div>
      ${renderPlaceActionButtons(item)}
      ${renderPlaceFooterActions(item)}
    </article>
  `;
}

function renderBusinessDashboardEmpty() {
  return `
    <section class="section-shell auth-shell">
      <div class="auth-card">
        <p class="eyebrow">${t("business.dashboard.businessDashboardTitle")}</p>
        <h1>${t("business.dashboard.businessDashboardEmptyTitle")}</h1>
        <p class="auth-hint">${t("business.dashboard.businessDashboardEmptyHint")}</p>
        <button type="button" class="auth-primary-button" data-view="explore">${t("business.dashboard.businessDashboardEmptyCta")}</button>
      </div>
    </section>
  `;
}

function renderBusinessDashboard() {
  if (state.auth.status !== "signedIn") return renderProfileSignedOut();
  const owned = ownedBusinesses();
  if (!owned.length) return renderBusinessDashboardEmpty();

  const active = owned.find((item) => item.id === state.selectedPlaceId) || owned[0];
  if (!state.businessDraft || state.businessDraft.__businessId !== active.id) {
    resetBusinessDraftFromItem(active);
    state.businessDraft.__businessId = active.id;
  }
  const draft = state.businessDraft;
  const stats = businessStats(active.id);

  return `
    <section class="section-shell business-dashboard-shell">
      <div class="screen-heading">
        <p class="eyebrow">${t("business.dashboard.businessDashboardTitle")}</p>
        <h1>${active.name}</h1>
        <p>${active.verificationStatus === "Verified" ? t("status.verified") : t("status.pending")} · ${businessCategoryLabel(active.category)}</p>
      </div>

      ${owned.length > 1 ? `
        <div class="chip-row">
          ${owned.map((item) => `<button class="${item.id === active.id ? "is-selected" : ""}" data-dashboard-business="${item.id}">${item.name}</button>`).join("")}
        </div>
      ` : ""}

      <div class="settings-section">
        <h3>${t("business.dashboard.businessStatsTitle")}</h3>
        <p class="settings-section-hint">${t("business.dashboard.businessStatsHint")}</p>
        <div class="business-stats-grid">
          <article><strong>${stats.views}</strong><span>${t("business.dashboard.stats.statViews")}</span></article>
          <article><strong>${stats.directions}</strong><span>${t("business.dashboard.stats.statDirections")}</span></article>
          <article><strong>${stats.calls}</strong><span>${t("business.dashboard.stats.statCalls")}</span></article>
          <article><strong>${stats.website}</strong><span>${t("business.dashboard.stats.statWebsite")}</span></article>
          <article><strong>${stats.saves}</strong><span>${t("business.dashboard.stats.statSaves")}</span></article>
          <article><strong>${stats.shares}</strong><span>${t("business.dashboard.stats.statShares")}</span></article>
        </div>
      </div>

      <div class="settings-section">
        <h3>${t("business.dashboard.businessPhotoTitle")}</h3>
        <div class="business-photo-row">
          <div class="business-photo-preview" style="background-image: url('${draft.photoUrl}')"></div>
          <label class="claim-file-label">
            <span>${t("business.dashboard.businessPhotoCta")}</span>
            <input type="file" accept="image/*" data-role="business-photo-input" />
          </label>
        </div>
      </div>

      <form class="claim-form business-edit-form" data-business-id="${active.id}">
        <div class="settings-section">
          <h3>${t("business.dashboard.businessEditTitle")}</h3>
          ${authField({ id: "biz-name", label: t("business.dashboard.businessNameLabel"), value: draft.name })}
          <div class="auth-field">
            <label for="biz-category">${t("business.dashboard.businessCategoryFieldLabel")}</label>
            <select id="biz-category">
              ${CITY_ENTITY_CATEGORIES.map((cat) => `<option value="${cat}" ${draft.category === cat ? "selected" : ""}>${businessCategoryLabel(cat)}</option>`).join("")}
            </select>
          </div>
          <div class="auth-field">
            <label for="biz-description">${t("business.dashboard.businessDescriptionLabel")}</label>
            <textarea id="biz-description">${escapeHtml(draft.description)}</textarea>
          </div>
          ${authField({ id: "biz-address", label: t("business.dashboard.businessAddressLabel"), value: draft.address })}
          ${authField({ id: "biz-phone", label: t("common.phoneLabel"), value: draft.phone, type: "tel" })}
          ${authField({ id: "biz-website", label: t("common.website"), value: draft.website })}
          ${authField({ id: "biz-hours", label: t("business.dashboard.businessHoursLabel"), value: draft.openingHours, placeholder: "Mo-Fr 09:00-18:00" })}
          <button type="submit" class="auth-primary-button">${t("common.saveChangesCta")}</button>
        </div>
      </form>

      <div class="settings-section">
        <h3>${t("business.dashboard.businessBoostTitle")}</h3>
        <p class="settings-section-hint">${t("business.dashboard.businessBoostHint")}</p>
        <label class="settings-toggle-row">
          <span>${t("business.dashboard.businessBoostToggle")}</span>
          <input type="checkbox" data-role="business-boost-toggle" data-business-id="${active.id}" ${active.boosted ? "checked" : ""} />
        </label>
      </div>
    </section>
  `;
}

/** Standalone, customer-facing claim route — deep-linkable as
 * ?view=businessClaim&id=<placeId> (see WP0 routing). Previously the only
 * way to reach renderClaimFlow() below was through the internal Ops/
 * city-import dashboard, which meant every "Own this business" button in
 * the app routed ordinary customers into an unrelated internal admin
 * screen. This wraps the same real 4-step form in its own section with a
 * normal back button, same pattern as renderListingDetail/renderBusinessProfile. */
function renderBusinessClaim() {
  return `
    <section class="section-shell business-claim-shell">
      <button type="button" class="back-button" data-view="businesses">${icon("arrow")}${t("common.back")}</button>
      ${renderClaimFlow()}
    </section>
  `;
}

function renderClaimFlow() {
  const place = state.selectedPlaceId ? importedBusinesses.find((business) => business.id === state.selectedPlaceId) : null;

  if (place && place.ownerId) {
    const isOwner = state.auth.status === "signedIn" && place.ownerId === state.auth.user.id;
    return `
      <div class="claim-form">
        <div class="section-title">
          <div><h2>${t("business.claim.claimBusiness")}</h2><p>${t("business.claim.claimBusinessHint")}</p></div>
        </div>
        <div class="claim-step">
          <div class="claim-business-summary">
            <strong>${place.name}</strong>
            <span>${businessCategoryLabel(place.category)} · ${place.address || place.neighbourhood || "Vilnius"}</span>
          </div>
          <p class="auth-hint">${isOwner ? t("business.claim.claimAlreadyYours") : t("business.claim.claimAlreadyTaken")}</p>
          ${isOwner ? `<button type="button" class="auth-primary-button" data-view="businessDashboard">${t("common.manageBusinessCta")}</button>` : ""}
        </div>
      </div>
    `;
  }

  if (state.auth.status !== "signedIn") {
    return `
      <div class="claim-form">
        <div class="section-title">
          <div><h2>${t("business.claim.claimBusiness")}</h2><p>${t("business.claim.claimBusinessHint")}</p></div>
        </div>
        <div class="claim-step">
          <span class="claim-step-label">${t("business.claim.claimStep1")}</span>
          ${
            place
              ? `<div class="claim-business-summary"><strong>${place.name}</strong><span>${businessCategoryLabel(place.category)} · ${place.address || place.neighbourhood || "Vilnius"}</span></div>`
              : `<p class="claim-business-summary-empty">${t("business.claim.claimNoBusinessSelected")}</p>`
          }
        </div>
        <div class="claim-step">
          <p class="auth-hint">${t("business.claim.claimSignInHint")}</p>
          <button type="button" class="auth-primary-button" data-auth-view="login">${t("profile.signedOut.profileSignInCta")}</button>
        </div>
      </div>
    `;
  }

  return `
    <form class="claim-form">
      <div class="section-title">
        <div><h2>${t("business.claim.claimBusiness")}</h2><p>${t("business.claim.claimBusinessHint")}</p></div>
      </div>

      <div class="claim-step">
        <span class="claim-step-label">${t("business.claim.claimStep1")}</span>
        ${
          place
            ? `<div class="claim-business-summary">
                 <strong>${place.name}</strong>
                 <span>${businessCategoryLabel(place.category)} · ${place.address || place.neighbourhood || "Vilnius"}</span>
               </div>`
            : `<p class="claim-business-summary-empty">${t("business.claim.claimNoBusinessSelected")}</p>`
        }
      </div>

      <div class="claim-step">
        <span class="claim-step-label">${t("business.claim.claimStep2")}</span>
        <input name="ownerName" placeholder="${t("common.ownerName")}" value="${escapeHtml(state.auth.user.name)}" required />
        <input name="businessEmail" type="email" placeholder="${t("business.dashboard.businessEmail")}" value="${escapeHtml(state.auth.user.email)}" required />
        <input name="phone" type="tel" placeholder="${t("field.phone")}" />
        <input name="role" placeholder="${t("field.role")}" />
        <input name="websiteProof" placeholder="${t("common.websiteProof")}" />
      </div>

      <div class="claim-step">
        <span class="claim-step-label">${t("business.claim.claimStep3")}</span>
        <select name="verificationMethod">
          <option value="">${t("common.verificationMethod")}</option>
          <option>${t("business.verify.verifyBusinessEmailDomain")}</option>
          <option>${t("business.verify.verifyPhone")}</option>
          <option>${t("business.verify.verifyDocumentUpload")}</option>
          <option>${t("business.verify.verifyWebsiteOwnership")}</option>
          <option>${t("business.verify.verifyManualReview")}</option>
        </select>
        <label class="claim-file-label">
          <span>${t("common.documentUpload")}</span>
          <input name="document" type="file" />
        </label>
      </div>

      <div class="claim-step">
        <span class="claim-step-label">${t("business.claim.claimStep4")}</span>
        <button type="submit">${t("common.submitClaim")}</button>
      </div>

      ${place ? "" : `<div class="request-list">${businessClaims.map((claim) => `<article class="request-card"><span class="badge">${escapeHtml(claim.status)}</span><h3>${escapeHtml(claim.ownerName)}</h3><p>${escapeHtml(claim.role)} · ${escapeHtml(claim.verificationMethod)} · ${escapeHtml(claim.documentUpload)}</p></article>`).join("")}</div>`}
    </form>
  `;
}

/* Swipe-left (dismiss/archive) and swipe-right (toggle read) for
   notification cards and conversation rows — re-bound on every render()
   since the DOM nodes are recreated each time, same as every other
   bindEvents() listener. A simple drag-follows-finger + release-past-
   threshold pattern; no momentum/animation library involved. */
function bindSwipeRows() {
  const THRESHOLD = 72;
  document.querySelectorAll(".swipe-row").forEach((row) => {
    const surface = row.querySelector(".swipe-surface");
    if (!surface) return;
    let startX = 0;
    let deltaX = 0;
    let dragging = false;
    surface.addEventListener("touchstart", (event) => {
      startX = event.touches[0].clientX;
      deltaX = 0;
      dragging = true;
      surface.style.transition = "none";
    }, { passive: true });
    surface.addEventListener("touchmove", (event) => {
      if (!dragging) return;
      deltaX = event.touches[0].clientX - startX;
      const clamped = Math.max(-96, Math.min(96, deltaX));
      surface.style.transform = `translateX(${clamped}px)`;
      row.classList.toggle("is-swiping-left", clamped < -12);
      row.classList.toggle("is-swiping-right", clamped > 12);
    }, { passive: true });
    surface.addEventListener("touchend", () => {
      dragging = false;
      surface.style.transition = "";
      surface.style.transform = "";
      row.classList.remove("is-swiping-left", "is-swiping-right");
      const type = row.dataset.swipeType;
      const id = row.dataset.swipeId;
      if (deltaX <= -THRESHOLD) {
        if (type === "notification") dismissNotification(id);
        else if (type === "conversation") archiveConversation(id);
        render();
      } else if (deltaX >= THRESHOLD) {
        if (type === "notification") toggleNotificationRead(id);
        else if (type === "conversation") toggleConversationRead(id);
        render();
      }
      deltaX = 0;
    });
  });
}

function bindEvents() {
  document.querySelector(".claim-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitClaim(new FormData(event.target));
  });

  document.addEventListener(
    "click",
    (event) => {
      const card = event.target.closest('[data-view="liveOpportunityDetail"][data-opportunity-id]');
      if (!card) return;
      if (event.target.closest(".floating-card-actions, .mini-save")) return;
      if (event.target.closest("button") && event.target.closest("button") !== card) return;
      const opportunityId = card.dataset.opportunityId;
      if (!findOpportunityById(opportunityId)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openLiveOpportunityDetail(opportunityId);
    },
    true
  );

  document.querySelectorAll('[data-view="liveOpportunityDetail"][data-opportunity-id]').forEach((card) => {
    const activateOpportunity = (event) => {
      if (event.target.closest(".floating-card-actions, .mini-save")) return;
      if (event.target.closest("button") && event.target.closest("button") !== card) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openLiveOpportunityDetail(card.dataset.opportunityId);
    };
    card.addEventListener("click", activateOpportunity);
    if (card.getAttribute("role") === "button") {
      card.addEventListener("keydown", (event) => {
        if (event.target !== card) return;
        if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
        activateOpportunity(event);
      });
    }
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (button.tagName === "A") event.preventDefault();
      if (button.closest(".carousel-control")) return;
      if (button !== event.target.closest("[data-view]")) return;
      if (event.target.closest(".floating-card-actions, .mini-save")) return;
      if (button.closest(".ai-search, .tyt-ai-search") && state.query.trim()) {
        trackEvent("search_performed", { queryLength: state.query.trim().length, destination: button.dataset.view });
      }
      /* render() only resets scroll when activeView *changes* — re-tapping
         the already-active bottom-nav tab is a no-op for that check, so it
         needs its own explicit "scroll this page back to top" here,
         matching the tap-active-tab convention from native tab bars. */
      const isReturningToSameView = state.activeView === button.dataset.view && !state.activeSheet;
      /* Marketplace's own landing screen is the category-tile picker, not
         the listings page — every navigation TO marketplace (bottom-nav
         tab, any other "go to Marketplace" link) should land there fresh,
         not stay wherever a previous category selection left it. */
      if (button.dataset.view === "marketplace") state.marketplaceCategoryChosen = false;
      if (button.dataset.view === "explore") {
        state.exploreCategory = "All";
        state.exploreCategoryChosen = false;
      }
      state.activeView = button.dataset.view;
      state.activeSheet = null;
      state.alwenOpen = false;
      state.quickTranslateOpen = false;
      if (button.dataset.category) state.category = button.dataset.category;
      if (button.dataset.view === "createListing" && button.dataset.category) {
        state.listingDraft.category = button.dataset.category;
      }
      // Retries on every visit rather than relying solely on the one
      // fire-and-forget call at sign-in, which left "My Listings" — and any
      // real listing created in an earlier session — silently stuck empty
      // for the rest of the session if that one attempt hit any hiccup.
      if ((button.dataset.view === "profile" || button.dataset.view === "marketplace") && state.auth.status === "signedIn") {
        refreshMyListings();
      }
      if ((button.dataset.view === "profile" || button.dataset.view === "hire" || button.dataset.view === "needHelp") && state.auth.status === "signedIn") {
        refreshMyHelpRequests();
      }
      if (button.dataset.seeAllCategory) {
        state.exploreCategory = button.dataset.seeAllCategory;
        state.exploreCuisine = "All";
        state.exploreStars = "All";
      }
      if (button.dataset.businessId) state.selectedBusinessId = Number(button.dataset.businessId);
      if (button.dataset.listingId) {
        state.selectedListingId = button.dataset.listingId;
        const selected = listings.find((listing) => String(listing.id) === String(button.dataset.listingId));
        if (selected?.offerorStatus === "trader") loadTraderDisclosure(selected.sellerId);
      }
      if (button.dataset.placeId) state.selectedPlaceId = button.dataset.placeId;
      if (button.dataset.opportunityId) state.selectedOpportunityId = button.dataset.opportunityId;
      if (button.dataset.conversationId) state.activeConversationId = Number(button.dataset.conversationId);
      render();
      if (isReturningToSameView) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-alwen-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.alwenOpen = !state.alwenOpen;
      state.activeSheet = null;
      render();
    });
  });

  document.querySelectorAll("[data-quick-translate-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.quickTranslateOpen = !state.quickTranslateOpen;
      state.activeSheet = null;
      render();
    });
  });

  document.querySelector("[data-alwen-chat-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    submitAlwenChat(formData.get("message"));
  });

  document.querySelector("[data-alwen-retry]")?.addEventListener("click", () => {
    submitAlwenChat(state.alwenChat.lastMessage);
  });

  document.querySelectorAll('[data-action="alwen-quick-prompt"]').forEach((button) => {
    button.addEventListener("click", () => {
      submitAlwenChat(t(button.dataset.promptKey));
    });
  });

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.activeView = button.dataset.targetView || "marketplace";
      state.activeSheet = null;
      state.alwenOpen = false;
      if (state.activeView === "marketplace") state.marketplaceCategoryChosen = true;
      render();
    });
  });

  document.querySelectorAll("[data-notification-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.notificationFilter = button.dataset.notificationFilter;
      render();
    });
  });

  document.querySelector('[data-action="mark-all-read"]')?.addEventListener("click", () => {
    markAllNotificationsRead();
    render();
  });

  // The primary-action button already carries data-view/data-sheet, so the
  // generic [data-view]/[data-sheet] handlers above do the actual
  // navigation + render() — this listener only needs to flip the read
  // state before that render happens, which addEventListener guarantees
  // since both listeners fire synchronously in registration order.
  document.querySelectorAll('[data-action="notification-primary"]').forEach((button) => {
    button.addEventListener("click", () => {
      const item = notifications.find((entry) => entry.id === Number(button.dataset.id));
      if (item) item.unread = false;
    });
  });

  document.querySelectorAll('[data-action="dismiss-notification"]').forEach((button) => {
    button.addEventListener("click", () => {
      dismissNotification(button.dataset.id);
      render();
    });
  });

  document.querySelector('[data-action="send-message"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = String(formData.get("message") || "").trim();
    if (!text) return;
    const thread = messageThreads.find((entry) => entry.id === Number(event.currentTarget.dataset.conversationId));
    if (thread) {
      thread.messages.push({ from: "me", text, time: t("notification.groupNow") });
      thread.unread = 0;
    }
    state.composerDraft = "";
    render();
  });

  bindSwipeRows();

  document.querySelector('[data-role="import-source"]')?.addEventListener("change", (event) => {
    state.cityImportRun.source = event.target.value;
    state.cityImportRun.category = IMPORT_SOURCE_CATEGORIES[event.target.value][0].value;
    state.cityImportRun.results = [];
    render();
  });

  document.querySelector('[data-role="import-category"]')?.addEventListener("change", (event) => {
    state.cityImportRun.category = event.target.value;
    render();
  });

  document.querySelector('[data-role="import-area"]')?.addEventListener("change", (event) => {
    state.cityImportRun.area = event.target.value;
  });

  document.querySelector('[data-role="import-mode"]')?.addEventListener("change", (event) => {
    state.cityImportRun.mode = event.target.value;
    render();
  });

  document.querySelector('[data-action="run-import"]')?.addEventListener("click", () => {
    runCityImport();
  });

  document.querySelector('[data-action="run-tranche-import"]')?.addEventListener("click", () => {
    runTrancheImport();
  });

  document.querySelector('[data-action="clear-import-cache"]')?.addEventListener("click", () => {
    clearImportCache();
  });

  document.querySelectorAll('[data-action="publish-import"]').forEach((button) => {
    button.addEventListener("click", () => {
      publishImportResult(button.dataset.entityId);
    });
  });

  document.getElementById("global-search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.category = "all";
    const cursor = event.target.selectionStart || state.query.length;
    scheduleLiveFieldRender("global-search", () => restoreLiveFieldFocus("global-search", cursor));
  });
  document.getElementById("global-search")?.addEventListener("blur", () => {
    if (liveFieldRenderTimers.has("global-search")) flushLiveFieldRender("global-search");
  });

  /* Coverflow-rail place cards (data-coverflow ancestor) are excluded here
     and handled entirely inside bindCoverflow() instead — that viewport
     already owns their click/keydown activation, and giving them a second,
     independent binding here would open the same sheet twice per tap. */
  document.querySelectorAll("[data-sheet]").forEach((button) => {
    if (button.closest("[data-coverflow]")) return;
    button.addEventListener("click", () => {
      if (button.dataset.sheet === "place") {
        openPlaceDetail(button.dataset.placeId);
        return;
      }
      state.activeSheet = button.dataset.sheet;
      if (button.dataset.placeId) state.selectedPlaceId = button.dataset.placeId;
      if (button.dataset.sheet === "tyt") trackEvent("tyt_opened", {});
      render();
    });
  });

  /* Keyboard equivalent of the place-card click handler above, scoped to
     grid/full PlaceCard elements (the compact/coverflow variant handles
     its own keydown inside bindCoverflow, since its click already goes
     through the viewport rather than the card element directly). Only
     fires when the card itself has focus, not a nested favourite/action
     button, so those keep their own Enter/Space behaviour. */
  document.querySelectorAll('[data-sheet="place"][role="button"]').forEach((card) => {
    if (card.closest("[data-coverflow]")) return;
    card.addEventListener("keydown", (event) => {
      if (event.target !== card) return;
      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
      event.preventDefault();
      openPlaceDetail(card.dataset.placeId);
    });
  });

  document.querySelectorAll("[data-cookie-settings]").forEach((button) => button.addEventListener("click", () => {
    state.cookieSettingsOpen = true;
    render();
  }));
  document.querySelectorAll("[data-cookie-choice]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.cookieChoice === "manage" && !state.cookieSettingsOpen) {
      state.cookieSettingsOpen = true;
      render();
      return;
    }
    const analytics = button.dataset.cookieChoice === "accept" || (button.dataset.cookieChoice === "manage" && Boolean(document.getElementById("cookie-analytics-choice")?.checked));
    writeLocalStorage(COOKIE_CONSENT_KEY, { necessary: true, analytics, advertising: false, functional: false, decidedAt: new Date().toISOString() });
    if (!analytics) writeLocalStorage(ANALYTICS_KEY, null);
    state.cookieSettingsOpen = false;
    render();
  }));

  document.querySelectorAll("[data-report-target]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.reportTarget = { type: button.dataset.reportTarget, id: button.dataset.reportId || "website" };
    state.reportNotice = null;
    render();
  }));
  document.querySelector("[data-report-close]")?.addEventListener("click", () => { state.reportTarget = null; render(); });
  document.querySelector("[data-report-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record = { target_type: state.reportTarget.type, target_id: state.reportTarget.id, reason: data.get("reason"), explanation: data.get("explanation"), content_url: data.get("contentUrl"), reporter_name: data.get("reporterName"), reporter_email: data.get("reporterEmail"), good_faith_confirmed: data.get("goodFaith") === "on" };
    try {
      if (!record.good_faith_confirmed) return;
      await createModerationReport(record);
      state.reportNotice = "Report submitted for human review.";
    } catch (error) {
      const localRecords = readLocalStorage(MODERATION_RECORDS_KEY) || [];
      localRecords.push({ ...record, id: crypto.randomUUID(), status: "open", created_at: new Date().toISOString(), storage: "local-pending-sync" });
      writeLocalStorage(MODERATION_RECORDS_KEY, localRecords);
      state.reportNotice = "Report saved on this device pending secure submission.";
      console.warn("[legal] Report backend unavailable", error);
    }
    state.reportTarget = null;
    render();
  });

  document.querySelectorAll("[data-account-action]").forEach((button) => button.addEventListener("click", async () => {
    if (state.auth.status !== "signedIn") return goToAuthView("login");
    const requestType = button.dataset.accountAction === "delete" ? "deletion" : "portability";
    try { await createPrivacyRequest(requestType); state.reportNotice = requestType === "deletion" ? "Account deletion request submitted." : "Personal data request submitted."; }
    catch { state.reportNotice = "This request could not be submitted. Privacy contact details are awaiting configuration."; }
    render();
  }));
  document.querySelectorAll("[data-contact-purpose]").forEach((button) => button.addEventListener("click", async () => {
    const purpose = button.dataset.contactPurpose;
    if ((purpose === "privacy" || purpose === "appeal") && state.auth.status === "signedIn") {
      try { await createPrivacyRequest(purpose === "appeal" ? "appeal" : "privacy_support"); state.reportNotice = "Your request has been submitted."; }
      catch { state.reportNotice = "Support contact details are awaiting configuration."; }
    } else state.reportNotice = "Support contact details are awaiting configuration.";
    render();
  }));

  document.querySelectorAll("[data-opportunity-filter]").forEach((button) => button.addEventListener("click", () => {
    state.opportunityFilter = button.dataset.opportunityFilter;
    render();
  }));
  document.querySelector("[data-opportunity-category]")?.addEventListener("change", (event) => {
    state.opportunityCategory = event.target.value;
    render();
  });
  document.querySelector("[data-opportunity-distance]")?.addEventListener("change", (event) => {
    state.opportunityDistance = event.target.value;
    render();
  });

  document.querySelectorAll('[data-action="toggle-save"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSavePlace(button.dataset.placeId);
      trackEvent("place_saved", { placeId: button.dataset.placeId });
    });
  });

  document.querySelectorAll('[data-action="share-place"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = importedBusinesses.find((business) => business.id === button.dataset.placeId);
      if (item) sharePlace(item);
      trackEvent("place_shared", { placeId: button.dataset.placeId });
    });
  });

  document.querySelectorAll('[data-action="toggle-helpful"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = Number(button.dataset.postId);
      state.helpfulPostIds = state.helpfulPostIds.includes(id) ? state.helpfulPostIds.filter((existing) => existing !== id) : [...state.helpfulPostIds, id];
      render();
    });
  });

  document.querySelectorAll('[data-action="toggle-post-save"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = Number(button.dataset.postId);
      state.savedPostIds = state.savedPostIds.includes(id) ? state.savedPostIds.filter((existing) => existing !== id) : [...state.savedPostIds, id];
      render();
    });
  });

  document.querySelectorAll('[data-action="share-post"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const post = feedPosts.find((item) => item.id === Number(button.dataset.postId));
      if (post) sharePost(post);
      trackEvent("post_shared", { postId: button.dataset.postId });
    });
  });

  document.querySelectorAll("[data-community-filter]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.communityFilter = button.dataset.communityFilter;
      render();
    });
  });

  // Shared by the composer-prompt quick-type chips (which also carry
  // data-sheet="communityComposer", handled by the generic [data-sheet]
  // listener above) and the post-type row inside the composer sheet
  // itself — both just need to record which type is selected.
  document.querySelectorAll("[data-community-post-type]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.communityPostDraft.type = button.dataset.communityPostType;
      render();
    });
  });

  document.querySelector('[data-action="submit-community-post"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    if (!title || !body) return;
    const nextId = feedPosts.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    feedPosts.unshift({
      id: nextId,
      authorId: `community-user-${nextId}`,
      author: state.auth.user.name,
      avatar: state.auth.user.avatar || null,
      area: currentAreaLabel(),
      time: t("notification.groupNow"),
      type: state.communityPostDraft.type,
      verified: false,
      title,
      body,
      tags: [],
      replies: 0,
      helpful: 0,
      saves: 0,
      replyList: []
    });
    state.communityPostDraft = { title: "", body: "", type: "discussion" };
    state.activeSheet = null;
    trackEvent("community_post_created", { type: feedPosts[0].type });
    render();
  });

  document.querySelectorAll('[data-action="open-post-actions"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.activePostId = Number(button.dataset.postId);
      state.activeSheet = "postActions";
      render();
    });
  });

  document.querySelectorAll('[data-action="open-post-detail"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.activePostId = Number(button.dataset.postId);
      state.activeSheet = "postDetail";
      render();
    });
  });

  document.querySelector('[data-action="hide-post"]')?.addEventListener("click", () => {
    const id = state.activePostId;
    if (id != null && !state.hiddenPostIds.includes(id)) state.hiddenPostIds.push(id);
    state.activeSheet = null;
    render();
  });

  document.querySelector('[data-action="mute-topic"]')?.addEventListener("click", () => {
    const post = feedPosts.find((item) => item.id === state.activePostId);
    if (post && !state.mutedTopics.includes(post.type)) state.mutedTopics.push(post.type);
    state.activeSheet = null;
    render();
  });

  document.querySelector('[data-action="report-post-author"]')?.addEventListener("click", () => {
    const post = feedPosts.find((item) => item.id === state.activePostId);
    if (post && !state.reportedPeople.includes(post.author)) state.reportedPeople.push(post.author);
    render();
  });

  document.querySelector('[data-action="block-post-author"]')?.addEventListener("click", () => {
    const post = feedPosts.find((item) => item.id === state.activePostId);
    if (post && !state.blockedPeople.includes(post.author)) state.blockedPeople.push(post.author);
    render();
  });

  document.querySelector('[data-action="reply-to-post"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("reply") || "").trim();
    if (!text) return;
    const post = feedPosts.find((item) => item.id === Number(form.dataset.postId));
    if (post) {
      post.replyList = post.replyList || [];
      post.replyList.push({ author: t("common.you"), text });
      post.replies = (post.replies || 0) + 1;
    }
    render();
  });

  document.querySelectorAll('[data-action="toggle-listing-save"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      // A plain string, not Number() — real listings created via Supabase
      // have UUID ids, not the seeded mock data's numeric ones.
      const id = button.dataset.listingId;
      state.savedListingIds = state.savedListingIds.includes(id) ? state.savedListingIds.filter((existing) => existing !== id) : [...state.savedListingIds, id];
      trackEvent("place_saved", { listingId: id });
      render();
    });
  });

  document.querySelectorAll('[data-action="ai-search-submit"]').forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("global-search")?.blur();
      if (state.query.trim()) trackEvent("search_performed", { queryLength: state.query.trim().length });
      if (state.activeView === "explore") {
        const matched = matchExploreSearchCategory(state.query);
        if (matched) bumpExploreCategorySignal(matched);
        if (!state.exploreCategoryChosen) {
          state.exploreCategory = "All";
          state.exploreCategoryChosen = true;
          render();
        }
      }
      document.querySelector('[data-role="ai-search-results"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll('[data-action="toggle-discover"]').forEach((button) => {
    button.addEventListener("click", () => {
      state.discoverOpen = !state.discoverOpen;
      render();
      if (state.discoverOpen) document.querySelector('[data-role="ai-search-results"]')?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  document.querySelectorAll('[data-action="share-profile"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.auth.user) shareUserProfile(state.auth.user);
      trackEvent("profile_shared", {});
    });
  });

  document.querySelectorAll('[data-action="share-listing"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.listingId;
      const item = listings.find((listing) => String(listing.id) === id);
      if (item) shareListing(item);
      trackEvent("place_shared", { listingId: id });
    });
  });

  document.querySelectorAll('[data-action="report-listing"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.listingId;
      if (!state.reportedListings.includes(id)) state.reportedListings.push(id);
      render();
    });
  });

  document.querySelectorAll(".directions-btn").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      const kind = href.startsWith("tel:") ? "call_clicked" : /waze\.com|google\.com\/maps/.test(href) ? "directions_clicked" : "website_clicked";
      trackEvent(kind, { businessId: link.dataset.placeId || "" });
    });
  });

  document.querySelectorAll("[data-sheet-close]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target !== element) return;
      state.activeSheet = null;
      render();
    });
  });

  document.querySelectorAll('[data-role="open-directions"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.directionsOptions = {
        google: button.dataset.directionsGoogle,
        apple: button.dataset.directionsApple,
        waze: button.dataset.directionsWaze
      };
      state.activeSheet = "directions";
      render();
    });
  });

  document.querySelectorAll("[data-booking-day]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.bookingDay;
      state.bookingDraft.dateIndex = value === "flexible" ? "flexible" : Number.parseInt(value, 10);
      state.bookingDraft.time = null;
      render();
    });
  });

  document.querySelectorAll("[data-booking-time]").forEach((button) => {
    button.addEventListener("click", () => {
      state.bookingDraft.time = button.dataset.bookingTime;
      render();
    });
  });

  document.querySelector('[data-role="confirm-booking"]')?.addEventListener("click", submitBooking);
  document.querySelectorAll('[data-role="close-booking-sheet"]').forEach((button) => {
    button.addEventListener("click", resetBookingDraft);
  });
  document.querySelector('[data-role="view-my-bookings"]')?.addEventListener("click", () => {
    state.bookingDraft = { dateIndex: null, time: null };
    state.bookingConfirmed = null;
    state.activeSheet = null;
    state.activeView = "reservations";
    render();
  });

  document.querySelectorAll("[data-area-option]").forEach((button) => {
    button.addEventListener("click", () => {
      state.area = button.dataset.areaOption;
      state.activeSheet = null;
      render();
    });
  });

  document.querySelectorAll("[data-explore-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.exploreCategory = button.dataset.exploreCategory;
      state.exploreCuisine = "All";
      state.exploreStars = "All";
      if (!state.exploreCategoryChosen) bumpExploreCategorySignal(state.exploreCategory);
      state.exploreCategoryChosen = true;
      render();
    });
  });

  document.querySelectorAll('[data-action="explore-back-to-hub"]').forEach((button) => {
    button.addEventListener("click", () => {
      state.exploreCategoryChosen = false;
      state.exploreCategory = "All";
      render();
    });
  });

  document.querySelectorAll("[data-explore-cuisine]").forEach((button) => {
    button.addEventListener("click", () => {
      state.exploreCuisine = button.dataset.exploreCuisine;
      render();
    });
  });

  document.querySelectorAll("[data-explore-stars]").forEach((button) => {
    button.addEventListener("click", () => {
      state.exploreStars = button.dataset.exploreStars;
      render();
    });
  });

  document.querySelectorAll("[data-explore-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.exploreToggle;
      state[key] = !state[key];
      render();
    });
  });

  document.querySelectorAll("[data-hire-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.hireCategory = state.hireCategory === button.dataset.hireCategory ? null : button.dataset.hireCategory;
      render();
    });
  });

  document.querySelectorAll("[data-help-urgency]").forEach((button) => {
    button.addEventListener("click", () => {
      state.helpRequestDraft.urgency = button.dataset.helpUrgency;
      render();
    });
  });

  bindLiveField("help-request-text", (value) => {
    state.helpRequestDraft.text = value;
    if (state.helpRequestError) state.helpRequestError = null;
  });

  document.querySelector('[data-role="submit-help-request"]')?.addEventListener("click", submitHelpRequest);
  document.querySelector('[data-role="post-another-request"]')?.addEventListener("click", resetHelpRequestDraft);

  bindLiveField("listing-title", (value) => {
    state.listingDraft.title = value;
  });
  bindLiveField("listing-description", (value) => {
    state.listingDraft.description = value;
  });
  bindLiveField("listing-price", (value) => {
    state.listingDraft.priceAmount = value;
  });
  bindLiveField("listing-neighbourhood", (value) => {
    state.listingDraft.neighbourhood = value;
  });
  bindLiveField("listing-tags", (value) => {
    state.listingDraft.tags = value;
  });
  document.querySelector('[data-role="listing-category"]')?.addEventListener("change", (event) => {
    state.listingDraft.category = event.target.value;
  });
  document.querySelector('[data-role="listing-price-period"]')?.addEventListener("change", (event) => {
    state.listingDraft.pricePeriod = event.target.value;
  });
  document.querySelector('[data-role="listing-condition"]')?.addEventListener("change", (event) => {
    state.listingDraft.condition = event.target.value;
  });
  document.querySelector('[data-role="listing-offeror-status"]')?.addEventListener("change", (event) => {
    state.listingDraft.offerorStatus = event.target.value;
  });
  document.getElementById("listing-pickup")?.addEventListener("change", (event) => {
    state.listingDraft.pickupAvailable = event.target.checked;
  });
  document.getElementById("listing-delivery")?.addEventListener("change", (event) => {
    state.listingDraft.deliveryAvailable = event.target.checked;
  });
  document.querySelector('[data-role="listing-photos-input"]')?.addEventListener("change", (event) => {
    const incoming = Array.from(event.target.files || []);
    state.listingDraft.photoFiles = [...state.listingDraft.photoFiles, ...incoming].slice(0, LISTING_MAX_PHOTOS);
    render();
  });
  document.querySelectorAll('[data-role="remove-listing-photo"]').forEach((button) => {
    button.addEventListener("click", () => {
      state.listingDraft.photoFiles = state.listingDraft.photoFiles.filter((_, index) => index !== Number(button.dataset.index));
      render();
    });
  });
  document.querySelector('[data-role="create-listing-form"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitListingForm();
  });

  document.querySelector('[data-role="trader-verification-form"]')?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const intent = event.submitter?.value || "save";
    const fields = Object.fromEntries([
      "legal_name", "trading_name", "legal_form", "registered_address", "operating_address", "public_business_address",
      "business_email", "business_phone", "country_of_establishment", "trade_register_name", "registration_number", "vat_number",
      "representative_name", "representative_role"
    ].map((key) => [key, String(formData.get(key) || "").trim()]));
    fields.lawful_goods_confirmed = formData.get("lawful_goods_confirmed") === "on";
    fields.accuracy_check_confirmed = formData.get("accuracy_check_confirmed") === "on";
    state.traderVerificationStatus = "loading";
    state.traderVerificationNotice = null;
    render();
    try {
      let saved = await saveTraderVerificationDraft(fields, state.traderVerification?.id || null);
      const file = formData.get("document");
      if (file instanceof File && file.size) {
        await uploadTraderVerificationDocument({ verificationId: saved.id, documentType: formData.get("document_type"), file });
      }
      if (intent === "submit") saved = await submitTraderVerification({ id: saved.id, confirmationVersion: TRADER_CONFIRMATION_VERSION });
      state.traderVerification = saved;
      state.traderVerificationStatus = "success";
      state.traderVerificationNotice = intent === "submit" ? "Submitted for manual review." : "Draft saved.";
    } catch (error) {
      state.traderVerificationStatus = "error";
      state.traderVerificationNotice = error?.message || "Trader verification could not be saved.";
    }
    render();
  });
  document.querySelector('[data-role="load-trader-review"]')?.addEventListener("click", async () => {
    try { state.traderReviewQueue = await fetchTraderVerificationQueue(); } catch (error) { console.warn("[trader-review] Queue load failed.", error); }
    render();
  });
  document.querySelectorAll('[data-role="trader-review-form"]').forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await reviewTraderVerification({
        id: form.dataset.id,
        newStatus: formData.get("status"),
        userReason: String(formData.get("user_reason") || "").trim(),
        internalNotes: String(formData.get("internal_notes") || "").trim(),
        expiresAt: formData.get("expires_at") ? new Date(formData.get("expires_at")).toISOString() : null
      });
      state.traderReviewQueue = await fetchTraderVerificationQueue();
    } catch (error) { console.warn("[trader-review] Decision failed.", error); }
    render();
  }));
  document.querySelectorAll('[data-role="trader-register-check"]').forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await recordTraderRegisterCheck({ verificationId: form.dataset.id, sourceName: String(formData.get("source_name") || "").trim(), result: formData.get("result"), reference: String(formData.get("reference") || "").trim() || null, notes: String(formData.get("notes") || "").trim() });
      form.reset();
    } catch (error) { console.warn("[trader-review] Register check failed.", error); }
  }));

  document.querySelector('[data-role="explore-sort"]')?.addEventListener("change", (event) => {
    state.exploreSort = event.target.value;
    render();
  });

  document.querySelector("[data-translate-from]")?.addEventListener("change", (event) => {
    state.translateFromLanguage = event.target.value;
    state.translateOutputText = "";
    state.translateStatus = "idle";
    render();
  });

  document.querySelector("[data-translate-to]")?.addEventListener("change", (event) => {
    state.translateToLanguage = event.target.value;
    state.translateOutputText = "";
    state.translateStatus = "idle";
    render();
  });

  document.querySelectorAll("[data-translate-quick-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      state.translateToLanguage = button.dataset.translateQuickLang;
      state.translateOutputText = "";
      state.translateStatus = "idle";
      render();
    });
  });

  document.querySelector("[data-translate-swap]")?.addEventListener("click", () => {
    [state.translateFromLanguage, state.translateToLanguage] = [state.translateToLanguage, state.translateFromLanguage];
    if (state.translateStatus === "success") state.translateInputText = state.translateOutputText;
    state.translateOutputText = "";
    state.translateStatus = "idle";
    render();
  });

  bindLiveField("translation-input", (value) => {
    state.translateInputText = value;
    state.translateStatus = "idle";
    state.translateVoiceError = null;
  });

  document.querySelector("[data-translate-action]")?.addEventListener("click", () => {
    runTranslation();
  });

  document.querySelector("[data-translate-clear]")?.addEventListener("click", () => {
    window.speechSynthesis?.cancel();
    activeSpeechRecognition?.stop();
    state.translateInputText = "";
    state.translateOutputText = "";
    state.translateStatus = "idle";
    state.translateVoiceError = null;
    render();
  });

  document.querySelector("[data-translate-copy]")?.addEventListener("click", (event) => {
    if (!state.translateOutputText.trim()) return;
    navigator.clipboard?.writeText(state.translateOutputText).catch(() => {});
    const button = event.currentTarget;
    button.classList.add("is-copied");
    window.setTimeout(() => button.classList.remove("is-copied"), 1500);
  });

  document.querySelectorAll("[data-translate-speak]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.translateSpeak;
      const isSource = panel === "from";
      const text = isSource ? state.translateInputText.trim() : state.translateOutputText.trim();
      const languageKey = isSource ? state.translateFromLanguage : state.translateToLanguage;
      speakText(text, TRANSLATE_LANGUAGE_SPEECH_LOCALE[languageKey], button, panel);
    });
  });

  document.querySelector("[data-translate-record]")?.addEventListener("click", () => {
    startVoiceInput();
  });

  document.querySelectorAll("[data-translate-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.translateMode;
      if (mode === "camera") {
        document.getElementById("translation-camera-input")?.click();
        return;
      }
      state.translateInputMode = mode;
      state.translateVoiceError = null;
      render();
      if (mode === "voice") startVoiceInput();
    });
  });

  document.getElementById("translation-camera-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleCameraCapture(file);
    event.target.value = "";
  });

  document.querySelectorAll("[data-alwen-upload]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.alwenUpload === "image" ? "alwen-image-input" : "alwen-document-input")?.click();
    });
  });

  document.getElementById("alwen-image-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleCameraCapture(file);
    event.target.value = "";
  });

  document.getElementById("alwen-document-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    handleDocumentCapture(file);
    event.target.value = "";
  });

  document.querySelectorAll("[data-language-option]").forEach((button) => {
    button.addEventListener("click", async () => {
      await setLanguage(button.dataset.languageOption);
      state.language = getCurrentLanguage();
      persistLanguage();
      state.activeSheet = null;
      render();
    });
  });

  bindAuthEvents();
  bindSettingsEvents();
  bindOnboardingEvents();
  bindBusinessDashboardEvents();
  bindPublicProfileEvents();
}

/** render() rebuilds the *entire* #app subtree (see render(), below) — on a
 * real phone that's routinely 100ms+ of main-thread work, not just a DOM
 * churn cosmetic issue. Running it on every keystroke tears down and
 * recreates whatever input is focused (a real blur+focus cycle that
 * flickers the on-screen keyboard, reading as the screen jumping while
 * typing), and even debounced to "once typing pauses," that same 100ms+
 * block lands right as the user resumes typing after any brief pause,
 * which reads as the keyboard itself being slow to respond.
 *
 * The fix is to not render at all while a field is actively focused —
 * apply() already updates state synchronously on every keystroke, so
 * nothing needs the render for correctness, only for *other* UI that
 * happens to depend on this field's value (e.g. the search button's
 * destination). That dependent UI is refreshed the moment the field
 * blurs — a natural pause point, and (via the browser's own focus-out →
 * click event order) always before any button relying on the fresh value
 * can actually be tapped. LIVE_FIELD_RENDER_IDLE_MS is just a safety net
 * for a field left focused with no further typing and no blur. Keyed per
 * field so typing in one field never resets another's pending render. */
const liveFieldRenderTimers = new Map();
const LIVE_FIELD_RENDER_IDLE_MS = 1200;

function flushLiveFieldRender(key, afterRender) {
  clearTimeout(liveFieldRenderTimers.get(key));
  liveFieldRenderTimers.delete(key);
  render();
  afterRender?.();
}

function scheduleLiveFieldRender(key, afterRender) {
  clearTimeout(liveFieldRenderTimers.get(key));
  liveFieldRenderTimers.set(key, setTimeout(() => flushLiveFieldRender(key, afterRender), LIVE_FIELD_RENDER_IDLE_MS));
}

function restoreLiveFieldFocus(id, cursor) {
  const fresh = document.getElementById(id);
  if (!fresh) return;
  // render() just tore down and rebuilt the whole subtree, so `fresh`
  // is a brand-new element even though it looks identical — a plain
  // focus() on a "new" node makes the browser treat it as a fresh
  // focus target and auto-scroll it into view.
  // preventScroll keeps the caret/typing working with none of that.
  fresh.focus({ preventScroll: true });
  // Some input types (email, number, ...) don't support the selection
  // API at all and throw on setSelectionRange — without this guard the
  // exception aborts the handler before the cursor is restored, so the
  // caret silently resets to the start once the render fires.
  try {
    fresh.setSelectionRange(cursor, cursor);
  } catch {
    /* Selection API unsupported for this input type — focus() above is enough. */
  }
}

function bindLiveField(id, apply) {
  const el = document.getElementById(id);
  if (!el) return;
  const isCheckbox = el.type === "checkbox";
  el.addEventListener(isCheckbox ? "change" : "input", (event) => {
    const cursor = isCheckbox ? null : event.target.selectionStart;
    apply(isCheckbox ? event.target.checked : event.target.value);
    if (isCheckbox) {
      render();
      return;
    }
    // Only a long-idle safety net — the normal path is the "blur" listener
    // below, which fires the instant the user actually pauses on their own.
    scheduleLiveFieldRender(id, () => restoreLiveFieldFocus(id, cursor));
  });
  if (!isCheckbox) {
    el.addEventListener("blur", () => {
      // Nothing to flush if the idle timer already fired, or the field was
      // never touched — and don't refocus here, the user meant to leave.
      if (liveFieldRenderTimers.has(id)) flushLiveFieldRender(id);
    });
  }
}

function bindAuthEvents() {
  document.querySelectorAll("[data-auth-view]").forEach((button) => {
    button.addEventListener("click", () => goToAuthView(button.dataset.authView));
  });

  document.querySelectorAll("[data-auth-login-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.auth.loginMode = button.dataset.authLoginMode;
      state.auth.authError = null;
      render();
    });
  });

  document.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.auth.authView === "register") {
        const draft = state.auth.registerDraft;
        if (!draft.agreeTerms) { state.auth.authError = t("auth.authErrorTerms"); render(); return; }
        writeLocalStorage(PENDING_LEGAL_ACCEPTANCE_KEY, { policyVersion: LEGAL_POLICY_VERSION, acceptedAt: new Date().toISOString(), email: "", marketingConsent: Boolean(draft.marketingConsent) });
      }
      signInWithProvider(button.dataset.authProvider);
    });
  });

  document.querySelector('[data-role="profile-avatar-input"]')?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.auth.profileDraft.avatar = reader.result;
      render();
    };
    reader.readAsDataURL(file);
  });

  bindLiveField("login-email", (value) => (state.auth.loginDraft.email = value));
  bindLiveField("login-phone", (value) => (state.auth.loginDraft.phone = value));
  bindLiveField("register-email", (value) => (state.auth.registerDraft.email = value));
  bindLiveField("register-terms", (value) => (state.auth.registerDraft.agreeTerms = value));
  bindLiveField("register-marketing", (value) => (state.auth.registerDraft.marketingConsent = value));
  bindLiveField("forgot-email", (value) => (state.auth.forgotDraft.email = value));
  bindLiveField("verify-code", (value) => (state.auth.verifyDraft.code = value.replace(/\D/g, "").slice(0, 6)));
  bindLiveField("reset-password", (value) => (state.auth.resetDraft.password = value));
  bindLiveField("reset-confirm", (value) => (state.auth.resetDraft.confirmPassword = value));
  bindLiveField("profile-name", (value) => (state.auth.profileDraft.name = value));
  bindLiveField("profile-role", (value) => (state.auth.profileDraft.role = value));

  const form = document.querySelector("[data-auth-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const kind = form.dataset.authForm;
    if (kind === "login-email") submitLoginEmail();
    else if (kind === "login-phone") submitLoginPhone();
    else if (kind === "register") submitRegister();
    else if (kind === "forgotPassword") submitForgotPassword();
    else if (kind === "verifyCode") submitVerifyCode();
    else if (kind === "resetPassword") submitResetPassword();
    else if (kind === "completeProfile") submitCompleteProfile();
  });
}

function bindSettingsEvents() {
  document.querySelector('[data-settings-install="true"]')?.addEventListener("click", promptInstall);

  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.theme = button.dataset.themeOption;
      persistSettings();
      applyTheme();
      render();
    });
  });

  document.querySelector('[data-settings-edit-profile="true"]')?.addEventListener("click", () => {
    resetProfileDraftFromUser(state.auth.user);
    goToAuthView("completeProfile");
  });

  document.querySelector('[data-settings-signout="true"]')?.addEventListener("click", () => signOut("local"));
  document.querySelector('[data-settings-signout-everywhere="true"]')?.addEventListener("click", () => signOut("global"));
  document.querySelector('[data-profile-signout="true"]')?.addEventListener("click", signOut);

  const notifyBindings = [
    ["settings-notify-messages", "notifyMessages"],
    ["settings-notify-offers", "notifyOffers"],
    ["settings-notify-community", "notifyCommunity"],
    ["settings-notify-bookings", "notifyBookings"],
    ["settings-notify-business", "notifyBusiness"],
    ["settings-notify-tyt", "notifyTyt"],
    ["settings-notify-payments", "notifyPayments"],
    ["settings-notify-alwen", "notifyAlwen"],
    ["settings-notify-system", "notifySystem"]
  ];
  notifyBindings.forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener("change", (event) => {
      state.settings[key] = event.target.checked;
      persistSettings();
      render();
    });
  });

  document.querySelector('[data-settings-delete-start="true"]')?.addEventListener("click", () => {
    state.settingsConfirmDelete = true;
    render();
  });
  document.querySelector('[data-settings-delete-cancel="true"]')?.addEventListener("click", () => {
    state.settingsConfirmDelete = false;
    render();
  });
  document.querySelector('[data-settings-delete-confirm="true"]')?.addEventListener("click", () => {
    state.settingsConfirmDelete = false;
    state.auth.authNotice = t("auth.authDeleteAccountBackendRequired");
    signOut("local");
  });
}

function bindOnboardingEvents() {
  document.querySelectorAll("[data-onboarding-next]").forEach((button) => {
    button.addEventListener("click", () => {
      state.onboardingStep += 1;
      render();
    });
  });
  document.querySelector('[data-onboarding-finish="true"]')?.addEventListener("click", completeOnboarding);
  document.querySelector('[data-onboarding-signin="true"]')?.addEventListener("click", () => {
    completeOnboarding();
    goToAuthView("login");
  });
}

function bindPublicProfileEvents() {
  document.querySelectorAll("[data-public-profile]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      openPublicProfile(element.dataset);
    });
  });

  document.querySelector('[data-person-action="book"]')?.addEventListener("click", () => {
    state.bookingDraft = { dateIndex: null, time: null };
    state.bookingConfirmed = null;
    state.activeSheet = "booking";
    render();
  });

  document.querySelector('[data-person-action="message"]')?.addEventListener("click", () => {
    state.activeView = "messages";
    render();
  });

  document.querySelector('[data-person-action="report"]')?.addEventListener("click", () => {
    const name = state.publicProfile?.name;
    if (name && !state.reportedPeople.includes(name)) state.reportedPeople.push(name);
    render();
  });

  document.querySelector('[data-person-action="block"]')?.addEventListener("click", () => {
    const name = state.publicProfile?.name;
    if (name && !state.blockedPeople.includes(name)) state.blockedPeople.push(name);
    render();
  });
}

function bindBusinessDashboardEvents() {
  document.querySelectorAll("[data-dashboard-business]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPlaceId = button.dataset.dashboardBusiness;
      state.businessDraft = null;
      render();
    });
  });

  document.querySelector('[data-role="business-photo-input"]')?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.businessDraft.photoUrl = reader.result;
      render();
    };
    reader.readAsDataURL(file);
  });

  document.querySelector('[data-role="business-boost-toggle"]')?.addEventListener("change", (event) => {
    toggleBusinessBoost(event.target.dataset.businessId);
  });

  bindLiveField("biz-name", (value) => (state.businessDraft.name = value));
  bindLiveField("biz-description", (value) => (state.businessDraft.description = value));
  bindLiveField("biz-address", (value) => (state.businessDraft.address = value));
  bindLiveField("biz-phone", (value) => (state.businessDraft.phone = value));
  bindLiveField("biz-website", (value) => (state.businessDraft.website = value));
  bindLiveField("biz-hours", (value) => (state.businessDraft.openingHours = value));

  document.getElementById("biz-category")?.addEventListener("change", (event) => {
    state.businessDraft.category = event.target.value;
    render();
  });

  const form = document.querySelector(".business-edit-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitBusinessDashboardEdit(form.dataset.businessId);
  });
}

function updateHeaderTheme() {
  const isHome = state.activeView === "home";
  const shouldBeSolid = !isHome || window.scrollY > 96;
  state.headerSolid = shouldBeSolid;

  document.querySelectorAll(".app-shell, .app-top").forEach((element) => {
    element.classList.toggle("theme-dark-header", isHome && !shouldBeSolid);
    element.classList.toggle("theme-light-header", shouldBeSolid);
    element.classList.toggle("header-dark", isHome && !shouldBeSolid);
    element.classList.toggle("header-light", shouldBeSolid);
    element.classList.toggle("header-transparent", isHome && !shouldBeSolid);
    element.classList.toggle("header-solid", shouldBeSolid);
  });
}

function bindHeaderTheme() {
  window.onscroll = () => {
    updateHeaderTheme();
  };

  updateHeaderTheme();
}

function bindAiSearchPlaceholderRotation() {
  let index = 0;
  let tytIndex = 0;
  let alwenIndex = 0;
  window.setInterval(() => {
    // Community and Explore each get their own contextual prompt set —
    // the generic list includes prompts like "Register my business" that
    // don't belong on a neighbourhood feed or a "what do you need in the
    // city" search.
    const prompts =
      state.activeView === "community"
        ? t("community.communityPromptExamples")
        : state.activeView === "explore"
          ? t("explore.explorePromptExamples")
          : t("common.aiSearchPrompts");
    const input = document.getElementById("global-search");
    if (input && document.activeElement !== input && !input.value) {
      index = (index + 1) % prompts.length;
      input.placeholder = prompts[index];
    }

    const tytPrompts = t("tyt.tytPromptExamples");
    const tytInput = document.getElementById("tyt-search");
    if (tytInput && document.activeElement !== tytInput && !tytInput.value) {
      tytIndex = (tytIndex + 1) % tytPrompts.length;
      tytInput.placeholder = tytPrompts[tytIndex];
    }

    const alwenPrompts = t("alwen.heroPromptExamples");
    const alwenInput = document.getElementById("alwen-hero-input");
    if (alwenInput && document.activeElement !== alwenInput && !alwenInput.value) {
      alwenIndex = (alwenIndex + 1) % alwenPrompts.length;
      alwenInput.placeholder = alwenPrompts[alwenIndex];
    }
  }, 2600);
}

let lastRenderedView = null;

function render() {
  const isPublicLegalView = ["legalTerms", "legalPrivacy", "legalCookies", "legalSafety"].includes(state.activeView);
  const content = !state.hasOnboarded && !isPublicLegalView ? renderOnboarding() : state.activeView === "welcomeSequence" ? renderWelcomeSequence() : renderShell();
  document.getElementById("app").innerHTML = content;
  bindEvents();
  bindCarousels();
  bindCoverflow();
  bindHeaderTheme();
  /* Without this, the page behind an open sheet (TYT, language, place
     detail, ...) stays scrollable, so a scroll gesture that starts over
     the backdrop — or runs past the sheet's own content — chains straight
     through and scrolls the screen underneath at the same time. */
  document.body.classList.toggle("has-open-sheet", Boolean(state.activeSheet));
  /* render() runs on every state change (typing in search, toggling a
     checkbox, opening a sheet), not just on navigation — so this only
     resets scroll when activeView itself actually changed. Without it,
     switching bottom-nav tabs while scrolled down on the previous page
     leaves the new page stranded at that same scroll depth instead of
     opening at its own top. */
  if (state.activeView !== lastRenderedView) {
    window.scrollTo(0, 0);
    lastRenderedView = state.activeView;
  }
  syncUrlToState();
}

/** Full-screen photo zoom viewer — deliberately built OUTSIDE the render()
 * cycle (appended straight to document.body, torn down on close) rather
 * than driven by state + innerHTML. Pinch/pan needs to update a transform
 * every frame without fighting a re-render triggered by something
 * unrelated (e.g. the AI placeholder rotation timer), and the viewport
 * meta now disables native page zoom everywhere — this is the one place
 * users should still be able to zoom, via its own gesture handling. */
let activePhotoZoomOverlay = null;

function closePhotoZoom() {
  if (!activePhotoZoomOverlay) return;
  document.removeEventListener("keydown", activePhotoZoomOverlay._escHandler);
  activePhotoZoomOverlay.remove();
  activePhotoZoomOverlay = null;
  if (!state.activeSheet) document.body.classList.remove("has-open-sheet");
}

function openPhotoZoom(url) {
  if (!url) return;
  closePhotoZoom();

  const overlay = document.createElement("div");
  overlay.className = "photo-zoom-overlay";
  overlay.innerHTML = `
    <button type="button" class="photo-zoom-close" aria-label="${t("common.close")}">×</button>
    <img class="photo-zoom-img" src="${escapeHtml(url)}" alt="" draggable="false" />
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("has-open-sheet");

  const img = overlay.querySelector(".photo-zoom-img");
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  const pointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let panStart = null;

  function applyTransform() {
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    overlay.classList.toggle("is-zoomed", scale > 1.02);
  }

  function clampPan() {
    const maxX = (img.clientWidth * (scale - 1)) / 2;
    const maxY = (img.clientHeight * (scale - 1)) / 2;
    translateX = Math.max(-maxX, Math.min(maxX, translateX));
    translateY = Math.max(-maxY, Math.min(maxY, translateY));
  }

  function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function toggleZoomAt(clientX, clientY) {
    if (scale > 1) {
      resetZoom();
      return;
    }
    const rect = img.getBoundingClientRect();
    const originX = clientX - (rect.left + rect.width / 2);
    const originY = clientY - (rect.top + rect.height / 2);
    scale = 2.5;
    translateX = -originX * (scale - 1) / scale;
    translateY = -originY * (scale - 1) / scale;
    clampPan();
    applyTransform();
  }

  img.addEventListener("dblclick", (event) => {
    event.preventDefault();
    toggleZoomAt(event.clientX, event.clientY);
  });

  let lastTouchEnd = 0;
  img.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && event.changedTouches.length === 1 && pointers.size === 0) {
      const touch = event.changedTouches[0];
      toggleZoomAt(touch.clientX, touch.clientY);
    }
    lastTouchEnd = now;
  });

  img.style.touchAction = "none";

  img.addEventListener("pointerdown", (event) => {
    img.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartScale = scale;
    } else if (pointers.size === 1 && scale > 1) {
      panStart = { x: event.clientX - translateX, y: event.clientY - translateY };
    }
  });

  img.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStartDistance > 0) {
        scale = Math.max(1, Math.min(4, pinchStartScale * (distance / pinchStartDistance)));
        clampPan();
        applyTransform();
      }
    } else if (pointers.size === 1 && panStart && scale > 1) {
      translateX = event.clientX - panStart.x;
      translateY = event.clientY - panStart.y;
      clampPan();
      applyTransform();
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStartDistance = 0;
    if (pointers.size === 0) {
      panStart = null;
      if (scale <= 1.02) resetZoom();
    }
  }
  img.addEventListener("pointerup", endPointer);
  img.addEventListener("pointercancel", endPointer);
  img.addEventListener("pointerleave", endPointer);

  overlay.querySelector(".photo-zoom-close").addEventListener("click", closePhotoZoom);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePhotoZoom();
  });
  const escHandler = (event) => {
    if (event.key === "Escape") closePhotoZoom();
  };
  document.addEventListener("keydown", escHandler);
  overlay._escHandler = escHandler;

  activePhotoZoomOverlay = overlay;
}

/** Delegated, capture-phase, bound once to document (not per-render, since
 * document itself survives the innerHTML swap in render()). Runs before
 * any card's own bubble-phase "open detail sheet" listener, so tapping a
 * photo opens the zoom viewer instead of navigating — but only once a
 * real photo is actually found; otherwise the event is left alone and
 * the card's normal tap-to-open behaviour proceeds untouched. */
function bindPhotoZoom() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("button, a[href]")) return;
    const photoEl = event.target.closest('[class*="-photo"]');
    if (!photoEl) return;
    const bg = getComputedStyle(photoEl).backgroundImage;
    const bgMatch = /url\(["']?(.*?)["']?\)/.exec(bg || "");
    let url = bgMatch ? bgMatch[1] : null;
    if (!url) {
      // Some "-photo" containers (e.g. imported place cards) hold a
      // real <img> instead of setting their own background-image —
      // fall back to whatever image is actually inside.
      const img = photoEl.tagName === "IMG" ? photoEl : photoEl.querySelector("img");
      url = img ? img.currentSrc || img.src : null;
    }
    if (!url) return;
    event.preventDefault();
    event.stopPropagation();
    openPhotoZoom(url);
  }, { capture: true });
}

approvedLegalPolicyMarkdown = await fetch("/src/legal/ALWENDA_LEGAL_POLICIES_EN.md").then((response) => {
  if (!response.ok) throw new Error(`Legal policy source unavailable (${response.status})`);
  return response.text();
}).catch((error) => {
  console.error("[legal] Approved policy source could not be loaded", error);
  return "# Policy unavailable\n\nThe approved policy source could not be loaded. Do not rely on a placeholder policy.";
});
await Promise.all(SUPPORTED_LANGUAGES.map((lang) => loadLocale(lang.code)));
const storedLanguage = readLocalStorage(LANGUAGE_KEY);
if (storedLanguage && SUPPORTED_LANGUAGES.some((lang) => lang.code === storedLanguage)) state.language = storedLanguage;
await setLanguage(state.language);

resetAuthDrafts();
hydrateAuthFromStorage();

// Google/Supabase report a failed or cancelled OAuth attempt (wrong redirect
// URI, expired client secret, user closed the consent screen, ...) as
// ?error=...&error_description=... on this exact redirect — never as a JS
// exception, since the browser was just navigated here directly. Read it
// before anything (our own history.replaceState below, or Supabase's own
// internal URL parsing inside hydrateSupabaseAuth) has a chance to clear
// the query string, or a real failure silently looks identical to "nothing
// happened, you're just signed out on Home" instead of a visible error.
const isAuthCallback = window.location.pathname.startsWith(AUTH_CALLBACK_PATH);
const oauthCallbackError = isAuthCallback ? readOAuthCallbackError() : null;

await hydrateSupabaseAuth();
// The OAuth callback page (auth/callback/index.html) is a separate physical
// path with no routes of its own — every relative fetch/asset URL the rest
// of the app builds (locales, brand SVGs, in-app pushState links) resolves
// against whatever path is in the address bar, so this app must never stay
// parked there once Supabase has consumed the redirect and restored the session.
if (isAuthCallback) {
  history.replaceState(null, "", "/");
}
if (oauthCallbackError) {
  state.auth.authError = oauthCallbackError;
  state.auth.authView = "login";
  state.activeView = "auth";
}
applyBusinessOverrides();
syncStateFromUrl();
suppressNextUrlPush = true;
applyTheme();
bindThemeListener();
bindHistoryNavigation();
render();
bindAiSearchPlaceholderRotation();
registerServiceWorker();
bindInstallPrompt();
bindErrorTracking();
bindPhotoZoom();
refreshLocalWeather();

/* Keep the greeting synchronized if Home stays open across noon/evening,
   and refresh current conditions periodically without a page reload. */
let lastGreetingSuffix = timeOfDaySuffix();
window.setInterval(() => {
  const nextSuffix = timeOfDaySuffix();
  if (nextSuffix !== lastGreetingSuffix) {
    lastGreetingSuffix = nextSuffix;
    if (state.activeView === "home") render();
  }
}, 60_000);
window.setInterval(refreshLocalWeather, 15 * 60_000);

/* ============================================================
   SplashScreen — reusable, one-time-per-session brand moment.
   The landing page (render(), above) has already mounted behind
   it, so removing the overlay causes zero layout shift; it is a
   pure crossfade reveal of content that was already there.
   ============================================================ */
const SPLASH_SESSION_KEY = "alwendaSplashShown";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splashIconMarkup() {
  return BrandLogo({ variant: "icon", tone: "dark", className: "splash-icon-img" });
}

/** Tags the wordmark's own first/last letter groups (the two "a"s) and the
 * middle letters in place, using the real glyph geometry (getBBox) — no
 * letterforms are recreated, only the official SVG's existing groups are
 * classified and moved. */
function prepareSplashLetters(svg) {
  const letters = svg.querySelectorAll(":scope > g > g > g[fill]");
  if (letters.length < 2) return false;
  const first = letters[0];
  const last = letters[letters.length - 1];
  Array.from(letters)
    .slice(1, -1)
    .forEach((g) => g.classList.add("splash-mid"));
  first.classList.add("splash-a-first");
  last.classList.add("splash-a-last");

  const vb = svg.viewBox.baseVal;
  const centerX = vb.x + vb.width / 2;
  const firstBox = first.getBBox();
  const lastBox = last.getBBox();
  const glyphWidth = Math.max(firstBox.width, lastBox.width);
  const gap = glyphWidth * 0.22;
  const firstTargetCenter = centerX - (glyphWidth / 2 + gap / 2);
  const lastTargetCenter = centerX + (glyphWidth / 2 + gap / 2);
  const dxFirst = firstTargetCenter - (firstBox.x + firstBox.width / 2);
  const dxLast = lastTargetCenter - (lastBox.x + lastBox.width / 2);
  first.style.setProperty("--dx", `${dxFirst}px`);
  last.style.setProperty("--dx", `${dxLast}px`);
  return true;
}

async function initSplashScreen() {
  if (sessionStorage.getItem(SPLASH_SESSION_KEY)) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const root = document.createElement("div");
  root.id = "splash-root";
  root.setAttribute("role", "presentation");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = reduced
    ? `
      <div class="splash-stage splash-stage-reduced">
        <span class="splash-icon">${splashIconMarkup()}</span>
        <p class="splash-tagline is-visible">${t("common.splashTagline")}</p>
      </div>
    `
    : `
      <div class="splash-stage">
        <span class="splash-glow"></span>
        <span class="splash-wordmark"></span>
        <span class="splash-icon">${splashIconMarkup()}</span>
        <p class="splash-tagline">${t("common.splashTagline")}</p>
      </div>
    `;
  document.body.appendChild(root);
  const stage = root.querySelector(".splash-stage");

  if (reduced) {
    await wait(20);
    stage.classList.add("is-visible");
    await wait(650);
  } else {
    const wordmarkHost = stage.querySelector(".splash-wordmark");
    let lettersReady = false;
    try {
      const svgText = await fetch(BRAND_ASSETS.wordmark.dark).then((res) => res.text());
      wordmarkHost.innerHTML = svgText;
      const svg = wordmarkHost.querySelector("svg");
      lettersReady = svg ? prepareSplashLetters(svg) : false;
    } catch {
      lettersReady = false;
    }

    if (!lettersReady) {
      // Fetch or DOM parsing failed (e.g. restrictive origin) — skip straight
      // to the icon rather than leaving a blank or static-only stage.
      stage.classList.add("is-visible", "is-converging", "is-handoff");
      await wait(20);
      stage.classList.add("is-alive");
      await wait(450);
      stage.classList.add("is-tagline-visible");
      await wait(300);
    } else {
      await wait(20);
      stage.classList.add("is-visible");
      await wait(300 + 600);
      stage.classList.add("is-converging");
      await wait(550);
      stage.classList.add("is-handoff");
      await wait(200);
      stage.classList.add("is-alive");
      await wait(450);
      stage.classList.add("is-tagline-visible");
      await wait(300);
    }
  }

  root.classList.add("splash-exit");
  await wait(280);
  root.remove();
  sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
}

initSplashScreen();
