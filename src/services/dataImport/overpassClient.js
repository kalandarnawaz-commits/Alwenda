import { normalizeOverpassElement } from "./normalizers.js";

/**
 * Overpass API client for OpenStreetMap POIs.
 *
 * Overpass is public and CORS-enabled, so this builds and sends real
 * queries. If the network call fails (offline demo, sandboxed preview,
 * rate limit), it falls back to a bundled sample response so the import
 * UI always has something real-shaped to show. Attribution is mandatory:
 * "© OpenStreetMap contributors", ODbL license.
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const OVERPASS_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
const DEFAULT_CITY_CENTER = { lat: 54.6872, lng: 25.2797 }; // Vilnius, Cathedral Square

/** Alwenda category -> one or more Overpass QL tag filter clauses (OSM spreads
 * related concepts across different top-level tags: amenity vs shop vs leisure). */
export const OVERPASS_CATEGORY_FILTERS = {
  "Food & Drink": ['["amenity"~"^(restaurant|cafe|fast_food)$"]'],
  Nightlife: ['["amenity"~"^(bar|pub|nightclub)$"]'],
  Groceries: ['["shop"~"^(supermarket|convenience)$"]'],
  Pharmacy: ['["amenity"="pharmacy"]'],
  Healthcare: ['["amenity"~"^(hospital|clinic|doctors|dentist)$"]'],
  Hotels: ['["tourism"~"^(hotel|guest_house|hostel)$"]'],
  Shops: ['["shop"~"^(clothes|gift|books|shoes|department_store|mall)$"]'],
  Automobile: ['["shop"~"^(car|car_repair|car_wash|tyres)$"]', '["amenity"="fuel"]'],
  "Beauty & Wellness": ['["shop"~"^(hairdresser|beauty)$"]', '["leisure"="fitness_centre"]'],
  Transport: ['["highway"="bus_stop"]', '["railway"="tram_stop"]', '["amenity"="parking"]'],
  "Public Services": ['["amenity"~"^(townhall|post_office|library)$"]'],
  Attractions: ['["tourism"~"^(attraction|museum)$"]', '["historic"~"^(monument|memorial)$"]'],
  Parks: ['["leisure"="park"]'],
  Finance: ['["amenity"~"^(bank|atm)$"]'],
  Education: ['["amenity"~"^(school|university|college)$"]'],
  "Pet Services": ['["amenity"~"^(veterinary|animal_boarding)$"]', '["shop"~"^(pet|pet_grooming)$"]'],
  "Home Services": ['["craft"~"^(plumber|electrician|carpenter|painter|locksmith|gardener)$"]']
};

export const IMPORT_CATEGORIES = Object.keys(OVERPASS_CATEGORY_FILTERS);

/** Builds a query as a union of `nwr<filter>(around:radius,lat,lng);` clauses. */
export function buildOverpassQuery({ category, lat = DEFAULT_CITY_CENTER.lat, lng = DEFAULT_CITY_CENTER.lng, radiusMeters = 2000, limit = 30, timeoutSeconds = 25 }) {
  const filters = OVERPASS_CATEGORY_FILTERS[category];
  if (!filters) throw new Error(`Unknown import category: ${category}`);
  const clauses = filters.map((filter) => `  nwr${filter}(around:${radiusMeters},${lat},${lng});`).join("\n");
  return `
    [out:json][timeout:${timeoutSeconds}];
    (
${clauses}
    );
    out center tags ${limit};
  `.trim();
}

async function requestOverpass(query, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json, text/plain, */*" },
    signal
  });
  if (!response.ok) throw new Error(`Overpass request failed: ${response.status}`);
  return response.json();
}

/**
 * Fetches POIs for a category, normalizing to the unified city entity
 * schema. Falls back to a sample dataset on any failure so the import
 * preview UI degrades gracefully instead of showing an empty state.
 */
export async function fetchOverpassCategory(category, options = {}) {
  const query = buildOverpassQuery({ category, ...options });
  try {
    const data = await requestOverpass(query, options);
    const elements = data.elements || [];
    return {
      ok: true,
      fromCache: false,
      attribution: OVERPASS_ATTRIBUTION,
      entities: elements.map((element) => normalizeOverpassElement(element, category))
    };
  } catch (error) {
    return {
      ok: false,
      fromCache: true,
      attribution: OVERPASS_ATTRIBUTION,
      error: error.message,
      entities: getSampleOverpassEntities(category)
    };
  }
}

export const queryRestaurantsVilnius = () => fetchOverpassCategory("Food & Drink");
export const queryPharmaciesVilnius = () => fetchOverpassCategory("Pharmacy");
export const queryHotelsVilnius = () => fetchOverpassCategory("Hotels");

/** Bundled sample data shaped exactly like a real Overpass response, for offline/demo use. */
function getSampleOverpassEntities(category) {
  const samples = {
    "Food & Drink": [
      { type: "node", id: 348219001, lat: 54.6829, lon: 25.2803, tags: { name: "Sweet Root", amenity: "restaurant", cuisine: "new_nordic", "addr:street": "Užupio g.", "addr:housenumber": "22", opening_hours: "We-Sa 18:00-23:00", website: "https://sweetroot.lt" } },
      { type: "node", id: 348219002, lat: 54.6872, lon: 25.2797, tags: { name: "Vero Cafe", amenity: "cafe", "addr:street": "Pilies g.", "addr:housenumber": "8" } }
    ],
    Pharmacy: [
      { type: "node", id: 348219101, lat: 54.6870, lon: 25.2795, tags: { name: "Eurovaistinė", amenity: "pharmacy", "addr:street": "Gedimino pr.", "addr:housenumber": "12", phone: "+37052121212", opening_hours: "Mo-Su 08:00-22:00" } }
    ],
    Hotels: [
      { type: "node", id: 348219201, lat: 54.6836, lon: 25.2861, tags: { name: "Artis Centrum Hotels", tourism: "hotel", "addr:street": "Totorių g.", "addr:housenumber": "23", website: "https://artiscentrumhotels.com" } }
    ]
  };
  return (samples[category] || []).map((element) => normalizeOverpassElement(element, category));
}
