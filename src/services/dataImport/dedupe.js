/**
 * Duplicate detection for imported city entities. Matches on normalized
 * name similarity AND geographic proximity — either alone gives too many
 * false positives (two "City Pharmacy" branches, or two unrelated places
 * that happen to share a building).
 */

const EARTH_RADIUS_M = 6371000;

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((value) => value == null)) return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeNameForMatch(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Cheap similarity: fraction of shared words between two normalized names. */
function nameSimilarity(a, b) {
  const wordsA = new Set(normalizeNameForMatch(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeNameForMatch(b).split(" ").filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;
  const shared = [...wordsA].filter((word) => wordsB.has(word)).length;
  return shared / Math.max(wordsA.size, wordsB.size);
}

/**
 * For each candidate entity, finds the closest existing-entity match (if
 * any) within the given radius/similarity thresholds, and tags it.
 * Returns candidates annotated with `isDuplicate` and `duplicateOf`
 * (the existing entity's id) rather than silently dropping anything —
 * the import preview UI decides what to do with duplicates.
 */
export function annotateDuplicates(candidates, existingEntities, { radiusMeters = 60, similarityThreshold = 0.5 } = {}) {
  return candidates.map((candidate) => {
    const match = existingEntities.find((existing) => {
      const closeEnough = haversineDistanceMeters(candidate.lat, candidate.lng, existing.lat, existing.lng) <= radiusMeters;
      const similarEnough = nameSimilarity(candidate.name, existing.name) >= similarityThreshold;
      return closeEnough && similarEnough;
    });
    return {
      ...candidate,
      isDuplicate: Boolean(match),
      duplicateOf: match ? match.id : null
    };
  });
}
