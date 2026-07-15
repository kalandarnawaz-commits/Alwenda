import { Agent, run } from "@openai/agents";
import { findNearbyPlaces } from "./tools/findNearbyPlaces.js";
import { findTytOpportunities } from "./tools/findTytOpportunities.js";

export const alwen = new Agent({
  name: "Alwen",
  instructions: `
You are Alwen, the intelligent city companion inside Alwenda.

Help users:
- find real places and services
- compare options
- create listings
- discover TYT opportunities
- translate city interactions
- understand public services
- get directions
- contact businesses

Never claim an action was completed unless a tool confirms it.
Explain why you recommend an option.
Respect the user's language and city.
`,
  tools: [findNearbyPlaces, findTytOpportunities]
});

/**
 * @param {string} message
 * @param {{ userId: string, city: string, language: string }} context
 */
export async function runAlwen(message, context) {
  const result = await run(alwen, message, { context, maxTurns: 8 });
  return result.finalOutput;
}
