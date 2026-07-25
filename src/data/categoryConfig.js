/**
 * CATEGORY_CONFIG — the master "life category" taxonomy for opportunity-side
 * features (Earn Today, Live Around You, TYT posting defaults, Ask Alwen
 * classification). This is deliberately NOT a replacement for the app's
 * other, already-correct category systems — `categories` (marketplace,
 * src/data/mockData.js), `professionalCategories` (hire trades, same file),
 * or `CITY_ENTITY_CATEGORIES` (Explore's real imported-place taxonomy,
 * src/services/dataImport/cityEntitySchema.js). Those are real-data-backed
 * and working; this module maps INTO them via each entry's
 * hireCategoryValues/marketplaceCategoryId/listingDbCategory/
 * cityEntityCategory fields rather than duplicating or replacing them.
 *
 * `icon` values are real emoji (matching EXPLORE_CATEGORY_EMOJI's register
 * in main.js, not the app's abstract iconMap() glyph set) — the "Wolt-style
 * colourful category grid" convention already established by
 * renderCategoryTileGrid/renderExploreHubCard.
 */

const CATEGORY_ORDER = [
  "delivery",
  "transport",
  "petCare",
  "teaching",
  "shopping",
  "technology",
  "cleaning",
  "homeRepairs",
  "gardening",
  "fitness",
  "food",
  "creative",
  "business",
  "childcare",
  "elderCare",
  "events",
  "legal",
  "medical",
  "other"
];

export const CATEGORY_CONFIG = Object.freeze({
  delivery: {
    icon: "📦",
    labelKey: "category.life.delivery",
    keywords: ["deliver", "delivery", "package", "parcel", "courier", "drop off"],
    legacyAliases: ["Delivery"],
    opportunityCategories: ["Delivery"],
    hireCategoryValues: ["delivery"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.delivery.titlePlaceholder", aiPromptKey: "categoryConfig.delivery.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "fixed", distanceOptions: [1, 5, 10] }
  },
  transport: {
    icon: "🚗",
    labelKey: "category.life.transport",
    keywords: ["airport", "pickup", "drive me", "driver", "ride", "transport", "taxi", "lift", "moving", "movers"],
    legacyAliases: ["Transport", "Moving", "moving help", "driver", "mechanic", "Automobile"],
    opportunityCategories: ["Transport", "Moving"],
    hireCategoryValues: ["driver", "moving help", "mechanic"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Automobile",
    posting: { titlePlaceholderKey: "categoryConfig.transport.titlePlaceholder", aiPromptKey: "categoryConfig.transport.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "fixed", distanceOptions: [5, 10, 25, 50] }
  },
  petCare: {
    icon: "🐾",
    labelKey: "category.life.petCare",
    keywords: ["pet", "dog", "cat", "walk my dog", "petsit", "pet sitter"],
    legacyAliases: ["Pet care", "pet sitter"],
    opportunityCategories: ["Pet care"],
    hireCategoryValues: ["pet sitter"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Pet Services",
    posting: { titlePlaceholderKey: "categoryConfig.petCare.titlePlaceholder", aiPromptKey: "categoryConfig.petCare.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10] }
  },
  teaching: {
    icon: "📚",
    labelKey: "category.life.teaching",
    keywords: ["teach", "tutor", "lesson", "english", "language", "translat", "homework", "study"],
    legacyAliases: ["Tutoring", "Translation", "tutor", "translator", "language help"],
    opportunityCategories: ["Tutoring", "Translation"],
    hireCategoryValues: ["tutor", "translator"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Education",
    posting: { titlePlaceholderKey: "createListing.intentTeachTitlePlaceholder", aiPromptKey: "categoryConfig.teaching.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10, 25] }
  },
  shopping: {
    icon: "🛍️",
    labelKey: "category.life.shopping",
    keywords: ["shop", "shopping", "groceries", "grocery", "errand", "buy for me"],
    legacyAliases: ["Shops", "Groceries"],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "buy-sell",
    listingDbCategory: "buy_sell",
    cityEntityCategory: "Shops",
    posting: { titlePlaceholderKey: "categoryConfig.shopping.titlePlaceholder", aiPromptKey: "categoryConfig.shopping.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "fixed", distanceOptions: [1, 5, 10] }
  },
  technology: {
    icon: "💻",
    labelKey: "category.life.technology",
    keywords: ["computer", "laptop", "it support", "tech help", "software", "wifi", "printer"],
    legacyAliases: ["IT support", "computer repair"],
    opportunityCategories: [],
    hireCategoryValues: ["IT support", "computer repair"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.technology.titlePlaceholder", aiPromptKey: "categoryConfig.technology.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10, 25] }
  },
  cleaning: {
    icon: "🧹",
    labelKey: "category.life.cleaning",
    keywords: ["clean", "cleaning", "cleaner", "tidy"],
    legacyAliases: ["cleaner"],
    opportunityCategories: [],
    hireCategoryValues: ["cleaner"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.cleaning.titlePlaceholder", aiPromptKey: "categoryConfig.cleaning.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10] }
  },
  homeRepairs: {
    icon: "🔧",
    labelKey: "category.life.homeRepairs",
    keywords: ["plumb", "plumber", "leak", "pipe", "electric", "electrician", "wiring", "paint", "painter", "carpenter", "assemble", "ikea", "furniture", "repair", "fix"],
    legacyAliases: ["Home services", "plumber", "electrician", "carpenter", "painter"],
    opportunityCategories: ["Home services"],
    hireCategoryValues: ["plumber", "electrician", "carpenter", "painter"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Home Services",
    posting: { titlePlaceholderKey: "categoryConfig.homeRepairs.titlePlaceholder", aiPromptKey: "categoryConfig.homeRepairs.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "fixed", distanceOptions: [1, 5, 10] }
  },
  gardening: {
    icon: "🌱",
    labelKey: "category.life.gardening",
    keywords: ["garden", "gardening", "lawn", "plants", "yard"],
    legacyAliases: [],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.gardening.titlePlaceholder", aiPromptKey: "categoryConfig.gardening.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "fixed", distanceOptions: [1, 5, 10] }
  },
  fitness: {
    icon: "🏋️",
    labelKey: "category.life.fitness",
    keywords: ["fitness", "gym", "personal trainer", "workout", "training"],
    legacyAliases: ["personal trainer"],
    opportunityCategories: [],
    hireCategoryValues: ["personal trainer"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.fitness.titlePlaceholder", aiPromptKey: "categoryConfig.fitness.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10] }
  },
  food: {
    icon: "🍽️",
    labelKey: "category.life.food",
    keywords: ["food", "cook", "catering", "meal", "restaurant", "bakery"],
    legacyAliases: ["Food & Drink"],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Food & Drink",
    posting: { titlePlaceholderKey: "categoryConfig.food.titlePlaceholder", aiPromptKey: "categoryConfig.food.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "fixed", distanceOptions: [1, 5, 10] }
  },
  creative: {
    icon: "🎨",
    labelKey: "category.life.creative",
    keywords: ["photo", "photographer", "design", "creative", "video", "art"],
    legacyAliases: ["Creative", "photographer"],
    opportunityCategories: ["Creative"],
    hireCategoryValues: ["photographer"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.creative.titlePlaceholder", aiPromptKey: "categoryConfig.creative.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "quote", distanceOptions: [5, 10, 25] }
  },
  business: {
    icon: "💼",
    labelKey: "category.life.business",
    keywords: ["accountant", "accounting", "bookkeeping", "business help", "consult", "finance"],
    legacyAliases: ["accountant", "Finance"],
    opportunityCategories: [],
    hireCategoryValues: ["accountant"],
    marketplaceCategoryId: "business-listings",
    listingDbCategory: "businesses",
    cityEntityCategory: "Finance",
    posting: { titlePlaceholderKey: "categoryConfig.business.titlePlaceholder", aiPromptKey: "categoryConfig.business.aiPrompt", requiredFields: ["title", "description"], pricingModel: "quote", distanceOptions: [10, 25, 50] }
  },
  childcare: {
    icon: "🧸",
    labelKey: "category.life.childcare",
    keywords: ["babysit", "babysitter", "nanny", "childcare", "kids"],
    legacyAliases: ["Childcare", "babysitter"],
    opportunityCategories: ["Childcare"],
    hireCategoryValues: ["babysitter"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.childcare.titlePlaceholder", aiPromptKey: "categoryConfig.childcare.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10] }
  },
  elderCare: {
    icon: "🧓",
    labelKey: "category.life.elderCare",
    keywords: ["elder", "elderly", "senior care", "companion", "caregiver"],
    legacyAliases: [],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Healthcare",
    posting: { titlePlaceholderKey: "categoryConfig.elderCare.titlePlaceholder", aiPromptKey: "categoryConfig.elderCare.aiPrompt", requiredFields: ["title", "description", "price"], pricingModel: "hourly", distanceOptions: [1, 5, 10] }
  },
  events: {
    icon: "🎉",
    labelKey: "category.life.events",
    keywords: ["event", "party", "wedding", "festival", "organiser"],
    legacyAliases: [],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "community-requests",
    listingDbCategory: "offers",
    cityEntityCategory: "Attractions",
    posting: { titlePlaceholderKey: "categoryConfig.events.titlePlaceholder", aiPromptKey: "categoryConfig.events.aiPrompt", requiredFields: ["title", "description"], pricingModel: "quote", distanceOptions: [10, 25, 50] }
  },
  legal: {
    icon: "⚖️",
    labelKey: "category.life.legal",
    keywords: ["lawyer", "legal", "contract", "notary"],
    legacyAliases: ["lawyer"],
    opportunityCategories: [],
    hireCategoryValues: ["lawyer"],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.legal.titlePlaceholder", aiPromptKey: "categoryConfig.legal.aiPrompt", requiredFields: ["title", "description"], pricingModel: "quote", distanceOptions: [10, 25, 50] }
  },
  medical: {
    icon: "🩺",
    labelKey: "category.life.medical",
    keywords: ["pharmacy", "doctor", "clinic", "medical", "health"],
    legacyAliases: ["Pharmacy", "Healthcare"],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "services",
    listingDbCategory: "local_services",
    cityEntityCategory: "Healthcare",
    posting: { titlePlaceholderKey: "categoryConfig.medical.titlePlaceholder", aiPromptKey: "categoryConfig.medical.aiPrompt", requiredFields: ["title", "description"], pricingModel: "quote", distanceOptions: [1, 5, 10] }
  },
  other: {
    icon: "🗂️",
    labelKey: "category.life.other",
    keywords: [],
    legacyAliases: [],
    opportunityCategories: [],
    hireCategoryValues: [],
    marketplaceCategoryId: "community-requests",
    listingDbCategory: "offers",
    cityEntityCategory: null,
    posting: { titlePlaceholderKey: "categoryConfig.other.titlePlaceholder", aiPromptKey: "categoryConfig.other.aiPrompt", requiredFields: ["title", "description"], pricingModel: "quote", distanceOptions: [5, 10, 25] }
  }
});

/** Stable, explicit render order for category grids — copies the array so
 * callers can't mutate the shared source. */
export function orderedCategoryIds() {
  return CATEGORY_ORDER.slice();
}

export function categoryConfigFor(id) {
  return CATEGORY_CONFIG[id] || CATEGORY_CONFIG.other;
}

/** Deterministic keyword classifier — checks every category's `keywords`
 * first (highest-confidence, hand-picked free-text phrases), then every
 * category's `legacyAliases` (lower-confidence, historical category
 * strings), in CATEGORY_ORDER, first match wins. Returns a categoryId or
 * null (never "other" here — "other" is only a normalizeOpportunityCategory
 * fallback, not something classifyTextToCategory should claim to have
 * actually matched). */
export function classifyTextToCategory(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return null;
  for (const id of CATEGORY_ORDER) {
    if (id === "other") continue;
    const config = CATEGORY_CONFIG[id];
    if (config.keywords.some((keyword) => normalized.includes(keyword))) return id;
  }
  for (const id of CATEGORY_ORDER) {
    if (id === "other") continue;
    const config = CATEGORY_CONFIG[id];
    if (config.legacyAliases.some((alias) => normalized.includes(alias.toLowerCase()))) return id;
  }
  return null;
}

/** Pure, non-mutating compatibility normaliser. Precedence: (1) an already
 *-valid persisted categoryId wins outright, (2) legacy free-text category
 * strings (help_requests.category, LIVE_OPPORTUNITIES.category, a fixture's
 * title) are classified via classifyTextToCategory, (3) "other" is the
 * final fallback. Never reads/writes anything on the input object besides
 * plain property reads — the record passed in is untouched. */
export function normalizeOpportunityCategory(record) {
  if (!record || typeof record !== "object") return "other";
  const explicit = record.categoryId || record.category_id;
  if (explicit && CATEGORY_CONFIG[explicit]) return explicit;
  const legacyText = record.category || record.title || "";
  return classifyTextToCategory(legacyText) || "other";
}
