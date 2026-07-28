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

export const profileReviews = [
  { id: "review-1", author: "Ieva", rating: 5, textKey: "mock.review.review1Text", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80" },
  { id: "review-2", author: "Mantas", rating: 5, textKey: "mock.review.review2Text", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" },
  { id: "review-3", author: "Austėja", rating: 5, textKey: "mock.review.review3Text", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" }
];

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

export const earnToday = [
  { titleKey: "mock.earn.earn1Title", value: "€15", area: "Old Town", time: "45 min", fitKey: "mock.earn.earn1Fit", image: "https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn2Title", value: "€35", area: "Žvėrynas", time: "Today 17:30", fitKey: "mock.earn.earn2Fit", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn3Title", value: "€22", area: "Remote", time: "30 min", fitKey: "mock.earn.earn3Fit", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn4Title", value: "€18", area: "Paupys", time: "Tonight", fitKey: "mock.earn.earn4Fit", image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn5Title", value: "€30/hr", area: "Užupis", time: "Tomorrow", fitKey: "mock.earn.earn5Fit", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80" },
  { titleKey: "mock.earn.earn6Title", value: "€40", area: "Šnipiškės", time: "Tonight", fitKey: "mock.earn.earn6Fit", image: "https://images.unsplash.com/photo-1581539250439-c96689b516dd?auto=format&fit=crop&w=900&q=80" }
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
