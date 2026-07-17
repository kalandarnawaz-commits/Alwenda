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

export const importSources = [
  {
    id: "osm",
    name: "OpenStreetMap / Overpass API",
    status: "Ready for connector",
    records: 1248,
    lastRun: "Mock run · 2026-07-05",
    fields: ["name", "amenity", "address", "coordinates", "opening_hours", "website", "phone"]
  },
  {
    id: "gov",
    name: "Government open data portals",
    status: "Schema mapping",
    records: 420,
    lastRun: "Mock run · 2026-07-03",
    fields: ["legal_name", "registry_id", "address", "activity_code", "status"]
  },
  {
    id: "tourism",
    name: "Tourism datasets",
    status: "Validated",
    records: 156,
    lastRun: "Mock run · 2026-07-02",
    fields: ["name", "category", "description", "photos", "website"]
  },
  {
    id: "registry",
    name: "Public business registries",
    status: "Needs verification",
    records: 890,
    lastRun: "Mock run · 2026-07-01",
    fields: ["company_name", "registration", "owner", "address", "activity"]
  },
  {
    id: "wikidata",
    name: "Wikidata landmarks",
    status: "Enrichment ready",
    records: 74,
    lastRun: "Mock run · 2026-06-30",
    fields: ["label", "description", "coordinates", "image", "external_ids"]
  },
  {
    id: "gtfs",
    name: "GTFS / public transport feeds",
    status: "Transport graph",
    records: 612,
    lastRun: "Mock run · 2026-06-29",
    fields: ["stops", "routes", "trips", "service_calendar", "coordinates"]
  }
];

import { SEED_CITY_ENTITIES, SEED_CITY_META } from "./seedCityData.js?v=seed-17";
import { buildDirectionsUrls } from "../services/dataImport/cityEntitySchema.js";

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

export const businessClaims = [
  {
    id: "claim-001",
    businessId: "wikidata:Q16464897",
    ownerName: "Ieva Kazlauskė",
    email: "owner@example.com",
    phone: "+370 600 00000",
    role: "Operations manager",
    verificationMethod: "Business email + registry document",
    documentUpload: "Pending upload",
    status: "pending"
  },
  {
    id: "claim-002",
    businessId: "osm:node/31453209",
    ownerName: "Sample Owner",
    email: "bakery@example.com",
    phone: "+370 611 11111",
    role: "Owner",
    verificationMethod: "Phone + storefront document",
    documentUpload: "Mock document attached",
    status: "approved"
  }
];

export const cityGraph = {
  places: 84,
  businesses: 52,
  professionals: 22,
  listings: 128,
  jobs: 18,
  rentals: 34,
  offers: 12,
  events: 9,
  transport: 612,
  governmentOffices: 14
};

export const economyMetrics = [
  { id: "earned", labelKey: "alwenWorkspace.opportunitiesCreated", value: 1840 },
  { id: "saved", labelKey: "alwenWorkspace.moneySaved", value: "€42k" },
  { id: "helped", labelKey: "alwenWorkspace.peopleHelped", value: 913 },
  { id: "verified", labelKey: "home.cityUpdates", value: 267 }
];

export const contributionActions = [
  {
    id: "answers",
    titleKey: "common.answerQuestions",
    description: "Help newcomers, tourists, and neighbours with practical city answers.",
    value: "+8 trust",
    connects: ["Resident", "Request", "Neighbourhood"]
  },
  {
    id: "business-hours",
    titleKey: "common.updateBusinessHours",
    description: "Correct opening hours and missing details for local businesses.",
    value: "+12 trust",
    connects: ["Business", "Place", "Review"]
  },
  {
    id: "verify-location",
    titleKey: "contribute.verifyLocations",
    description: "Confirm entrances, accessibility, photos, and map pins.",
    value: "+10 trust",
    connects: ["Place", "Map", "Transport"]
  },
  {
    id: "translate",
    titleKey: "translate.translateForOthers",
    description: "Translate a conversation, menu, listing, or public-service instruction.",
    value: "+15 trust",
    connects: ["User", "Business", "Government Office"]
  },
  {
    id: "local-task",
    titleKey: "common.completeLocalTask",
    description: "Complete a verified task, delivery, repair, pickup, or errand.",
    value: "+20 trust",
    connects: ["Professional", "Request", "Future Payment"]
  },
  {
    id: "review",
    titleKey: "common.writeUsefulReview",
    description: "Write a review that helps people decide where to spend time or money.",
    value: "+7 trust",
    connects: ["Business", "Offer", "Listing"]
  }
];

export const reputationProfile = {
  name: "Alex Walker",
  roleKey: "mock.repProfile.roleKey",
  city: "Vilnius",
  portrait: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80",
  cover: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=80",
  overall: 842,
  communityScore: 91,
  verifiedIdentity: true,
  verifiedSkillKeys: [
    "translate.language.langLithuanian",
    "translate.language.langEnglish",
    "mock.repProfile.skillLocalGuide",
    "mock.repProfile.skillFurnitureAssembly",
    "mock.repProfile.skillTranslation"
  ],
  helpfulAnswers: 48,
  successfulJobs: 17,
  completedTransactions: 29,
  businessReviews: 34,
  neighbourRecommendations: 12,
  languagesSpokenKeys: ["translate.language.langEnglish", "translate.language.langLithuanian", "translate.language.langPolish"],
  contributionStreakCount: 12,
  localExpertBadgeKeys: ["mock.repProfile.badgeVilniusStarter", "mock.repProfile.badgeTrustedHelper", "mock.repProfile.badgeMarketplacePro"],
  verificationBadgeKeys: ["mock.repProfile.badgeIdVerified", "mock.repProfile.badgePhoneVerified", "mock.repProfile.badgeSkillChecked"],
  responseTime: "14 min"
};

export const profileAchievements = [
  { titleKey: "mock.achievement.ach1Title", detailKey: "mock.achievement.ach1Detail", icon: "★" },
  { titleKey: "mock.achievement.ach2Title", detailKey: "mock.achievement.ach2Detail", icon: "◆" },
  { titleKey: "mock.achievement.ach3Title", detailKey: "mock.achievement.ach3Detail", icon: "✓" },
  { titleKey: "mock.achievement.ach4Title", detailKey: "mock.achievement.ach4Detail", icon: "A⇄" },
  { titleKey: "mock.achievement.ach5Title", detailKey: "mock.achievement.ach5Detail", icon: "✦" }
];

export const profileReviews = [
  { id: "review-1", author: "Ieva", rating: 5, textKey: "mock.review.review1Text", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80" },
  { id: "review-2", author: "Mantas", rating: 5, textKey: "mock.review.review2Text", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" },
  { id: "review-3", author: "Austėja", rating: 5, textKey: "mock.review.review3Text", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" }
];

export const reputationTimeline = [
  { dateKey: "mock.timeline.tl1Date", titleKey: "mock.timeline.tl1Title", detailKey: "mock.timeline.tl1Detail" },
  { dateKey: "mock.timeline.tl2Date", titleKey: "mock.timeline.tl2Title", detailKey: "mock.timeline.tl2Detail" },
  { dateKey: "mock.timeline.tl3Date", titleKey: "mock.timeline.tl3Title", detailKey: "mock.timeline.tl3Detail" },
  { dateKey: "mock.timeline.tl4Date", titleKey: "mock.timeline.tl4Title", detailKey: "mock.timeline.tl4Detail" }
];

export const cityGraphConnections = [
  { from: "Need Help request", to: "Verified professional", detail: "quote, availability, booking" },
  { from: "Imported business", to: "Claimed profile", detail: "owner, offers, jobs, products" },
  { from: "Marketplace listing", to: "User reputation", detail: "reviews, transactions, trust" },
  { from: "Contribution", to: "City knowledge graph", detail: "verified data, local context" },
  { from: "Tourist question", to: "Local expert", detail: "answers, translation, recommendations" }
];

export const neighbourhoods = [
  "Old Town",
  "Naujamiestis",
  "Užupis",
  "Žvėrynas",
  "Šnipiškės",
  "Antakalnis",
  "Paupys"
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
export const feedPosts = [
  {
    id: 1,
    authorId: "community-1",
    author: "Austėja",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    area: "Užupis",
    time: "12 min",
    type: "recommendation",
    verified: true,
    titleKey: "mock.feed.feed1Title",
    bodyKey: "mock.feed.feed1Body",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
    alwenSummaryKey: "mock.feed.feed1AlwenSummary",
    tags: ["work", "wifi", "newcomers"],
    replies: 8,
    helpful: 24,
    saves: 11
  },
  {
    id: 2,
    authorId: "community-2",
    author: "Jonas",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    area: "Naujamiestis",
    time: "38 min",
    type: "offer",
    verified: false,
    titleKey: "mock.feed.feed2Title",
    bodyKey: "mock.feed.feed2Body",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
    alwenSummaryKey: "mock.feed.feed2AlwenSummary",
    tags: ["free", "moving"],
    replies: 3,
    helpful: 17,
    saves: 6
  },
  {
    id: 3,
    authorId: "community-3",
    author: "Marta",
    avatar: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=240&q=80",
    area: "Old Town",
    time: "1 h",
    type: "recommendation",
    verified: false,
    titleKey: "mock.feed.feed3Title",
    bodyKey: "mock.feed.feed3Body",
    image: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=900&q=80",
    alwenSummaryKey: "mock.feed.feed3AlwenSummary",
    tags: ["health", "language"],
    replies: 12,
    helpful: 41,
    saves: 19
  },
  {
    id: 4,
    authorId: "community-4",
    author: "Rokas",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80",
    area: "Žvėrynas",
    time: "2 h",
    type: "lostFound",
    verified: false,
    titleKey: "mock.feed.feed4Title",
    bodyKey: "mock.feed.feed4Body",
    image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80",
    alwenSummaryKey: "mock.feed.feed4AlwenSummary",
    tags: ["lost dog", "alert"],
    replies: 21,
    helpful: 68,
    saves: 33
  },
  {
    id: 5,
    authorId: "community-5",
    author: "Eglė",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
    area: "Antakalnis",
    time: "3 h",
    type: "question",
    verified: true,
    titleKey: "mock.feed.feed5Title",
    bodyKey: "mock.feed.feed5Body",
    image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=900&q=80",
    alwenSummaryKey: "mock.feed.feed5AlwenSummary",
    tags: ["dentist", "family", "english"],
    replies: 16,
    helpful: 29,
    saves: 14
  },
  {
    id: 6,
    authorId: "community-6",
    author: "Vilnius Water Utility",
    avatar: "https://images.unsplash.com/photo-1590650046871-92c887180603?auto=format&fit=crop&w=240&q=80",
    area: "Naujamiestis",
    time: "45 min",
    type: "alert",
    verified: true,
    active: true,
    titleKey: "mock.feed.feed6Title",
    bodyKey: "mock.feed.feed6Body",
    alwenSummaryKey: "mock.feed.feed6AlwenSummary",
    tags: ["water", "maintenance"],
    replies: 5,
    helpful: 9,
    saves: 2
  },
  {
    id: 7,
    authorId: "community-7",
    author: "Gabija",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80",
    area: "Paupys",
    time: "4 h",
    type: "event",
    verified: false,
    titleKey: "mock.feed.feed7Title",
    bodyKey: "mock.feed.feed7Body",
    image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80",
    alwenSummaryKey: "mock.feed.feed7AlwenSummary",
    tags: ["market", "weekend"],
    replies: 6,
    helpful: 22,
    saves: 15
  },
  {
    id: 8,
    authorId: "community-8",
    author: "Vilnius City Council",
    avatar: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=240&q=80",
    area: "Šnipiškės",
    time: "6 h",
    type: "update",
    verified: true,
    titleKey: "mock.feed.feed8Title",
    bodyKey: "mock.feed.feed8Body",
    alwenSummaryKey: "mock.feed.feed8AlwenSummary",
    tags: ["cycling", "infrastructure"],
    replies: 14,
    helpful: 37,
    saves: 8
  },
  {
    id: 9,
    authorId: "community-9",
    author: "Tomas",
    avatar: "https://images.unsplash.com/photo-1500048993953-d23a436266cf?auto=format&fit=crop&w=240&q=80",
    area: "Žvėrynas",
    time: "8 h",
    type: "discussion",
    verified: false,
    titleKey: "mock.feed.feed9Title",
    bodyKey: "mock.feed.feed9Body",
    tags: ["neighbourhood", "green-space"],
    replies: 27,
    helpful: 19,
    saves: 4
  },
  {
    id: 10,
    authorId: "community-10",
    author: "Simona",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80",
    area: "Antakalnis",
    time: "1 d",
    type: "help",
    verified: false,
    titleKey: "mock.feed.feed10Title",
    bodyKey: "mock.feed.feed10Body",
    tags: ["moving", "heavy-lifting"],
    replies: 4,
    helpful: 13,
    saves: 3
  }
];

export const COMMUNITY_POST_TYPES = ["question", "recommendation", "alert", "offer", "help", "lostFound", "event", "update", "discussion"];

export const livingCitySignals = [
  { labelKey: "home.signals.weatherLabel", value: "22°C", detailKey: "home.signals.weatherDetail" },
  { labelKey: "home.signals.eventsLabel", value: "7", detailKey: "home.signals.eventsDetail" },
  { labelKey: "home.signals.jobsLabel", value: "3", detailKey: "home.signals.jobsDetail" },
  { labelKey: "home.signals.apartmentsLabel", value: "1", detailKey: "home.signals.apartmentsDetail" }
];

export const liveAroundYou = [
  { titleKey: "mock.live.live1Title", value: "€25", area: "Naujamiestis", urgencyKey: "mock.live.live1Urgency", signalKey: "mock.live.live1Signal", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.live.live2Title", value: "€40/hr", area: "Žvėrynas", urgencyKey: "mock.live.live2Urgency", signalKey: "mock.live.live2Signal", image: "https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.live.live3Title", value: "€120", area: "Paupys", urgencyKey: "mock.live.live3Urgency", signalKey: "mock.live.live3Signal", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.live.live4Title", value: "€30", area: "Old Town", urgencyKey: "mock.live.live4Urgency", signalKey: "mock.live.live4Signal", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80" }
];

export const trendingMarketplace = [
  { titleKey: "mock.trending.trending1Title", price: "€720", area: "Naujamiestis", type: "buy-sell", signalKey: "mock.trending.trending1Signal", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80", distanceMeters: 1100 },
  { titleKey: "mock.trending.trending2Title", price: "€850/mo", area: "Žvėrynas", type: "rentals", signalKey: "mock.trending.trending2Signal", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80", distanceMeters: 2600 },
  { titleKey: "mock.trending.trending3Title", price: "€7,900", area: "Antakalnis", type: "vehicles", signalKey: "mock.trending.trending3Signal", image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80", distanceMeters: 4800 },
  { titleKey: "mock.trending.trending4Title", price: "€50", area: "Paupys", type: "buy-sell", signalKey: "mock.trending.trending4Signal", image: "https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=900&q=80", distanceMeters: 700 }
];

export const earnToday = [
  { titleKey: "mock.earn.earn1Title", value: "€15", area: "Old Town", time: "45 min", fitKey: "mock.earn.earn1Fit", image: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn2Title", value: "€35", area: "Žvėrynas", time: "Today 17:30", fitKey: "mock.earn.earn2Fit", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn3Title", value: "€22", area: "Remote", time: "30 min", fitKey: "mock.earn.earn3Fit", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn4Title", value: "€18", area: "Paupys", time: "Tonight", fitKey: "mock.earn.earn4Fit", image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn5Title", value: "€30/hr", area: "Užupis", time: "Tomorrow", fitKey: "mock.earn.earn5Fit", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn6Title", value: "€40", area: "Šnipiškės", time: "Tonight", fitKey: "mock.earn.earn6Fit", image: "https://images.unsplash.com/photo-1581539250439-c96689b516dd?auto=format&fit=crop&w=900&q=80" }
];

export const exploreHighlights = [
  { titleKey: "mock.explore.explore1Title", typeKey: "mock.explore.explore1Type", area: "Paupys", imageTone: "mint", signalKey: "mock.explore.explore1Signal", image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1100&q=80" },
  { titleKey: "mock.explore.explore2Title", typeKey: "mock.explore.explore2Type", area: "Naujamiestis", imageTone: "gold", signalKey: "mock.explore.explore2Signal", image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.explore.explore3Title", typeKey: "mock.explore.explore3Type", area: "Old Town", imageTone: "rose", signalKey: "mock.explore.explore3Signal", image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.explore.explore4Title", typeKey: "mock.explore.explore4Type", area: "Užupis", imageTone: "sky", signalKey: "mock.explore.explore4Signal", image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.explore.explore5Title", typeKey: "mock.explore.explore5Type", area: "Naujamiestis", imageTone: "ink", signalKey: "mock.explore.explore5Signal", image: "https://images.unsplash.com/photo-1566054757965-8c4085344c96?auto=format&fit=crop&w=900&q=80" }
];

export const foodCategories = [
  { name: "Pizza", detail: "8 nearby", accent: "rose", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80" },
  { name: "Indian", detail: "4 open now", accent: "gold", image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80" },
  { name: "Turkish", detail: "5 nearby", accent: "mint", image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=800&q=80" },
  { name: "Italian", detail: "Reservations", accent: "sky", image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80" },
  { name: "Breakfast", detail: "Open early", accent: "cream", image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80" }
];

export const alwenRecommendations = [
  "mock.alwenRec.alwenRec1",
  "mock.alwenRec.alwenRec2",
  "mock.alwenRec.alwenRec3",
  "mock.alwenRec.alwenRec4",
  "mock.alwenRec.alwenRec5"
];

export const listings = [
  {
    id: 101,
    descriptionKey: "mock.listing.listing101Description",
    sellerId: "seller-101",
    type: "rentals",
    titleKey: "mock.listing.listing101Title",
    area: "Naujamiestis",
    price: "€720/mo",
    metaKey: "mock.listing.listing101Meta",
    status: "Verified",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80"],
    seller: "Ieva",
    sellerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "fast",
    sellerReputation: 92,
    pickupAvailable: true,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "1.6 km",
    popularity: "31 saves",
    aiPrice: "Fair rent · 92% confidence",
    aiInsight: "Below similar studios by €40/mo",
    cardSize: "tall"
  },
  {
    id: 102,
    descriptionKey: "mock.listing.listing102Description",
    sellerId: "seller-102",
    type: "services",
    titleKey: "mock.listing.listing102Title",
    area: "Šnipiškės",
    price: "€45",
    metaKey: "mock.listing.listing102Meta",
    status: "Open today",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80"],
    seller: "FixLab",
    sellerAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=240&q=80",
    sellerPhone: "+370 611 22334",
    sellerResponseTime: "fast",
    sellerReputation: 96,
    pickupAvailable: true,
    deliveryAvailable: true,
    verifiedSeller: true,
    distance: "2.1 km",
    popularity: "8 booked today",
    aiPrice: "AI price insight · 89% confidence",
    aiInsight: "Fastest verified repair nearby",
    cardSize: "compact"
  },
  {
    id: 103,
    descriptionKey: "mock.listing.listing103Description",
    sellerId: "seller-103",
    type: "jobs",
    titleKey: "mock.listing.listing103Title",
    area: "Old Town",
    price: "€8-10/hr",
    metaKey: "mock.listing.listing103Meta",
    status: "Hiring",
    image: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=80"],
    seller: "Taste Lab",
    sellerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "sameDay",
    sellerReputation: 88,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "1.2 km",
    commute: "8 min walk",
    workMode: "On-site",
    aiMatch: "88% match",
    popularity: "19 applicants",
    aiPrice: "Competitive pay",
    aiInsight: "Matches morning availability",
    cardSize: "wide"
  },
  {
    id: 110,
    descriptionKey: "mock.listing.listing110Description",
    sellerId: "seller-110",
    type: "jobs",
    titleKey: "mock.listing.listing110Title",
    area: "Užupis",
    price: "€2,800-3,400/mo",
    metaKey: "mock.listing.listing110Meta",
    status: "Hiring",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80"],
    seller: "Northlight Studio",
    sellerAvatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "sameDay",
    sellerReputation: 90,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "3.4 km",
    commute: "14 min by bike",
    workMode: "Hybrid",
    aiMatch: "95% match",
    popularity: "42 applicants",
    aiPrice: "Above market average",
    aiInsight: "Matches your product design skills",
    cardSize: "wide"
  },
  {
    id: 111,
    descriptionKey: "mock.listing.listing111Description",
    sellerId: "seller-111",
    type: "jobs",
    titleKey: "mock.listing.listing111Title",
    area: "EU timezone",
    price: "€1,600-1,900/mo",
    metaKey: "mock.listing.listing111Meta",
    status: "Hiring",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1000&q=80"],
    seller: "HelpDesk Vilnius",
    sellerAvatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "slow",
    sellerReputation: 84,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "Remote",
    commute: "No commute",
    workMode: "Remote",
    aiMatch: "81% match",
    popularity: "27 applicants",
    aiPrice: "Fair for role",
    aiInsight: "Matches your language skills",
    cardSize: "wide"
  },
  {
    id: 104,
    descriptionKey: "mock.listing.listing104Description",
    sellerId: "seller-104",
    type: "events",
    titleKey: "mock.listing.listing104Title",
    area: "Paupys",
    price: "Free",
    metaKey: "mock.listing.listing104Meta",
    status: "This week",
    image: "https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1555529771-835f59fc5efe?auto=format&fit=crop&w=1000&q=80"],
    seller: "Paupys Market",
    sellerAvatar: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "sameDay",
    sellerReputation: 89,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "2.7 km",
    popularity: "212 interested",
    aiPrice: "High demand",
    aiInsight: "Best window: 11:00-13:00",
    cardSize: "tall"
  },
  {
    id: 105,
    descriptionKey: "mock.listing.listing105Description",
    condition: "good",
    sellerId: "seller-105",
    type: "buy-sell",
    titleKey: "mock.listing.listing105Title",
    area: "Žvėrynas",
    price: "€90",
    metaKey: "mock.listing.listing105Meta",
    status: "Available",
    image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1000&q=80"],
    seller: "Marta",
    sellerAvatar: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=240&q=80",
    sellerPhone: "+370 622 44556",
    sellerResponseTime: "fast",
    sellerReputation: 91,
    pickupAvailable: true,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "3.4 km",
    popularity: "14 viewed today",
    aiPrice: "Below market · 95% confidence",
    aiInsight: "Likely to sell within 2 days",
    cardSize: "compact"
  },
  {
    id: 106,
    descriptionKey: "mock.listing.listing106Description",
    condition: "likeNew",
    sellerId: "seller-106",
    type: "vehicles",
    titleKey: "mock.listing.listing106Title",
    area: "Antakalnis",
    price: "€180",
    metaKey: "mock.listing.listing106Meta",
    status: "Available",
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=1000&q=80"],
    seller: "Tomas",
    sellerAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80",
    sellerPhone: "+370 633 66778",
    sellerResponseTime: "fast",
    sellerReputation: 87,
    pickupAvailable: true,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "4.8 km",
    popularity: "23 saves",
    aiPrice: "Fair price · 91% confidence",
    aiInsight: "Child seat increases demand",
    cardSize: "wide"
  },
  {
    id: 107,
    descriptionKey: "mock.listing.listing107Description",
    sellerId: "seller-107",
    type: "business-listings",
    titleKey: "mock.listing.listing107Title",
    area: "Old Town",
    price: "€18,000",
    metaKey: "mock.listing.listing107Meta",
    status: "Owner listed",
    image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1000&q=80"],
    seller: "Studio Owner",
    sellerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "slow",
    sellerReputation: 93,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "0.9 km",
    popularity: "6 buyer chats",
    aiPrice: "Premium listing",
    aiInsight: "Strong rating supports valuation",
    cardSize: "tall"
  },
  {
    id: 108,
    descriptionKey: "mock.listing.listing108Description",
    sellerId: "seller-108",
    type: "property",
    titleKey: "mock.listing.listing108Title",
    area: "Žvėrynas",
    price: "€890/mo",
    metaKey: "mock.listing.listing108Meta",
    status: "AI matched",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1000&q=80",
    gallery: ["https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1000&q=80", "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80"],
    seller: "Eika Homes",
    sellerAvatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=240&q=80",
    sellerPhone: "+370 644 88990",
    sellerResponseTime: "fast",
    sellerReputation: 95,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "2.0 km",
    popularity: "41 saves",
    aiPrice: "Budget match · 96% confidence",
    aiInsight: "Only 3 similar rentals nearby",
    cardSize: "wide"
  },
  {
    id: 109,
    descriptionKey: "mock.listing.listing109Description",
    sellerId: "seller-109",
    type: "community-requests",
    titleKey: "mock.listing.listing109Title",
    area: "Old Town",
    price: "€50 reward",
    metaKey: "mock.listing.listing109Meta",
    status: "Community alert",
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80",
    seller: "Community",
    sellerAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=240&q=80",
    sellerPhone: null,
    sellerResponseTime: "fast",
    sellerReputation: 78,
    pickupAvailable: false,
    deliveryAvailable: false,
    verifiedSeller: true,
    distance: "0.4 km",
    popularity: "58 neighbours saw this",
    aiPrice: "Urgent local signal",
    aiInsight: "High chance near Cathedral route",
    cardSize: "compact"
  }
];

export const serviceProfessionals = [
  {
    id: 501,
    name: "Mantas Home Fix",
    category: "Plumbing & repairs",
    categoryKey: "mock.proCategory.cat501",
    area: "Naujamiestis",
    rating: 4.9,
    reviews: 128,
    availability: "Tonight",
    price: "€35/hr",
    verified: true,
    skills: ["plumbing", "ikea assembly", "moving", "small repairs", "electrical"]
  },
  {
    id: 502,
    name: "CleanNest Vilnius",
    category: "Cleaning & childcare",
    categoryKey: "mock.proCategory.cat502",
    area: "Žvėrynas",
    rating: 4.8,
    reviews: 92,
    availability: "Tomorrow",
    price: "€28/hr",
    verified: true,
    skills: ["cleaning", "childcare", "laundry", "errands"]
  },
  {
    id: 503,
    name: "Aistė Tutors",
    category: "Tutoring & translation",
    categoryKey: "mock.proCategory.cat503",
    area: "Užupis",
    rating: 5.0,
    reviews: 41,
    availability: "Today 18:00",
    price: "€24/hr",
    verified: true,
    skills: ["tutoring", "lithuanian", "english", "homework", "translation"]
  },
  {
    id: 504,
    name: "North Legal & Tax",
    category: "Legal & accounting",
    categoryKey: "mock.proCategory.cat504",
    area: "Old Town",
    rating: 4.9,
    reviews: 63,
    availability: "Next slot today",
    price: "Quote",
    verified: true,
    skills: ["legal", "accounting", "contracts", "tax", "company setup"]
  },
  {
    id: 505,
    name: "PixelMove Studio",
    category: "Photography & IT",
    categoryKey: "mock.proCategory.cat505",
    area: "Paupys",
    rating: 4.7,
    reviews: 78,
    availability: "This week",
    price: "€45/hr",
    verified: true,
    skills: ["photography", "it support", "websites", "devices", "events"]
  },
  {
    id: 506,
    name: "Vilnius Electric Care",
    category: "Electrician",
    categoryKey: "mock.proCategory.cat506",
    area: "Šnipiškės",
    rating: 4.9,
    reviews: 86,
    availability: "Today 17:30",
    price: "€42/hr",
    verified: true,
    distance: "1.8 km",
    responseTime: "12 min",
    skills: ["electrician", "electrical", "lighting", "sockets", "safety check"]
  },
  {
    id: 507,
    name: "Route Driver LT",
    category: "Driver & delivery",
    categoryKey: "mock.proCategory.cat507",
    area: "Antakalnis",
    rating: 4.8,
    reviews: 54,
    availability: "Now",
    price: "Quote",
    verified: true,
    distance: "2.4 km",
    responseTime: "8 min",
    skills: ["driver", "delivery", "moving help", "airport", "courier"]
  },
  {
    id: 508,
    name: "StyleLab Mobile",
    category: "Beauty & tailoring",
    categoryKey: "mock.proCategory.cat508",
    area: "Old Town",
    rating: 4.7,
    reviews: 39,
    availability: "Tomorrow",
    price: "€30/hr",
    verified: true,
    distance: "1.1 km",
    responseTime: "25 min",
    skills: ["hair stylist", "makeup artist", "tailor", "events"]
  },
  {
    id: 509,
    name: "Auto & Bike Mate",
    category: "Mechanic",
    categoryKey: "mock.proCategory.cat509",
    area: "Paupys",
    rating: 4.8,
    reviews: 67,
    availability: "This afternoon",
    price: "€38/hr",
    verified: true,
    distance: "3.0 km",
    responseTime: "18 min",
    skills: ["mechanic", "bike repair", "car check", "vehicles"]
  },
  {
    id: 510,
    name: "Paws & Kids Care",
    category: "Babysitter & pet sitter",
    categoryKey: "mock.proCategory.cat510",
    area: "Žvėrynas",
    rating: 5.0,
    reviews: 44,
    availability: "Tonight",
    price: "€22/hr",
    verified: true,
    distance: "0.9 km",
    responseTime: "15 min",
    skills: ["babysitter", "pet sitter", "childcare", "dogs", "cats"]
  }
];

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

export const helpRequests = [
  {
    id: 601,
    titleKey: "mock.help.help1Title",
    area: "Naujamiestis",
    budget: "€60-90",
    urgencyKey: "mock.help.help1Urgency",
    statusKey: "mock.help.help1Status",
    quotes: ["Mantas Home Fix · €70 · 19:30", "FixLab Vilnius · €85 · 20:00"]
  },
  {
    id: 602,
    titleKey: "mock.help.help2Title",
    area: "Žvėrynas",
    budget: "€80-120",
    urgencyKey: "mock.help.help2Urgency",
    statusKey: "mock.help.help2Status",
    quotes: ["CleanNest Vilnius · €95 · 10:00"]
  }
];

export const businesses = [
  {
    id: 201,
    type: "restaurants",
    name: "Paupys Bistro",
    area: "Paupys",
    rating: 4.8,
    tagKeys: ["mock.biz.biz201Tag1", "mock.biz.biz201Tag2", "mock.biz.biz201Tag3"],
    hours: "Open until 22:00",
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1000&q=80",
    distance: "1.4 km",
    aiInsightKey: "mock.biz.biz201AiInsight",
    ecosystem: ["Verified Profile", "Claim Business", "Offers", "Bookings", "Reviews", "Questions & Answers", "AI Assistant", "Events", "Jobs", "Products", "Analytics Placeholder", "Premium Placeholder"],
    verified: true,
    address: "Paupio g. 5, Vilnius",
    phone: "+370 600 12345",
    aiSummaryKey: "mock.biz.biz201AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz201Service1", price: "€38" },
      { nameKey: "mock.biz.biz201Service2", price: "€120" },
      { nameKey: "mock.biz.biz201Service3", price: "€22" }
    ],
    openingHours: [
      { days: "Mon–Fri", hours: "12:00–22:00" },
      { days: "Sat–Sun", hours: "11:00–23:00" }
    ]
  },
  {
    id: 202,
    type: "hotels",
    name: "Neringa Hotel",
    area: "Naujamiestis",
    rating: 4.7,
    tagKeys: ["mock.biz.biz202Tag1", "mock.biz.biz202Tag2", "mock.biz.biz202Tag3"],
    hours: "24/7",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80",
    distance: "1.9 km",
    aiInsightKey: "mock.biz.biz202AiInsight",
    verified: true,
    address: "Gedimino pr. 23, Vilnius",
    phone: "+370 600 22334",
    aiSummaryKey: "mock.biz.biz202AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1568084680786-a84f91d1153c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz202Service1", price: "€89/night" },
      { nameKey: "mock.biz.biz202Service2", price: "€145/night" },
      { nameKey: "mock.biz.biz202Service3", price: "€25" }
    ],
    openingHours: [{ days: "Every day", hours: "24/7 front desk" }]
  },
  {
    id: 203,
    type: "service-apartments",
    name: "Vilnius Stay Suites",
    area: "Old Town",
    rating: 4.6,
    tagKeys: ["mock.biz.biz203Tag1", "mock.biz.biz203Tag2", "mock.biz.biz203Tag3"],
    hours: "Requests in 15 min",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80",
    distance: "0.8 km",
    aiInsightKey: "mock.biz.biz203AiInsight",
    verified: true,
    address: "Vokiečių g. 8, Vilnius",
    phone: "+370 600 33445",
    aiSummaryKey: "mock.biz.biz203AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz203Service1", price: "€850/mo" },
      { nameKey: "mock.biz.biz203Service2", price: "€1,050/mo" },
      { nameKey: "mock.biz.biz203Service3", price: "€20" }
    ],
    openingHours: [{ days: "Every day", hours: "Self check-in, 24/7" }]
  },
  {
    id: 204,
    type: "pharmacies",
    name: "Eurovaistinė Gedimino",
    area: "Old Town",
    rating: 4.5,
    tagKeys: ["mock.biz.biz204Tag1", "mock.biz.biz204Tag2", "mock.biz.biz204Tag3"],
    hours: "Open until 21:00",
    image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1000&q=80",
    distance: "0.6 km",
    aiInsightKey: "mock.biz.biz204AiInsight",
    verified: true,
    address: "Gedimino pr. 12, Vilnius",
    phone: "+370 600 44556",
    aiSummaryKey: "mock.biz.biz204AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1580281657702-257584239a55?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz204Service1", price: "Free" },
      { nameKey: "mock.biz.biz204Service2", price: "€5" },
      { nameKey: "mock.biz.biz204Service3", price: "€3" }
    ],
    openingHours: [
      { days: "Mon–Fri", hours: "08:00–21:00" },
      { days: "Sat–Sun", hours: "09:00–20:00" }
    ]
  },
  {
    id: 205,
    type: "clinics",
    name: "Northway Medical Centre",
    area: "Žvėrynas",
    rating: 4.6,
    tagKeys: ["mock.biz.biz205Tag1", "mock.biz.biz205Tag2", "mock.biz.biz205Tag3"],
    hours: "Next slot today",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1000&q=80",
    distance: "3.1 km",
    aiInsightKey: "mock.biz.biz205AiInsight",
    verified: true,
    address: "Žvėryno g. 15, Vilnius",
    phone: "+370 600 55667",
    aiSummaryKey: "mock.biz.biz205AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz205Service1", price: "€35" },
      { nameKey: "mock.biz.biz205Service2", price: "€90" },
      { nameKey: "mock.biz.biz205Service3", price: "Included" }
    ],
    openingHours: [{ days: "Mon–Sat", hours: "08:00–19:00" }]
  },
  {
    id: 206,
    type: "grocery",
    name: "Rimi Go",
    area: "Šnipiškės",
    rating: 4.4,
    tagKeys: ["mock.biz.biz206Tag1", "mock.biz.biz206Tag2", "mock.biz.biz206Tag3"],
    hours: "Open until 23:00",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=80",
    distance: "0.5 km",
    aiInsightKey: "mock.biz.biz206AiInsight",
    verified: true,
    address: "Konstitucijos pr. 7, Vilnius",
    phone: "+370 600 66778",
    aiSummaryKey: "mock.biz.biz206AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz206Service1", price: "Free" },
      { nameKey: "mock.biz.biz206Service2", price: "From €3.50" },
      { nameKey: "mock.biz.biz206Service3", price: "€2.90" }
    ],
    openingHours: [{ days: "Every day", hours: "07:00–23:00" }]
  },
  {
    id: 207,
    type: "repair",
    name: "FixLab Vilnius",
    area: "Antakalnis",
    rating: 4.9,
    tagKeys: ["mock.biz.biz207Tag1", "mock.biz.biz207Tag2", "mock.biz.biz207Tag3"],
    hours: "Open now",
    image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1000&q=80",
    distance: "4.2 km",
    aiInsightKey: "mock.biz.biz207AiInsight",
    verified: true,
    address: "Antakalnio g. 44, Vilnius",
    phone: "+370 600 77889",
    aiSummaryKey: "mock.biz.biz207AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz207Service1", price: "€45-90" },
      { nameKey: "mock.biz.biz207Service2", price: "€35" },
      { nameKey: "mock.biz.biz207Service3", price: "Free" }
    ],
    openingHours: [
      { days: "Mon–Fri", hours: "09:00–19:00" },
      { days: "Sat", hours: "10:00–16:00" }
    ]
  },
  {
    id: 208,
    type: "shops",
    name: "Locals Concept Store",
    area: "Užupis",
    rating: 4.7,
    tagKeys: ["mock.biz.biz208Tag1", "mock.biz.biz208Tag2", "mock.biz.biz208Tag3"],
    hours: "Open until 20:00",
    image: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=1000&q=80",
    distance: "2.5 km",
    aiInsightKey: "mock.biz.biz208AiInsight",
    verified: true,
    address: "Užupio g. 3, Vilnius",
    phone: "+370 600 88990",
    aiSummaryKey: "mock.biz.biz208AiSummary",
    gallery: [
      "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=80"
    ],
    services: [
      { nameKey: "mock.biz.biz208Service1", price: "Free" },
      { nameKey: "mock.biz.biz208Service2", price: "€6" },
      { nameKey: "mock.biz.biz208Service3", price: "From €18" }
    ],
    openingHours: [{ days: "Tue–Sun", hours: "11:00–20:00" }]
  }
];

export const offers = [
  {
    id: 301,
    vendor: "Paupys Bistro",
    titleKey: "mock.offer.offer1Title",
    value: "15% off",
    area: "Paupys",
    expires: "Today"
  },
  {
    id: 302,
    vendor: "FixLab Vilnius",
    titleKey: "mock.offer.offer2Title",
    value: "€0 check",
    area: "Antakalnis",
    expires: "3 days"
  },
  {
    id: 303,
    vendor: "Vilnius Stay Suites",
    titleKey: "mock.offer.offer3Title",
    value: "Late checkout",
    area: "Old Town",
    expires: "This week"
  }
];

export const events = [
  {
    id: 701,
    titleKey: "mock.event.event1Title",
    area: "Paupys",
    time: "Today 18:00",
    typeKey: "mock.event.event1Type",
    signalKey: "mock.event.event1Signal",
    image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: 702,
    titleKey: "mock.event.event2Title",
    area: "Old Town",
    time: "Tomorrow 11:00",
    typeKey: "mock.event.event2Type",
    signalKey: "mock.event.event2Signal",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: 703,
    titleKey: "mock.event.event3Title",
    area: "Naujamiestis",
    time: "Fri 09:00",
    typeKey: "mock.event.event3Type",
    signalKey: "mock.event.event3Signal",
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=80"
  }
];

export const reservations = [
  {
    id: 401,
    target: "Paupys Bistro",
    type: "Restaurant",
    date: "Tonight",
    status: "Pending confirmation",
    party: "2 guests"
  },
  {
    id: 402,
    target: "Vilnius Stay Suites",
    type: "Service apartment",
    date: "Jul 12-18",
    status: "Quote requested",
    party: "1 guest"
  },
  {
    id: 403,
    target: "FixLab Vilnius",
    type: "Service",
    date: "Tomorrow 10:00",
    status: "Awaiting slot",
    party: "Screen repair"
  }
];

export const alwenActions = [
  { view: "translate", labelKey: "mock.action.action1" },
  { view: "home", labelKey: "mock.action.action2" },
  { view: "marketplace", labelKey: "mock.action.action3" },
  { view: "hire", labelKey: "mock.action.action4" },
  { view: "home", labelKey: "mock.action.action5" },
  { view: "home", labelKey: "mock.action.action6" },
  { view: "home", labelKey: "mock.action.action7" },
  { view: "home", labelKey: "mock.action.action8" },
  { view: "home", labelKey: "mock.action.action9" }
];

export const alwenCapabilities = [
  { id: "talk", label: "Talk", detail: "Voice messages and spoken city requests" },
  { id: "image", label: "Image", detail: "Menus, products, documents, street signs" },
  { id: "document", label: "Document", detail: "Leases, invoices, forms, business papers" },
  { id: "handle", label: "Handle it", detail: "Multi-step city work that waits for approval" }
];

export const alwenWorkflows = [
  {
    id: "move-city",
    titleKey: "mock.workflow.workflow1Title",
    promptKey: "mock.workflow.workflow1Prompt",
    stepKeys: [
      "mock.workflow.workflow1Step1",
      "mock.workflow.workflow1Step2",
      "mock.workflow.workflow1Step3",
      "mock.workflow.workflow1Step4",
      "mock.workflow.workflow1Step5",
      "mock.workflow.workflow1Step6",
      "mock.workflow.workflow1Step7"
    ],
    approvalKey: "mock.workflow.workflow1Approval"
  },
  {
    id: "marketplace",
    titleKey: "mock.workflow.workflow2Title",
    promptKey: "mock.workflow.workflow2Prompt",
    stepKeys: [
      "mock.workflow.workflow2Step1",
      "mock.workflow.workflow2Step2",
      "mock.workflow.workflow2Step3",
      "mock.workflow.workflow2Step4",
      "mock.workflow.workflow2Step5",
      "mock.workflow.workflow2Step6"
    ],
    approvalKey: "mock.workflow.workflow2Approval"
  },
  {
    id: "hire",
    titleKey: "mock.workflow.workflow3Title",
    promptKey: "mock.workflow.workflow3Prompt",
    stepKeys: [
      "mock.workflow.workflow3Step1",
      "mock.workflow.workflow3Step2",
      "mock.workflow.workflow3Step3",
      "mock.workflow.workflow3Step4",
      "mock.workflow.workflow3Step5"
    ],
    approvalKey: "mock.workflow.workflow3Approval"
  }
];

export const alwenWorkspace = {
  priorities: [
    "mock.workspace.priority1",
    "mock.workspace.priority2",
    "mock.workspace.priority3"
  ],
  runningTasks: [
    { titleKey: "mock.workspace.task1Title", statusKey: "mock.workspace.task1Status", cadenceKey: "mock.workspace.task1Cadence" },
    { titleKey: "mock.workspace.task2Title", statusKey: "mock.workspace.task2Status", cadenceKey: "mock.workspace.task2Cadence" },
    { titleKey: "mock.workspace.task3Title", statusKey: "mock.workspace.task3Status", cadenceKey: "mock.workspace.task3Cadence" },
    { titleKey: "mock.workspace.task4Title", statusKey: "mock.workspace.task4Status", cadenceKey: "mock.workspace.task4Cadence" }
  ],
  suggestedActions: [
    "Tell Alwen to book airport pickup",
    "Create apartment viewing message",
    "Compare two clinics near home",
    "Translate lease document"
  ],
  savedWorkflows: ["mock.workspace.saved1", "mock.workspace.saved2", "mock.workspace.saved3", "mock.workspace.saved4"],
  pendingRequests: ["mock.workspace.pending1", "mock.workspace.pending2", "mock.workspace.pending3"],
  recommendations: ["mock.workspace.rec1", "mock.workspace.rec2", "mock.workspace.rec3"]
};

export const alwenAutomationTasks = [
  { commandKey: "mock.automation.auto1Command", outcomeKey: "mock.automation.auto1Outcome", moduleKey: "mock.automation.auto1Module" },
  { commandKey: "mock.automation.auto2Command", outcomeKey: "mock.automation.auto2Outcome", moduleKey: "mock.automation.auto2Module" },
  { commandKey: "mock.automation.auto3Command", outcomeKey: "mock.automation.auto3Outcome", moduleKey: "mock.automation.auto3Module" },
  { commandKey: "mock.automation.auto4Command", outcomeKey: "mock.automation.auto4Outcome", moduleKey: "mock.automation.auto4Module" },
  { commandKey: "mock.automation.auto5Command", outcomeKey: "mock.automation.auto5Outcome", moduleKey: "mock.automation.auto5Module" },
  { commandKey: "mock.automation.auto6Command", outcomeKey: "mock.automation.auto6Outcome", moduleKey: "mock.automation.auto6Module" }
];

export const cityMemory = [
  { labelKey: "mock.memory.mem1Label", valueKey: "mock.memory.mem1Value" },
  { labelKey: "mock.memory.mem2Label", valueKey: "mock.memory.mem2Value" },
  { labelKey: "mock.memory.mem3Label", valueKey: "mock.memory.mem3Value" },
  { labelKey: "mock.memory.mem4Label", valueKey: "mock.memory.mem4Value" },
  { labelKey: "mock.memory.mem5Label", valueKey: "mock.memory.mem5Value" },
  { labelKey: "mock.memory.mem6Label", valueKey: "mock.memory.mem6Value" },
  { labelKey: "mock.memory.mem7Label", valueKey: "mock.memory.mem7Value" },
  { labelKey: "mock.memory.mem8Label", valueKey: "mock.memory.mem8Value" }
];

export const businessAiExamples = [
  {
    business: "Paupys Bistro",
    agent: "Restaurant help",
    questions: ["Do you have vegan food?", "Can I bring my dog?", "What is today's special?", "Book tomorrow."]
  },
  {
    business: "North Legal & Tax",
    agent: "Legal help",
    questions: ["Can you review a lease?", "Do you handle tax registration?", "Book consultation tomorrow."]
  },
  {
    business: "Northway Medical Centre",
    agent: "Clinic help",
    questions: ["Do you speak English?", "Is parking available?", "Find the next appointment."]
  }
];

export const alwenListingDraft = {
  prompt: "I want to sell my iPhone 15 Pro, 256GB, excellent condition.",
  title: "iPhone 15 Pro 256GB in excellent condition",
  description: "Well-kept iPhone 15 Pro with 256GB storage. Excellent condition, clean screen, strong battery, and ready for pickup in Vilnius. Ideal for anyone upgrading without paying new retail price.",
  suggestedPrice: "€820-890",
  category: "Buy & Sell",
  summary: "Excellent-condition Apple phone, priced to sell locally.",
  searchOptimisation: "Optimised for iPhone, Apple, unlocked phone, 256GB, Vilnius electronics.",
  nearbyBuyers: "42 likely buyers within 5 km",
  suggestedImprovements: ["Add battery health photo", "Mention warranty or receipt", "Offer public pickup spot"],
  brand: "Apple",
  model: "iPhone 15 Pro",
  condition: "Excellent",
  marketplaceCategory: "Electronics",
  deliveryOptions: ["Pickup", "Courier in Vilnius", "Meet in public place"],
  pickupArea: "Naujamiestis",
  recommendedBoost: "Boost for 48 hours near Apple, phone, and electronics searches",
  tags: ["smartphone", "apple", "iphone", "256gb", "excellent condition"],
  keywords: ["iPhone 15 Pro", "Apple phone", "256GB", "unlocked", "Vilnius"],
  suggestedPhotos: ["front screen", "back glass", "camera close-up", "battery health", "box/accessories"]
};

export const alwenServiceDraft = {
  prompt: "I need somebody to assemble IKEA furniture tomorrow.",
  serviceCategory: "Furniture assembly",
  suggestedBudget: "€60-90",
  estimatedDuration: "2-3 hours",
  suggestedTimeSlots: ["Tomorrow 10:00", "Tomorrow 14:00", "Tomorrow 18:30"],
  distanceRadius: "3 km",
  priority: "Normal",
  nearbyProviders: ["Mantas Home Fix", "Route Driver LT", "CleanNest Vilnius"],
  generatedRequest: "Assemble IKEA furniture tomorrow in Naujamiestis. Please bring basic tools and confirm available time slot."
};

export const alwenBusinessDraft = {
  prompt: "We're a new Italian restaurant opening in Vilnius.",
  name: "New Italian Restaurant",
  description: "A warm Italian restaurant launching in Vilnius with handmade pasta, seasonal ingredients, and relaxed neighbourhood dining.",
  cuisine: "Italian",
  openingHours: "Tue-Sun 12:00-22:00",
  categories: ["Restaurant", "Italian", "Dinner", "Reservations"],
  popularKeywords: ["pasta", "pizza", "date night", "family dinner", "Italian wine"],
  suggestedPhotos: ["exterior", "dining room", "signature pasta", "chef portrait", "menu"],
  reservationSettings: "Accept dinner reservations for 2-6 guests, 90 minute tables",
  menuSections: ["Antipasti", "Pasta", "Pizza", "Mains", "Desserts", "Wine"],
  locationPlaceholder: "Vilnius address pending",
  claimStatus: "Draft claim ready"
};

export const alwenProfileConversation = {
  opening: "Hi, I'm Alwen. What brings you to Alwenda today?",
  replies: [
    "I just moved to Vilnius and need help settling in.",
    "Great. I'll build your city profile and keep it useful as you use Alwenda."
  ],
  generatedProfile: {
    name: "Alex",
    languages: ["English", "Lithuanian learning"],
    interests: ["food", "housing", "local services", "events"],
    skills: ["IT support", "translation help"],
    profession: "Product designer",
    servicesOffered: ["Website feedback", "English editing"],
    favouriteCategories: ["Restaurants", "Rentals", "Services", "Transport"],
    homeCity: "London",
    currentCity: "Vilnius",
    verificationProgress: "Phone ready · ID next"
  }
};

export const alwenCityCompanionPlan = {
  prompt: "I just moved to Vilnius.",
  title: "Your first week in Vilnius",
  items: [
    "Shortlist apartments and move-in essentials",
    "Residence registration checklist",
    "Bank account and local payment setup",
    "SIM card and mobile data",
    "Schools and childcare options",
    "Healthcare, clinics, and pharmacies nearby",
    "Public transport card and route basics",
    "Nearest grocery stores and markets",
    "Neighbourhood groups and local experts",
    "Important government offices"
  ]
};

export const smartAutocompleteExamples = [
  { label: "Brand", typed: "iph", suggestion: "iPhone 15 Pro 256GB" },
  { label: "Address", typed: "Gedimino", suggestion: "Gedimino pr. 9, Vilnius" },
  { label: "Vehicle", typed: "Toyota cor", suggestion: "Toyota Corolla Hybrid 2021" },
  { label: "Apartment", typed: "2 bedroom under", suggestion: "2 bedroom apartment under €900 in Naujamiestis" },
  { label: "Skill", typed: "elec", suggestion: "electrician for sockets and lighting" },
  { label: "Price", typed: "excellent iphone", suggestion: "suggested price €820-890" }
];

export const contributionScores = [
  { id: "reputation", labelKey: "contribute.scores.reputation", value: 842 },
  { id: "trust", labelKey: "contribute.scores.trust", value: 91 },
  { id: "contributionPoints", labelKey: "contribute.scores.contributionPoints", value: 1260 },
  { id: "marketplaceScore", labelKey: "contribute.scores.marketplaceScore", value: 94 },
  { id: "professionalScore", labelKey: "contribute.scores.professionalScore", value: 88 },
  { id: "communityScore", labelKey: "contribute.scores.communityScore", value: 91 },
  { id: "translationScore", labelKey: "contribute.scores.translationScore", value: 76 },
  { id: "businessScore", labelKey: "contribute.scores.businessScore", value: 83 }
];

export const proactiveBriefing = [
  {
    signalKey: "mock.briefing.briefing1Signal",
    titleKey: "mock.briefing.briefing1Title",
    detailKey: "mock.briefing.briefing1Detail"
  },
  {
    signalKey: "mock.briefing.briefing2Signal",
    titleKey: "mock.briefing.briefing2Title",
    detailKey: "mock.briefing.briefing2Detail"
  },
  {
    signalKey: "mock.briefing.briefing3Signal",
    titleKey: "mock.briefing.briefing3Title",
    detailKey: "mock.briefing.briefing3Detail"
  },
  {
    signalKey: "mock.briefing.briefing4Signal",
    titleKey: "mock.briefing.briefing4Title",
    detailKey: "mock.briefing.briefing4Detail"
  }
];

export const earningOpportunities = [
  {
    titleKey: "mock.earnOpp.earnOpp1Title",
    value: "€28-42",
    time: "Today 18:30",
    matchKey: "mock.earnOpp.earnOpp1Match"
  },
  {
    titleKey: "mock.earnOpp.earnOpp2Title",
    value: "€60-90",
    time: "Tonight",
    matchKey: "mock.earnOpp.earnOpp2Match"
  },
  {
    titleKey: "mock.earnOpp.earnOpp3Title",
    value: "€25-40",
    time: "Tomorrow",
    matchKey: "mock.earnOpp.earnOpp3Match"
  },
  {
    titleKey: "mock.earnOpp.earnOpp4Title",
    value: "€35-70",
    time: "This week",
    matchKey: "mock.earnOpp.earnOpp4Match"
  },
  {
    titleKey: "mock.earnOpp.earnOpp5Title",
    value: "+45 points",
    time: "Anytime",
    matchKey: "mock.earnOpp.earnOpp5Match"
  }
];

export const reputationSignals = [
  { label: "Verified Identity", labelKey: "mock.signal.sig1Label", valueKey: "mock.signal.sig1Value", detailKey: "mock.signal.sig1Detail" },
  { label: "Verified Skills", labelKey: "mock.signal.sig2Label", valueKey: "mock.signal.sig2Value", detailKey: "mock.signal.sig2Detail" },
  { label: "Response Rate", labelKey: "mock.signal.sig3Label", value: "96%", detailKey: "mock.signal.sig3Detail" },
  { label: "Completion Rate", labelKey: "mock.signal.sig4Label", value: "94%", detailKey: "mock.signal.sig4Detail" },
  { label: "Recommendation %", labelKey: "mock.signal.sig5Label", value: "98%", detailKey: "mock.signal.sig5Detail" },
  { label: "Neighbour Rating", labelKey: "mock.signal.sig6Label", value: "4.9", detailKey: "mock.signal.sig6Detail" },
  { label: "Business Rating", labelKey: "mock.signal.sig7Label", value: "4.8", detailKey: "mock.signal.sig7Detail" },
  { label: "Future Points", labelKey: "mock.signal.sig8Label", value: "1,260", detailKey: "mock.signal.sig8Detail" }
];

export const cityKnowledgeObjects = [
  { type: "User", name: "Alex", connectsTo: ["Profile", "Trust Score", "Marketplace", "Tasks"] },
  { type: "Business", name: "Paupys Bistro", connectsTo: ["Restaurant", "Offers", "Bookings", "Reviews"] },
  { type: "Professional", name: "Mantas Home Fix", connectsTo: ["Hire", "Tasks", "Ratings", "Payments future"] },
  { type: "Property", name: "Two-bedroom apartment near river", connectsTo: ["Neighbourhood", "Transport", "Budget", "Availability watch"] },
  { type: "Government office", name: "Residence registration", connectsTo: ["Move workflow", "Documents", "Translation", "Reminders"] },
  { type: "Transport", name: "Airport pickup", connectsTo: ["Driver", "Booking", "Traffic", "Messages"] },
  { type: "Offer", name: "Lunch set for newcomers", connectsTo: ["Business", "Wallet future", "Recommendation", "Time"] },
  { type: "Community", name: "Lost wallet alert", connectsTo: ["Neighbourhood", "Messages", "Trust", "Notifications"] }
];

export const backendTodoPlaceholders = [
  "TODO: Replace mock intent routing with AI intent classifier and workflow planner API.",
  "TODO: Connect proactive briefing to weather, traffic, events, offers, jobs, and notification APIs.",
  "TODO: Persist city memory, trust metrics, and workflow approvals through authenticated user profiles.",
  "TODO: Map city knowledge graph entities to backend IDs for places, users, businesses, jobs, transport, and government offices.",
  "TODO: Attach secure payments, booking systems, and messaging transport after authentication."
];

/**
 * type: which source/category a notification belongs to — drives icon,
 * filter chip, and grouping. priority: "urgent" | "high" | "normal" |
 * "success" — drives the accent colour and whether it surfaces in the
 * "Needs action" summary. timeGroup: "now" | "today" | "yesterday" |
 * "week" | "earlier" — drives section grouping (mock data has no real
 * timestamps, so the bucket is authored directly rather than computed).
 * primaryActionView routes through the same [data-view] handler every
 * other button in the app already uses; primaryActionSheet opens a
 * sheet instead for actions that don't have their own screen.
 */
export const notifications = [
  {
    id: 801,
    type: "alwen",
    priority: "urgent",
    titleKey: "mock.notif.notif1Title",
    summaryKey: "mock.notif.notif1Summary",
    timeKey: "mock.notif.notif1Time",
    timeGroup: "now",
    unread: true,
    completed: false,
    primaryActionKey: "mock.notif.notif1Action",
    primaryActionView: "alwen"
  },
  {
    id: 802,
    type: "marketplace",
    priority: "high",
    titleKey: "mock.notif.notif2Title",
    summaryKey: "mock.notif.notif2Summary",
    timeKey: "mock.notif.notif2Time",
    timeGroup: "now",
    unread: true,
    completed: false,
    primaryActionKey: "mock.notif.notif2Action",
    primaryActionView: "marketplace"
  },
  {
    id: 803,
    type: "booking",
    priority: "urgent",
    titleKey: "mock.notif.notif3Title",
    summaryKey: "mock.notif.notif3Summary",
    timeKey: "mock.notif.notif3Time",
    timeGroup: "today",
    unread: true,
    completed: false,
    primaryActionKey: "mock.notif.notif3Action",
    primaryActionView: "reservations"
  },
  {
    id: 806,
    type: "business",
    priority: "high",
    titleKey: "mock.notif.notif6Title",
    summaryKey: "mock.notif.notif6Summary",
    timeKey: "mock.notif.notif6Time",
    timeGroup: "today",
    unread: true,
    completed: false,
    primaryActionKey: "mock.notif.notif6Action",
    primaryActionView: "businessDashboard"
  },
  {
    id: 804,
    type: "community",
    priority: "normal",
    titleKey: "mock.notif.notif4Title",
    summaryKey: "mock.notif.notif4Summary",
    timeKey: "mock.notif.notif4Time",
    timeGroup: "yesterday",
    unread: false,
    completed: false,
    primaryActionKey: "mock.notif.notif4Action",
    primaryActionView: "community"
  },
  {
    id: 807,
    type: "payment",
    priority: "success",
    titleKey: "mock.notif.notif7Title",
    summaryKey: "mock.notif.notif7Summary",
    timeKey: "mock.notif.notif7Time",
    timeGroup: "yesterday",
    unread: false,
    completed: true,
    primaryActionKey: "mock.notif.notif7Action",
    primaryActionView: "marketplace"
  },
  {
    id: 808,
    type: "tyt",
    priority: "normal",
    titleKey: "mock.notif.notif8Title",
    summaryKey: "mock.notif.notif8Summary",
    timeKey: "mock.notif.notif8Time",
    timeGroup: "week",
    unread: false,
    completed: false,
    primaryActionKey: "mock.notif.notif8Action",
    primaryActionSheet: "tyt"
  },
  {
    id: 809,
    type: "profile",
    priority: "normal",
    titleKey: "mock.notif.notif9Title",
    summaryKey: "mock.notif.notif9Summary",
    timeKey: "mock.notif.notif9Time",
    timeGroup: "week",
    unread: false,
    completed: false,
    primaryActionKey: "mock.notif.notif9Action",
    primaryActionView: "publicProfile"
  },
  {
    id: 805,
    type: "system",
    priority: "normal",
    titleKey: "mock.notif.notif5Title",
    summaryKey: "mock.notif.notif5Summary",
    timeKey: "mock.notif.notif5Time",
    timeGroup: "earlier",
    unread: false,
    completed: false,
    primaryActionKey: "mock.notif.notif5Action",
    primaryActionView: "settings"
  },
  {
    id: 810,
    type: "system",
    priority: "success",
    titleKey: "mock.notif.notif10Title",
    summaryKey: "mock.notif.notif10Summary",
    timeKey: "mock.notif.notif10Time",
    timeGroup: "earlier",
    unread: false,
    completed: true,
    primaryActionKey: "mock.notif.notif10Action",
    primaryActionView: "profile"
  }
];

export const NOTIFICATION_FILTERS = ["needsAction", "alwen", "booking", "marketplace", "business", "community", "tyt", "payment", "profile", "system"];

export const messageThreads = [
  {
    id: 901,
    type: "professional",
    participant: "Mantas Home Fix",
    verified: true,
    preview: "I can assemble the IKEA wardrobe tomorrow at 18:30 for €75.",
    unread: 2,
    timeKey: "mock.thread.thread1Time",
    context: { kind: "quote", titleKey: "mock.thread.thread1ContextTitle", metaKey: "mock.thread.thread1ContextMeta" },
    messages: [
      { from: "them", textKey: "mock.thread.thread1Msg1", timeKey: "mock.thread.thread1Msg1Time" },
      { from: "me", textKey: "mock.thread.thread1Msg2", timeKey: "mock.thread.thread1Msg2Time" },
      { from: "them", textKey: "mock.thread.thread1Msg3", timeKey: "mock.thread.thread1Msg3Time" }
    ]
  },
  {
    id: 902,
    type: "business",
    participant: "Paupys Bistro",
    verified: true,
    preview: "We can hold a table for six until 17:00.",
    unread: 1,
    timeKey: "mock.thread.thread2Time",
    context: { kind: "booking", titleKey: "mock.thread.thread2ContextTitle", metaKey: "mock.thread.thread2ContextMeta" },
    messages: [
      { from: "them", textKey: "mock.thread.thread2Msg1", timeKey: "mock.thread.thread2Msg1Time" },
      { from: "them", textKey: "mock.thread.thread2Msg2", timeKey: "mock.thread.thread2Msg2Time" }
    ]
  },
  {
    id: 903,
    type: "marketplace",
    participant: "Nearby buyer",
    verified: false,
    preview: "Is the iPhone still available for pickup today?",
    unread: 0,
    timeKey: "mock.thread.thread3Time",
    context: { kind: "listing", titleKey: "mock.thread.thread3ContextTitle", metaKey: "mock.thread.thread3ContextMeta" },
    messages: [
      { from: "them", textKey: "mock.thread.thread3Msg1", timeKey: "mock.thread.thread3Msg1Time" },
      { from: "me", textKey: "mock.thread.thread3Msg2", timeKey: "mock.thread.thread3Msg2Time" }
    ]
  },
  {
    id: 904,
    type: "alwen",
    participant: "Alwen",
    verified: true,
    preview: "I grouped your city setup tasks and can complete the next three after approval.",
    unread: 0,
    timeKey: "mock.thread.thread4Time",
    context: { kind: "plan", titleKey: "mock.thread.thread4ContextTitle", metaKey: "mock.thread.thread4ContextMeta" },
    messages: [
      { from: "them", textKey: "mock.thread.thread4Msg1", timeKey: "mock.thread.thread4Msg1Time" }
    ]
  }
];

export const adminStats = [
  { labelKey: "admin.adminListings", value: 128, trend: "+18%" },
  { labelKey: "admin.adminBusinesses", value: 84, trend: "+9%" },
  { labelKey: "admin.adminReservations", value: 31, trend: "+24%" },
  { labelKey: "admin.adminTranslations", value: 642, trend: "+41%" }
];
