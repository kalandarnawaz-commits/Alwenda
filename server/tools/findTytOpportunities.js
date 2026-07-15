import { tool } from "@openai/agents";
import { z } from "zod";

/** Same honesty rule as findNearbyPlaces: empty results until this is
 * wired to a real `tyt_opportunities` table, never invented ones. */
export const findTytOpportunities = tool({
  name: "find_tyt_opportunities",
  description: "Find nearby paid tasks and Trade-Your-Time opportunities matching the user.",
  parameters: z.object({
    skills: z.array(z.string()).nullable(),
    availableMinutes: z.number().nullable()
  }),
  execute: async ({ skills, availableMinutes }) => {
    return JSON.stringify({
      skills,
      availableMinutes,
      opportunities: []
    });
  }
});
