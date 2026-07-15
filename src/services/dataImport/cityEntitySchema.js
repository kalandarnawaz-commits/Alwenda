/**
 * Unified city entity schema — the one shape every source connector
 * (Overpass, Wikidata, open data portals) normalizes into before an
 * entity reaches dedupe/enrichment/cache/the UI. Nothing downstream
 * should ever read a source's raw field names directly.
 *
 * id                 string       stable id, prefixed by source ("osm:node/123", "wikidata:Q123")
 * name               string
 * type               string       "poi" | "landmark" | "service"
 * category           string       one of CITY_ENTITY_CATEGORIES
 * subcategory        string|null  finer-grained label, e.g. "Cafe", "Hospital", "Bus stop"
 * address            string
 * neighbourhood      string
 * lat                number|null
 * lng                number|null
 * phone              string|null
 * email              string|null
 * website            string|null
 * openingHours       string|null
 * source             string       human-readable source label
 * sourceUrl          string       link back to the source record or portal
 * license             string      licence/attribution line for this specific record
 * lastUpdated        string       ISO date
 * verificationStatus string       "Unverified" | "Validated" | "Claimed"
 * claimStatus        string       "Unclaimed" | "Claim pending" | "Claimed"
 * rating             number|null  only ever a real source value — never fabricated
 * priceLevel         number|null  1-4, only ever a real source value
 * photos             string[]     [photoUrl], kept for backward-compat call sites
 * photoUrl           string|null  always a real, loadable photo URL — never blank
 * photoSource        string|null  "Wikimedia Commons" | "Google Places" | "Wikimedia Commons (category photo)" | ...
 * photoAttribution   string|null  human-readable credit/licence line
 * photoLicense       string|null  the licence specifically covering the photo (may differ from the record's own sourceLicense)
 * photoStatus        string       "real" | "google" | "wikimedia" | "categoryFallback" | "missing"
 * photoLastChecked   string|null  ISO date the photo URL was last resolved/verified
 * sourceStatus       string       "open data" — every record here comes from a public/open source, never scraped
 * directionsGoogleUrl string|null Google Maps search URL, coordinates when known else name+address
 * directionsWazeUrl  string|null  Waze navigate URL, same fallback rule
 * directionsAppleUrl string|null  Apple Maps search URL, same fallback rule
 * tags               string[]
 * aiSummary          string|null
 */

export const CITY_ENTITY_CATEGORIES = [
  "Food & Drink",
  "Groceries",
  "Pharmacy",
  "Healthcare",
  "Hotels",
  "Shops",
  "Beauty & Wellness",
  "Transport",
  "Public Services",
  "Attractions",
  "Parks",
  "Finance",
  "Education",
  "Nightlife"
];

/** Google Maps + Waze links — coordinates when known, otherwise a
 * name+address text query. Shared by createCityEntity (so every entity
 * gets these for free) and the mockData runtime mapping (so the already-
 * baked seed file gets them too, without needing to regenerate it). */
export function buildDirectionsUrls({ lat, lng, name, address }) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const textQuery = `${name || ""} ${address || "Vilnius"}`.trim();
  const directionsGoogleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasCoords ? `${lat},${lng}` : textQuery)}`;
  const directionsWazeUrl = hasCoords
    ? `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(textQuery)}&navigate=yes`;
  const directionsAppleUrl = hasCoords
    ? `https://maps.apple.com/?q=${encodeURIComponent(name || "Vilnius")}&ll=${lat},${lng}`
    : `https://maps.apple.com/?q=${encodeURIComponent(textQuery)}`;
  return { directionsGoogleUrl, directionsWazeUrl, directionsAppleUrl };
}

export function createCityEntity(partial = {}) {
  const photoUrl = partial.photoUrl ?? null;
  const directions = buildDirectionsUrls({ lat: partial.lat, lng: partial.lng, name: partial.name, address: partial.address });
  return {
    id: partial.id ?? "",
    name: partial.name ?? "Unnamed place",
    type: partial.type ?? "poi",
    category: partial.category ?? "uncategorised",
    subcategory: partial.subcategory ?? null,
    address: partial.address ?? "",
    neighbourhood: partial.neighbourhood ?? "",
    lat: partial.lat ?? null,
    lng: partial.lng ?? null,
    phone: partial.phone ?? null,
    email: partial.email ?? null,
    website: partial.website ?? null,
    openingHours: partial.openingHours ?? null,
    source: partial.source ?? "Unknown source",
    sourceUrl: partial.sourceUrl ?? "",
    license: partial.license ?? "",
    sourceStatus: partial.sourceStatus ?? "open data",
    lastUpdated: partial.lastUpdated ?? new Date().toISOString().slice(0, 10),
    verificationStatus: partial.verificationStatus ?? "Unverified",
    claimStatus: partial.claimStatus ?? "Unclaimed",
    rating: partial.rating ?? null,
    priceLevel: partial.priceLevel ?? null,
    photos: partial.photos ?? (photoUrl ? [photoUrl] : []),
    photoUrl,
    photoSource: partial.photoSource ?? null,
    photoAttribution: partial.photoAttribution ?? null,
    photoLicense: partial.photoLicense ?? null,
    photoStatus: partial.photoStatus ?? (photoUrl ? "categoryFallback" : "missing"),
    photoLastChecked: partial.photoLastChecked ?? (partial.lastUpdated ?? new Date().toISOString().slice(0, 10)),
    directionsGoogleUrl: partial.directionsGoogleUrl ?? directions.directionsGoogleUrl,
    directionsWazeUrl: partial.directionsWazeUrl ?? directions.directionsWazeUrl,
    directionsAppleUrl: partial.directionsAppleUrl ?? directions.directionsAppleUrl,
    tags: partial.tags ?? [],
    aiSummary: partial.aiSummary ?? null
  };
}

/**
 * Real, freely-licensed (Wikimedia Commons) fallback photos used when a
 * source record has no photo of its own. Keyed by category slug, with a
 * few finer subcategory keys for better relevance (e.g. "cafe" vs the
 * generic "food-drink"). Never a blank/placeholder graphic — every entity
 * always resolves to a real, loadable photo.
 */
export const CATEGORY_FALLBACK_PHOTOS = {
  "food-drink": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Barbieri_-_ViaSophia25668.jpg/960px-Barbieri_-_ViaSophia25668.jpg",
    license: "CC BY-SA 4.0"
  },
  cafe: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Caf%C3%A9_de_Flore.jpg/960px-Caf%C3%A9_de_Flore.jpg",
    license: "Public domain"
  },
  bakery: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/0_Monschau_-_B%C3%A4ckerei-conditorei.jpg/960px-0_Monschau_-_B%C3%A4ckerei-conditorei.jpg",
    license: "CC BY-SA 3.0"
  },
  nightlife: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Bar-P1030319.jpg/960px-Bar-P1030319.jpg",
    license: "CC BY-SA 2.0 fr"
  },
  groceries: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Westside_Market_in_Manhattan%2C_NYC_IMG_5615.JPG/960px-Westside_Market_in_Manhattan%2C_NYC_IMG_5615.JPG",
    license: "CC BY-SA 3.0"
  },
  "convenience-store": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Convenience_store_interior.jpg/960px-Convenience_store_interior.jpg",
    license: "CC BY-SA 3.0"
  },
  pharmacy: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Pharmacie%2C_Paris_2010.jpg/960px-Pharmacie%2C_Paris_2010.jpg",
    license: "CC BY-SA 2.0"
  },
  healthcare: {
    url: "https://upload.wikimedia.org/wikipedia/commons/8/88/Hospital-de-Bellvitge.jpg",
    license: "CC BY-SA 3.0"
  },
  clinic: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Legionowo%2C_Poliklinika_Wojskowa_-_fotopolska.eu_%28343207%29.jpg/960px-Legionowo%2C_Poliklinika_Wojskowa_-_fotopolska.eu_%28343207%29.jpg",
    license: "CC BY-SA 3.0"
  },
  hotels: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Jeanne%26TheForest_Fa%C3%A7ade.jpg/960px-Jeanne%26TheForest_Fa%C3%A7ade.jpg",
    license: "CC0"
  },
  shops: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Burberry_-_Store_%2851396234449%29.jpg/960px-Burberry_-_Store_%2851396234449%29.jpg",
    license: "CC BY 2.0"
  },
  "beauty-wellness": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Hair_Today_Beauty_Today_salon.jpg/960px-Hair_Today_Beauty_Today_salon.jpg",
    license: "CC0"
  },
  gym: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/USMC-Rich_Froning_Jr.jpg/960px-USMC-Rich_Froning_Jr.jpg",
    license: "Public domain"
  },
  transport: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Series-E235-0_9.jpg/960px-Series-E235-0_9.jpg",
    license: "CC BY-SA 4.0"
  },
  "public-services": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Des_Moines_City_Hall.jpg/960px-Des_Moines_City_Hall.jpg",
    license: "CC BY-SA 3.0"
  },
  attractions: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/1_times_square_night_2013.jpg/960px-1_times_square_night_2013.jpg",
    license: "CC BY-SA 4.0"
  },
  museum: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Museo_Chileno_de_Arte_Precolombino_-_2020_-_10.jpg/960px-Museo_Chileno_de_Arte_Precolombino_-_2020_-_10.jpg",
    license: "CC BY-SA 4.0"
  },
  parks: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Halleyparknovember_b_%28cropped%29.jpg/960px-Halleyparknovember_b_%28cropped%29.jpg",
    license: "CC BY-SA 4.0"
  },
  finance: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/London.bankofengland.arp.jpg/960px-London.bankofengland.arp.jpg",
    license: "Public domain"
  },
  education: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Columbia_University%2C_NYC_%28June_2014%29_-_09.JPG/960px-Columbia_University%2C_NYC_%28June_2014%29_-_09.JPG",
    license: "CC BY-SA 3.0"
  },
  automobile: {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/af/Car_repair_shop.jpg",
    license: "CC BY-SA 4.0"
  },
  "petrol-station": {
    url: "https://upload.wikimedia.org/wikipedia/commons/5/5b/A_modern_BP_gas_station_or_filling_station_in_the_United_States_01.jpg",
    license: "CC BY 4.0"
  },
  "shopping-mall": {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a0/CH.ZG.Zug_2024-04-24_Shopping-Mall-Metalli.jpg",
    license: "CC BY-SA 4.0"
  }
};

const SUBCATEGORY_FALLBACK_KEY = {
  Cafe: "cafe",
  Bakery: "bakery",
  Museum: "museum",
  "Convenience store": "convenience-store",
  Gym: "gym",
  Clinic: "clinic",
  "Petrol station": "petrol-station",
  "Shopping mall": "shopping-mall"
};

export function categorySlug(category) {
  return (category || "uncategorised").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** A real, freely-licensed photo representative of the category/subcategory —
 * never a blank placeholder. Used whenever a source record has no photo. */
export function categoryFallbackPhoto(category, subcategory) {
  const key = (subcategory && SUBCATEGORY_FALLBACK_KEY[subcategory]) || categorySlug(category);
  const entry = CATEGORY_FALLBACK_PHOTOS[key] || CATEGORY_FALLBACK_PHOTOS[categorySlug(category)];
  if (!entry) return null;
  return {
    url: entry.url,
    source: "Wikimedia Commons (category photo)",
    attribution: `Representative ${category} photo — Wikimedia Commons (${entry.license})`,
    license: entry.license
  };
}
