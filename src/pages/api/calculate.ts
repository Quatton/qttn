import { db } from "@/db/drizzle";
import { Words } from "@/db/schema";
import type { EndpointHandler } from "astro";
import { and, desc, gte, sql } from "drizzle-orm";

export const GET: EndpointHandler["GET"] = async (ctx) => {
  if (
    !import.meta.env.DEV &&
    ctx.request.headers.get("Authorization") !==
      `Bearer ${import.meta.env.SEEDER_TOKEN}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sq = db.$with("sq").as(
    db
      .select({
        name: Words.name,
        created_at: Words.created_at,
        length: sql`length(${Words.name})`.as("length"),
      })
      .from(Words)
      .where(and(gte(sql`length(${Words.name})`, 15))),
  );

  const rows = await db.with(sq).select().from(sq).orderBy(desc(sq.length));

  // const rows = await db
  //   .delete(Words)
  //   .where(
  //     and(
  //       lt(Words.created_at, new Date("2024-09-20T15:00:40.000Z")),
  //       gte(Words.created_at, new Date("2024-09-20T14:00:40.000Z")),
  //     ),
  //   );
  // const rows = await db.update(Words).set({
  //   // sampled_count: sql`${Words.sampled_count} + 20`,
  //   success_rate: sql`CAST (${Words.success_count} as REAL) / ${Words.sampled_count}`,
  //   rejected_rate: sql`CAST (${Words.rejected_count} as REAL) / ${Words.sampled_count}`,
  // });

  return Response.json({ rows });
};
