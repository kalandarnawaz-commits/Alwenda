/**
 * Google Places Photos connector — tier A of the photo priority chain
 * (Google Places > Wikimedia/Wikidata > website metadata > category
 * fallback). Inactive by default: the Places API requires a billed,
 * key-restricted Google Cloud project, which isn't available in this
 * environment and must never be hardcoded into source control. No key
 * means every function below is a guaranteed no-op that costs zero
 * network calls — callers check isGooglePlacesConfigured() first, so an
 * unconfigured deployment never even attempts a request. Provide a real,
 * HTTP-referrer-restricted key via configureGooglePlaces() at app start
 * to activate it for real.
 *
 * Google's ToS requires displaying the provided attribution alongside
 * any Places photo and forbids caching photo bytes beyond their normal
 * cache lifetime — this client stores the attribution text and only
 * caches the (short-lived) photo reference URL, never the image itself.
 */

let apiKey = null;

export function configureGooglePlaces(key) {
  apiKey = key || null;
}

export function isGooglePlacesConfigured() {
  return Boolean(apiKey);
}

const FIND_PLACE_ENDPOINT = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";
const PLACE_PHOTO_ENDPOINT = "https://maps.googleapis.com/maps/api/place/photo";

function stripHtml(value) {
  return (value || "").replace(/<[^>]+>/g, "").trim();
}

/**
 * Matches a business by name + a coordinate bias and returns its first
 * photo. Returns null on no-match/no-photo/not-configured/network error —
 * every caller must treat null as "fall through to the next photo tier",
 * never as a fatal error, since most of Vilnius's small businesses
 * simply won't have a Places photo.
 */
export async function fetchGooglePlacePhoto({ name, lat, lng }, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
  if (!isGooglePlacesConfigured() || lat == null || lng == null || !name) return null;
  try {
    const findUrl = `${FIND_PLACE_ENDPOINT}?input=${encodeURIComponent(name)}&inputtype=textquery&fields=photos&locationbias=circle:150@${lat},${lng}&key=${apiKey}`;
    const response = await fetch(findUrl, { signal });
    if (!response.ok) return null;
    const data = await response.json();
    const photo = data.candidates?.[0]?.photos?.[0];
    if (!photo?.photo_reference) return null;
    return {
      url: `${PLACE_PHOTO_ENDPOINT}?maxwidth=900&photo_reference=${photo.photo_reference}&key=${apiKey}`,
      source: "Google Places",
      attribution: stripHtml(photo.html_attributions?.[0]) || "Photo via Google Places",
      license: "Google Places Photos — attribution required, subject to Google Maps Platform Terms of Service"
    };
  } catch {
    return null;
  }
}

/**
 * Enriches a batch of already-normalized entities with real Google
 * Places photos, upgrading photoStatus from "categoryFallback"/"missing"
 * to "google" wherever a match is found. A pure no-op (returns the input
 * unchanged, zero requests) unless configureGooglePlaces() has been
 * called with a real key.
 */
export async function enrichWithGooglePlacePhotos(entities) {
  if (!isGooglePlacesConfigured()) return entities;
  const enriched = [];
  for (const entity of entities) {
    const photo = await fetchGooglePlacePhoto({ name: entity.name, lat: entity.lat, lng: entity.lng });
    if (!photo) {
      enriched.push(entity);
      continue;
    }
    enriched.push({
      ...entity,
      photoUrl: photo.url,
      photoSource: photo.source,
      photoAttribution: photo.attribution,
      photoLicense: photo.license,
      photoStatus: "google",
      photoLastChecked: new Date().toISOString().slice(0, 10),
      photos: [photo.url]
    });
  }
  return enriched;
}

/**
 * Tier C — a business's own website metadata image (e.g. og:image),
 * only when explicitly published as open metadata. Intentionally left
 * unimplemented: fetching arbitrary third-party HTML from browser JS
 * requires either the site to allow cross-origin reads (most don't) or
 * a server-side proxy this static app doesn't have, and blindly proxying
 * arbitrary business websites at scale is exactly the "aggressive
 * scraping" this project must not do. The function exists so the
 * priority chain is complete and honest in code, not just in comments —
 * it always defers to the next tier rather than pretending to work.
 */
export async function fetchWebsiteMetaImage() {
  return null;
}
