import { db } from "@/db/drizzle";
import { storyViews } from "@/db/schema";
import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const server = {
  analytics: defineAction({
    input: z.object({
      storyId: z.string().min(1),
      utmSource: z.string().trim().min(1).max(128).optional()
    }),
    handler: async ({ storyId, utmSource }, context) => {
      const ipAddress = context.clientAddress;
      const source = utmSource ?? "direct";
      const viewDate = new Date().toISOString().slice(0, 10);

      await db
        .insert(storyViews)
        .values({
          story_id: storyId,
          ip_address: ipAddress,
          utm_source: source,
          view_date: viewDate
        })
        .onConflictDoNothing()
        .catch((error) => {
          console.error("Error tracking story view:", error);
          throw new Error("Failed to track story view");
        });

      return { ok: true };
    }
  })
};
