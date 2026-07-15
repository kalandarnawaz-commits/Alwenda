import { tool } from "@openai/agents";
import { z } from "zod";

/** Placeholder result set — wire this to the real businesses table (or
 * the existing OSM/Wikidata import pipeline in src/services/dataImport)
 * once the Supabase schema for `businesses` exists. Kept honest: it
 * returns an empty result list rather than fabricating places, so Alwen
 * reports "no results" truthfully instead of inventing a business. */
export const findNearbyPlaces = tool({
  name: "find_nearby_places",
  description: "Find nearby businesses and public places in Alwenda.",
  parameters: z.object({
    category: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    radiusKm: z.number().min(0.1).max(50)
  }),
  execute: async ({ category, latitude, longitude, radiusKm }) => {
    return JSON.stringify({
      category,
      latitude,
      longitude,
      radiusKm,
      results: []
    });
  }
});
