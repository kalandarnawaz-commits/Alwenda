/**
 * Post-normalization enrichment: fills in an aiSummary when the source
 * didn't provide one, and surfaces validation warnings for the import
 * preview UI. This is rule-based, not a real model call — it's a
 * placeholder for a future LLM enrichment step, kept obviously simple so
 * nobody mistakes it for a real AI summary.
 */

const CATEGORY_BLURB = {
  restaurant: "a restaurant",
  pharmacy: "a pharmacy",
  hotel: "a place to stay",
  landmark: "a landmark",
  "public-service": "a public service",
  uncategorised: "a place"
};

export function generateAiSummary(entity) {
  const kind = CATEGORY_BLURB[entity.category] || CATEGORY_BLURB.uncategorised;
  const location = entity.neighbourhood || entity.address || "Vilnius";
  return `${entity.name} is ${kind} in ${location}, imported from ${entity.source}.`;
}

export function enrichEntity(entity) {
  return {
    ...entity,
    aiSummary: entity.aiSummary || generateAiSummary(entity)
  };
}

/**
 * Validation warnings for the import preview — missing fields a real
 * business profile would need before it's worth publishing/claiming.
 */
export function validateEntity(entity) {
  const warnings = [];
  if (!entity.name || entity.name === "Unnamed place") warnings.push("Missing name");
  if (entity.lat == null || entity.lng == null) warnings.push("Missing coordinates");
  if (!entity.address) warnings.push("Missing address");
  if (!entity.phone && !entity.website) warnings.push("No contact method (phone or website)");
  return warnings;
}

export function enrichAndValidate(entities) {
  return entities.map((entity) => {
    const enriched = enrichEntity(entity);
    return { ...enriched, validationWarnings: validateEntity(enriched) };
  });
}
