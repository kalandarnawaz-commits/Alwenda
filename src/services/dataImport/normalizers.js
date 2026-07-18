import { createCityEntity, categoryFallbackPhoto } from "./cityEntitySchema.js";

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Resolves the photo fields for an entity: a real source photo always
 * wins; otherwise a real (never blank) category-representative photo. */
function resolvePhoto({ category, subcategory, realUrl, realSource, realAttribution, realLicense = null }) {
  if (realUrl) {
    return {
      photoUrl: realUrl,
      photoSource: realSource,
      photoAttribution: realAttribution,
      photoLicense: realLicense ?? "See source for licence",
      photoStatus: "real",
      photoLastChecked: TODAY()
    };
  }
  const fallback = categoryFallbackPhoto(category, subcategory);
  if (fallback) {
    return {
      photoUrl: fallback.url,
      photoSource: fallback.source,
      photoAttribution: fallback.attribution,
      photoLicense: fallback.license,
      photoStatus: "categoryFallback",
      photoLastChecked: TODAY()
    };
  }
  return { photoUrl: null, photoSource: null, photoAttribution: null, photoLicense: null, photoStatus: "missing", photoLastChecked: null };
}

/**
 * Maps a raw OpenStreetMap tag value (amenity/shop/tourism/leisure/
 * historic/highway/railway) to Alwenda's category taxonomy + a
 * human-readable subcategory label. Keep this in sync with the mapping
 * used to generate src/data/seedCityData.js so live imports and the
 * baked-in seed always land in the same categories.
 */
const OSM_TAG_TO_CATEGORY = {
  restaurant: ["Food & Drink", "Restaurant"],
  cafe: ["Food & Drink", "Cafe"],
  fast_food: ["Food & Drink", "Fast food"],
  bakery: ["Food & Drink", "Bakery"],
  bar: ["Nightlife", "Bar"],
  pub: ["Nightlife", "Pub"],
  nightclub: ["Nightlife", "Nightclub"],
  supermarket: ["Groceries", "Supermarket"],
  convenience: ["Groceries", "Convenience store"],
  pharmacy: ["Pharmacy", "Pharmacy"],
  hospital: ["Healthcare", "Hospital"],
  clinic: ["Healthcare", "Clinic"],
  doctors: ["Healthcare", "Doctor's office"],
  dentist: ["Healthcare", "Dentist"],
  hotel: ["Hotels", "Hotel"],
  guest_house: ["Hotels", "Guesthouse"],
  hostel: ["Hotels", "Hostel"],
  clothes: ["Shops", "Clothing store"],
  gift: ["Shops", "Gift shop"],
  books: ["Shops", "Bookshop"],
  shoes: ["Shops", "Shoe store"],
  department_store: ["Shops", "Department store"],
  mall: ["Shops", "Shopping mall"],
  car: ["Automobile", "Car dealer"],
  car_repair: ["Automobile", "Car repair"],
  car_wash: ["Automobile", "Car wash"],
  tyres: ["Automobile", "Tyres"],
  fuel: ["Automobile", "Petrol station"],
  hairdresser: ["Beauty & Wellness", "Hair salon"],
  beauty: ["Beauty & Wellness", "Beauty salon"],
  fitness_centre: ["Beauty & Wellness", "Gym"],
  bus_stop: ["Transport", "Bus stop"],
  tram_stop: ["Transport", "Tram stop"],
  subway_entrance: ["Transport", "Metro entrance"],
  parking: ["Transport", "Parking"],
  townhall: ["Public Services", "Town hall"],
  post_office: ["Public Services", "Post office"],
  library: ["Public Services", "Library"],
  attraction: ["Attractions", "Attraction"],
  museum: ["Attractions", "Museum"],
  monument: ["Attractions", "Monument"],
  memorial: ["Attractions", "Memorial"],
  park: ["Parks", "Park"],
  bank: ["Finance", "Bank"],
  atm: ["Finance", "ATM"],
  school: ["Education", "School"],
  university: ["Education", "University"],
  college: ["Education", "College"],
  veterinary: ["Pet Services", "Veterinary clinic"],
  animal_boarding: ["Pet Services", "Pet boarding"],
  pet: ["Pet Services", "Pet shop"],
  pet_grooming: ["Pet Services", "Pet grooming"],
  plumber: ["Home Services", "Plumber"],
  electrician: ["Home Services", "Electrician"],
  carpenter: ["Home Services", "Carpenter"],
  painter: ["Home Services", "Painter"],
  locksmith: ["Home Services", "Locksmith"],
  gardener: ["Home Services", "Gardener"]
};

/** Reads amenity/shop/tourism/leisure/historic/highway/railway off raw OSM tags. */
export function categorizeOsmTags(tags = {}) {
  for (const key of ["amenity", "shop", "tourism", "leisure", "historic", "highway", "railway", "craft"]) {
    const value = tags[key];
    if (value && OSM_TAG_TO_CATEGORY[value]) return OSM_TAG_TO_CATEGORY[value];
  }
  return ["uncategorised", null];
}

/** OpenStreetMap/Overpass elements look like { id, tags: {...}, lat, lon } for nodes. */
export function normalizeOverpassElement(element, categoryHint) {
  const tags = element.tags || {};
  const addressParts = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean);
  const [mappedCategory, subcategory] = categorizeOsmTags(tags);
  const category = mappedCategory === "uncategorised" && categoryHint ? categoryHint : mappedCategory;
  const photo = resolvePhoto({
    category,
    subcategory,
    realUrl: tags.image || null,
    realSource: tags.image ? "OpenStreetMap contributor photo" : null,
    realAttribution: tags.image ? "Photo submitted with the OpenStreetMap record" : null
  });
  return createCityEntity({
    id: `osm:${element.type}/${element.id}`,
    name: tags.name || "Unnamed place",
    type: "poi",
    category,
    subcategory,
    address: addressParts.join(" ") || tags["addr:full"] || "",
    neighbourhood: tags["addr:suburb"] || tags["addr:district"] || "",
    lat: element.lat ?? element.center?.lat ?? null,
    lng: element.lon ?? element.center?.lon ?? null,
    phone: tags.phone || tags["contact:phone"] || null,
    email: tags.email || tags["contact:email"] || null,
    website: tags.website || tags["contact:website"] || null,
    openingHours: tags.opening_hours || null,
    source: "OpenStreetMap / Overpass API",
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    license: "ODbL – © OpenStreetMap contributors",
    rating: tags.stars && !Number.isNaN(Number(tags.stars)) ? Number(tags.stars) : null,
    ...photo,
    tags: Object.entries(tags)
      .filter(([key]) => ["cuisine", "amenity", "shop", "diet:vegetarian"].includes(key))
      .map(([, value]) => value)
  });
}

/** Wikidata SPARQL rows come back as { item: {value}, itemLabel: {value}, coord: {value}, ... }. */
export function normalizeWikidataRow(row) {
  const coordMatch = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord?.value || "");
  const qid = row.item?.value?.split("/").pop();
  const rawImage = row.image?.value || null;
  const realUrl = rawImage
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${rawImage.split("Special:FilePath/").pop()}?width=900`
    : null;
  const photo = resolvePhoto({
    category: "Attractions",
    subcategory: "Landmark",
    realUrl,
    realSource: realUrl ? "Wikimedia Commons" : null,
    realAttribution: realUrl ? "Photo via Wikidata / Wikimedia Commons" : null,
    realLicense: realUrl ? "Wikimedia Commons — see file page for exact licence" : null
  });
  return createCityEntity({
    id: `wikidata:${qid}`,
    name: row.itemLabel?.value || "Unnamed landmark",
    type: "landmark",
    category: "Attractions",
    subcategory: "Landmark",
    address: row.address?.value || "",
    neighbourhood: "",
    lat: coordMatch ? Number(coordMatch[2]) : null,
    lng: coordMatch ? Number(coordMatch[1]) : null,
    website: row.website?.value || null,
    source: "Wikidata",
    sourceUrl: row.item?.value || "",
    license: "CC0 – Wikidata",
    verificationStatus: "Validated",
    ...photo,
    aiSummary: row.itemDescription?.value || null
  });
}

/** Generic CKAN-style open-data record (Vilnius Open Data / data.gov.lt / geoportal.lt). */
export function normalizeOpenDataRecord(record, meta) {
  const category = meta.category || "Public Services";
  const photo = resolvePhoto({ category, subcategory: meta.subcategory || null, realUrl: record.image || record.photo || null, realSource: "portal record", realAttribution: meta.sourceLabel });
  return createCityEntity({
    id: `${meta.portalId}:${record.id ?? record._id ?? record.name}`,
    name: record.name || record.title || "Unnamed record",
    type: "service",
    category,
    subcategory: meta.subcategory || null,
    address: record.address || "",
    neighbourhood: record.neighbourhood || record.district || "",
    lat: record.lat ?? record.latitude ?? null,
    lng: record.lng ?? record.longitude ?? null,
    phone: record.phone || null,
    email: record.email || null,
    website: record.website || record.url || null,
    openingHours: record.opening_hours || null,
    source: meta.sourceLabel,
    sourceUrl: meta.datasetUrl,
    license: meta.license || `${meta.sourceLabel} — see dataset licence`,
    verificationStatus: "Unverified",
    ...photo,
    tags: record.tags || []
  });
}
