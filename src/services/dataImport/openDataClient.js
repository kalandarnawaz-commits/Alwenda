import { normalizeOpenDataRecord } from "./normalizers.js";

/**
 * Client for government/municipal open-data portals:
 *   - Vilnius Open Data portal (opendata.vilnius.lt) — CKAN
 *   - Lithuanian national open data portal (data.gov.lt)
 *   - geoportal.lt — Lithuanian spatial/geo datasets
 *
 * Unlike Overpass/Wikidata, these portals don't expose one fixed,
 * well-known query shape — each dataset has its own resource id, and the
 * exact datasets Alwenda would use need to be picked deliberately by
 * whoever owns the integration (not guessed here). This client is
 * therefore a real, working CKAN `datastore_search` implementation
 * (the standard API most of these portals run), wired up but pointed at
 * a placeholder resource id — it's structurally correct and API-ready,
 * but returns bundled sample data until a real resource id is filled in.
 *
 * Respect each portal's own licence/attribution requirements per dataset.
 */

export const PORTALS = {
  vilnius: { id: "vilnius-open-data", label: "Vilnius Open Data portal", base: "https://opendata.vilnius.lt/api/3/action" },
  ltGov: { id: "data-gov-lt", label: "Lithuanian Open Data Portal (data.gov.lt)", base: "https://data.gov.lt/api/3/action" },
  geoportal: { id: "geoportal-lt", label: "Lithuanian Geoportal (geoportal.lt)", base: "https://www.geoportal.lt/api/3/action" }
};

/**
 * Real CKAN `datastore_search` call. `resourceId` must be a specific
 * dataset's resource id from the target portal — pass one in once a real
 * dataset has been selected for this category. Until then, callers
 * should use `fetchPublicServicesPlaceholder` below.
 */
async function ckanDatastoreSearch({ base, resourceId, limit = 50 }, { signal } = /** @type {{signal?: AbortSignal}} */ ({})) {
  const url = `${base}/datastore_search?resource_id=${encodeURIComponent(resourceId)}&limit=${limit}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Open data request failed: ${response.status}`);
  const payload = await response.json();
  return payload.result?.records || [];
}

export async function fetchOpenDataDataset({ portal, resourceId, category }, options = {}) {
  const meta = PORTALS[portal];
  if (!meta) throw new Error(`Unknown open data portal: ${portal}`);
  try {
    const records = await ckanDatastoreSearch({ base: meta.base, resourceId, ...options }, options);
    return {
      ok: true,
      fromCache: false,
      attribution: `${meta.label} — see dataset licence`,
      entities: records.map((record) =>
        normalizeOpenDataRecord(record, { portalId: meta.id, sourceLabel: meta.label, category, datasetUrl: `${meta.base.replace("/api/3/action", "")}/dataset/${resourceId}` })
      )
    };
  } catch (error) {
    return {
      ok: false,
      fromCache: true,
      attribution: `${meta.label} — see dataset licence`,
      error: error.message,
      entities: getPlaceholderPublicServices(meta)
    };
  }
}

/**
 * "Public services from open data" sample, per the requested example
 * set. No specific dataset has been selected yet, so this is placeholder
 * data only — structurally identical to what a real CKAN response would
 * normalize into, so swapping in a real resourceId later is a one-line
 * change in the caller.
 */
export function fetchPublicServicesPlaceholder(portal = "vilnius") {
  const meta = PORTALS[portal];
  return {
    ok: true,
    fromCache: true,
    attribution: `${meta.label} — placeholder sample, no live dataset selected yet`,
    entities: getPlaceholderPublicServices(meta)
  };
}

function getPlaceholderPublicServices(meta) {
  const records = [
    { id: "svc-001", name: "Vilnius City Municipality — Citizen Service Centre", address: "Konstitucijos pr. 3, Vilnius", district: "Šnipiškės", latitude: 54.6935, longitude: 25.2797, phone: "+37052112111", url: "https://vilnius.lt", opening_hours: "Mon-Fri 08:00-17:00", tags: ["municipality", "public-service"] },
    { id: "svc-002", name: "Vilnius Regional Passport Office", address: "Verkių g. 3, Vilnius", district: "Verkiai", opening_hours: "Mon-Fri 08:00-16:00", tags: ["government", "documents"] }
  ];
  return records.map((record) => normalizeOpenDataRecord(record, { portalId: meta.id, sourceLabel: meta.label, category: "Public Services", datasetUrl: meta.base.replace("/api/3/action", "") }));
}
