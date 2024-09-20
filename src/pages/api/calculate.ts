import { db } from "@/db/drizzle";
import { Words } from "@/db/schema";
import type { EndpointHandler } from "astro";
import { count, eq, gte, sql } from "drizzle-orm";

export const GET: EndpointHandler["GET"] = async (ctx) => {
  if (
    !import.meta.env.DEV &&
    ctx.request.headers.get("Authorization") !==
      `Bearer ${import.meta.env.SEEDER_TOKEN}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await db.update(Words).set({
    // sampled_count: sql`${Words.sampled_count} + 20`,
    success_rate: sql`CAST (${Words.success_count} as REAL) / ${Words.sampled_count}`,
    rejected_rate: sql`CAST (${Words.rejected_count} as REAL) / ${Words.sampled_count}`,
  });

  return Response.json({ rows });
};
