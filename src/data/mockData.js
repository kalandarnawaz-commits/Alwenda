/**
 * Real/derived city data, taxonomy, and enums live here — anything a real
 * user would recognise as "the city" or "the categories this app knows
 * about," never fabricated activity. Fabricated/seeded demo *activity*
 * (marketplace listings, reviews, notifications, messages, reputation
 * numbers, and everything else that could be mistaken for a real person's
 * real behaviour) lives in ./devFixtures.js and is only ever loaded here
 * when isFixturesAllowed() is true — see docs/qa/production-data-policy.md.
 */
import { isFixturesAllowed } from "../config.js";
import * as DEV from "./devFixtures.js";
import { SEED_CITY_ENTITIES, SEED_CITY_META } from "./seedCityData.js?v=seed-17";
import { buildDirectionsUrls } from "../services/dataImport/cityEntitySchema.js";

export const city = {
  id: "vilnius",
  name: "Vilnius",
  country: "Lithuania",
  region: "Europe",
  currency: "EUR",
  locale: "lt-LT"
};

export const categories = [
  { id: "buy-sell", icon: "tag", labelKey: "category.marketplace.catBuySell" },
  { id: "rentals", icon: "home", labelKey: "category.marketplace.catRentals" },
  { id: "jobs", icon: "briefcase", labelKey: "category.marketplace.catJobs" },
  { id: "services", icon: "tool", labelKey: "category.marketplace.catServices" },
  { id: "vehicles", icon: "vehicle", labelKey: "category.marketplace.catVehicles" },
  { id: "property", icon: "building", labelKey: "category.marketplace.catProperty" },
  { id: "business-listings", icon: "city", labelKey: "category.marketplace.catBusinessListings" },
  { id: "community-requests", icon: "people", labelKey: "category.marketplace.catCommunityRequests" }
];

export const marketplaceCapabilities = [
  "marketplace.capabilities.capabilityAiSearch",
  "marketplace.capabilities.capabilityChat",
  "marketplace.capabilities.capabilityBooking",
  "marketplace.capabilities.capabilityMaps",
  "marketplace.capabilities.capabilityReviews",
  "marketplace.capabilities.capabilityRatings",
  "marketplace.capabilities.capabilityAvailability",
  "marketplace.capabilities.capabilitySecurePayments"
];

export { SEED_CITY_META };

/** The baked seed predates the photoLicense field — derive it from the
 * existing photoAttribution text rather than regenerating the seed file:
 * category-fallback attributions already end in "(<licence>)", and real
 * Wikidata/Wikimedia photos don't carry a per-file licence in the seed,
 * so they get an honest "see file page" note instead of a fabricated one. */
function derivePhotoLicense(entity) {
  const match = /\(([^()]+)\)\s*$/.exec(entity.photoAttribution || "");
  if (match) return match[1];
  if (entity.photoStatus === "real") return "Wikimedia Commons — see file page for exact licence";
  return null;
}

/**
 * Alwenda's Vilnius pilot ships pre-seeded with real, open-source place
 * data (see src/data/seedCityData.js) so the app already looks and feels
 * real before any user-generated listings exist. Every record here is a
 * real place from OpenStreetMap or Wikidata, "Unclaimed · Open data"
 * until a real owner claims it — nothing here is fabricated.
 */

export const importedBusinesses = SEED_CITY_ENTITIES.map((entity) => {
  const directions = buildDirectionsUrls({ lat: entity.lat, lng: entity.lng, name: entity.name, address: entity.address });
  return {
    id: entity.id,
    name: entity.name,
    category: entity.category,
    subcategory: entity.subcategory,
    address: entity.address,
    neighbourhood: entity.neighbourhood,
    lat: entity.lat,
    lng: entity.lng,
    coordinates: entity.lat != null && entity.lng != null ? `${entity.lat}, ${entity.lng}` : "",
    phone: entity.phone || "",
    email: entity.email || "",
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
    photoLicense: entity.photoLicense ?? derivePhotoLicense(entity),
    photoStatus: entity.photoStatus,
    photoLastChecked: entity.photoLastChecked ?? entity.lastUpdated,
    directionsGoogleUrl: entity.directionsGoogleUrl ?? directions.directionsGoogleUrl,
    directionsWazeUrl: entity.directionsWazeUrl ?? directions.directionsWazeUrl,
    directionsAppleUrl: entity.directionsAppleUrl ?? directions.directionsAppleUrl,
    description: entity.aiSummary,
    aiAttributes: entity.tags
  };
});

export const neighbourhoods = [
  "Old Town",
  "Naujamiestis",
  "Užupis",
  "Žvėrynas",
  "Šnipiškės",
  "Antakalnis",
  "Paupys",
  "Žirmūnai",
  "Naujininkai",
  "Rasos",
  "Markučiai",
  "Belmontas",
  "Pavilnys",
  "Naujoji Vilnia",
  "Paneriai",
  "Vilkpėdė",
  "Lazdynai",
  "Karoliniškės",
  "Viršuliškės",
  "Pašilaičiai",
  "Justiniškės",
  "Fabijoniškės",
  "Pilaitė",
  "Verkiai",
  "Baltupiai",
  "Santariškės",
  "Jeruzalė",
  "Balsiai",
  "Valakampiai",
  "Grigiškės",
  "Tarandė",
  "Kirtimai",
  "Užusienis",
  "Aukštieji Paneriai",
  "Bajorai",
  "Visoriai",
  "Liepkalnis",
  "Burbiškės"
];

/**
 * type: canonical machine-readable post type — drives the type label,
 * filter chips, and which primary action a card shows. Distinct from
 * the old free-text categoryKey (kept only on posts that still use it
 * for display continuity elsewhere); type is the field everything new
 * branches on. verified: whether the author's identity is verified
 * (shown as a badge next to their name). active: for "alert"-type
 * posts only — whether the alert is still current (shown/resolved).
 */

export const COMMUNITY_POST_TYPES = ["question", "recommendation", "alert", "offer", "help", "lostFound", "event", "update", "discussion"];

export const professionalCategories = [
  { value: "plumber", labelKey: "category.profession.profPlumber" },
  { value: "electrician", labelKey: "category.profession.profElectrician" },
  { value: "cleaner", labelKey: "category.profession.profCleaner" },
  { value: "carpenter", labelKey: "category.profession.profCarpenter" },
  { value: "painter", labelKey: "category.profession.profPainter" },
  { value: "mechanic", labelKey: "category.profession.profMechanic" },
  { value: "babysitter", labelKey: "category.profession.profBabysitter" },
  { value: "pet sitter", labelKey: "category.profession.profPetSitter" },
  { value: "tutor", labelKey: "category.profession.profTutor" },
  { value: "photographer", labelKey: "category.profession.profPhotographer" },
  { value: "driver", labelKey: "category.profession.profDriver" },
  { value: "lawyer", labelKey: "category.profession.profLawyer" },
  { value: "accountant", labelKey: "category.profession.profAccountant" },
  { value: "translator", labelKey: "category.profession.profTranslator" },
  { value: "personal trainer", labelKey: "category.profession.profPersonalTrainer" },
  { value: "hair stylist", labelKey: "category.profession.profHairStylist" },
  { value: "makeup artist", labelKey: "category.profession.profMakeupArtist" },
  { value: "tailor", labelKey: "category.profession.profTailor" },
  { value: "moving help", labelKey: "category.profession.profMovingHelp" },
  { value: "delivery", labelKey: "category.profession.profDelivery" },
  { value: "IT support", labelKey: "category.profession.profItSupport" },
  { value: "computer repair", labelKey: "category.profession.profComputerRepair" }
];

export const NOTIFICATION_FILTERS = ["needsAction", "alwen", "booking", "marketplace", "business", "community", "tyt", "payment", "profile", "system"];

/** Label/detail-key skeleton for the Home hero's four signal tiles, not
 * fabricated activity — currentLivingCitySignals() (main.js) always
 * overwrites events/jobs/rentals `value` with real counts from EVENTS and
 * listings, and weather's `value` with the real Open-Meteo response once
 * it loads. The literal values here (22°C/7/3/1) are only ever visible
 * for the weather tile, and only as a transient loading placeholder
 * before the first weather fetch resolves — never a persisted claim. */
export const livingCitySignals = [
  { labelKey: "home.signals.weatherLabel", value: "22°C", detailKey: "home.signals.weatherDetail" },
  { labelKey: "home.signals.eventsLabel", value: "7", detailKey: "home.signals.eventsDetail" },
  { labelKey: "home.signals.jobsLabel", value: "3", detailKey: "home.signals.jobsDetail" },
  { labelKey: "home.signals.apartmentsLabel", value: "1", detailKey: "home.signals.apartmentsDetail" }
];

/* ---------------------------------------------------------------------
   Everything below is fabricated demo/seed activity — real content
   only in development/test (see ./devFixtures.js); production always
   gets the empty value on the right, matching each field's own type.
--------------------------------------------------------------------- */

export const importSources = isFixturesAllowed() ? DEV.FIXTURE_importSources : [];
export const businessClaims = isFixturesAllowed() ? DEV.FIXTURE_businessClaims : [];
export const profileReviews = isFixturesAllowed() ? DEV.FIXTURE_profileReviews : [];
export const feedPosts = isFixturesAllowed() ? DEV.FIXTURE_feedPosts : [];
export const liveAroundYou = isFixturesAllowed() ? DEV.FIXTURE_liveAroundYou : [];
export const earnToday = isFixturesAllowed() ? DEV.FIXTURE_earnToday : [];
export const exploreHighlights = isFixturesAllowed() ? DEV.FIXTURE_exploreHighlights : [];
export const alwenRecommendations = isFixturesAllowed() ? DEV.FIXTURE_alwenRecommendations : [];
export const listings = isFixturesAllowed() ? DEV.FIXTURE_listings : [];
export const serviceProfessionals = isFixturesAllowed() ? DEV.FIXTURE_serviceProfessionals : [];
export const helpRequests = isFixturesAllowed() ? DEV.FIXTURE_helpRequests : [];
export const businesses = isFixturesAllowed() ? DEV.FIXTURE_businesses : [];
export const offers = isFixturesAllowed() ? DEV.FIXTURE_offers : [];
export const reservations = isFixturesAllowed() ? DEV.FIXTURE_reservations : [];
export const notifications = isFixturesAllowed() ? DEV.FIXTURE_notifications : [];
export const messageThreads = isFixturesAllowed() ? DEV.FIXTURE_messageThreads : [];
export const adminStats = isFixturesAllowed() ? DEV.FIXTURE_adminStats : [];

export const cityGraph = isFixturesAllowed() ? DEV.FIXTURE_cityGraph : { places: 0, businesses: 0, professionals: 0, listings: 0, jobs: 0, rentals: 0, offers: 0, events: 0, transport: 0, governmentOffices: 0 };
export const reputationProfile = isFixturesAllowed() ? DEV.FIXTURE_reputationProfile : { name: "", roleKey: "", city: "", portrait: null, cover: null, overall: 0, communityScore: 0, verifiedIdentity: false, verifiedSkillKeys: [], helpfulAnswers: 0, successfulJobs: 0, completedTransactions: 0, businessReviews: 0, neighbourRecommendations: 0, languagesSpokenKeys: [], contributionStreakCount: 0, localExpertBadgeKeys: [], verificationBadgeKeys: [], responseTime: "" };
export const alwenListingDraft = isFixturesAllowed() ? DEV.FIXTURE_alwenListingDraft : { prompt: "", title: "", description: "", suggestedPrice: "", category: "", summary: "", searchOptimisation: "", nearbyBuyers: "", suggestedImprovements: [], brand: "", model: "", condition: "", marketplaceCategory: "", deliveryOptions: [], pickupArea: "", recommendedBoost: "", tags: [], keywords: [], suggestedPhotos: [] };
export const alwenBusinessDraft = isFixturesAllowed() ? DEV.FIXTURE_alwenBusinessDraft : { prompt: "", name: "", description: "", cuisine: "", openingHours: "", categories: [], popularKeywords: [], suggestedPhotos: [], reservationSettings: "", menuSections: [], locationPlaceholder: "", claimStatus: "" };
