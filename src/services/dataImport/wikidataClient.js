import { normalizeWikidataRow } from "./normalizers.js";

/**
 * Wikidata SPARQL client for landmarks and public places. The query
 * service is public and CORS-enabled. Falls back to a bundled sample on
 * failure, same pattern as overpassClient. Attribution: data from
 * Wikidata, released under CC0 (no rights reserved), but we still credit
 * the source per Wikimedia's reuse guidance.
 */

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
export const WIKIDATA_ATTRIBUTION = "Data from Wikidata (CC0)";
const DEFAULT_CITY_CENTER = { lat: 54.6872, lng: 25.2797 }; // Vilnius, Cathedral Square

/**
 * Uses the `wikibase:around` geo service rather than a strict P131
 * (administrative-entity) match — many real landmarks are tagged to a
 * district/neighbourhood entity rather than the city directly, so a
 * radius search finds substantially more real matches. Also pulls P18
 * (image) so real landmark photos can be used instead of a category
 * fallback whenever Wikidata has one.
 */
export function buildLandmarksSparql({ lat = DEFAULT_CITY_CENTER.lat, lng = DEFAULT_CITY_CENTER.lng, radiusKm = 3, limit = 60 } = {}) {
  return `
    SELECT ?item ?itemLabel ?itemDescription ?coord ?website ?image ?dist WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?coord.
        bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral.
        bd:serviceParam wikibase:radius "${radiusKm}".
        bd:serviceParam wikibase:distance ?dist.
      }
      ?item wdt:P31/wdt:P279* ?class.
      VALUES ?class { wd:Q570116 wd:Q33506 wd:Q23413 wd:Q16560 wd:Q22698 }
      OPTIONAL { ?item wdt:P856 ?website. }
      OPTIONAL { ?item wdt:P18 ?image. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,lt". }
    } ORDER BY ?dist LIMIT ${limit}
  `.trim();
}

async function requestWikidata(sparql, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
  const response = await fetch(url, { headers: { Accept: "application/sparql-results+json" }, signal });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  return response.json();
}

export async function fetchWikidataLandmarks(options = {}) {
  const sparql = buildLandmarksSparql(options);
  try {
    const data = await requestWikidata(sparql, options);
    const rows = data.results?.bindings || [];
    if (rows.length === 0) {
      // A successful query with zero matches isn't a fetch failure, but an
      // empty preview is a bad result either way — fall back to the sample
      // so the UI always has something real-shaped to show.
      return {
        ok: true,
        fromCache: true,
        attribution: `${WIKIDATA_ATTRIBUTION} — live query returned no matches, showing bundled sample`,
        entities: getSampleWikidataEntities()
      };
    }
    return {
      ok: true,
      fromCache: false,
      attribution: WIKIDATA_ATTRIBUTION,
      entities: rows.map(normalizeWikidataRow)
    };
  } catch (error) {
    return {
      ok: false,
      fromCache: true,
      attribution: WIKIDATA_ATTRIBUTION,
      error: error.message,
      entities: getSampleWikidataEntities()
    };
  }
}

export const queryLandmarksVilnius = (options = {}) => fetchWikidataLandmarks(options);

/** Bundled sample shaped like real SPARQL JSON results, for offline/demo use. */
function getSampleWikidataEntities() {
  const rows = [
    { item: { value: "http://www.wikidata.org/entity/Q691787" }, itemLabel: { value: "Gediminas' Tower" }, itemDescription: { value: "Historic tower in Vilnius, symbol of the city" }, coord: { value: "Point(25.29075 54.68611)" } },
    { item: { value: "http://www.wikidata.org/entity/Q1345333" }, itemLabel: { value: "Vilnius Cathedral" }, itemDescription: { value: "Roman Catholic cathedral in Vilnius Old Town" }, coord: { value: "Point(25.28778 54.68417)" } },
    { item: { value: "http://www.wikidata.org/entity/Q2444715" }, itemLabel: { value: "Uzupis" }, itemDescription: { value: "Self-declared artists' republic neighbourhood" }, coord: { value: "Point(25.29444 54.67917)" } }
  ];
  return rows.map(normalizeWikidataRow);
}
