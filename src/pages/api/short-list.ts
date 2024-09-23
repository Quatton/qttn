import type { EndpointHandler } from "astro";
import { db } from "@/db/drizzle";
import { WordShortList } from "@/db/schema";
import { sql } from "drizzle-orm";

export const GET: EndpointHandler["GET"] = async (ctx) => {
  if (
    !import.meta.env.DEV &&
    ctx.request.headers.get("Authorization") !==
      `Bearer ${import.meta.env.SEEDER_TOKEN}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  // we can't do CTEs in drizzle yet (sadly)
  // const sq = db
  //   .$with("sq").as(
  //     db
  //     .select()
  //     .from(Words)
  //     .orderBy(asc(sql`RANDOM()`))
  //     .where(
  //       and(
  //         eq(Words.likely_not_a_word_count, 0),
  //         eq(Words.inappropriate_count, 0),
  //       ))
  //     .limit(10000)
  //   )

  const LIMIT = 1000;

  await db.delete(WordShortList);
  const sqll = sql`
  insert into "word_short_list" ("id")
  select "id" from "words" 
  where "likely_not_a_word_count" = 0 
  and "inappropriate_count" = 0 order by 
  RANDOM() limit ${LIMIT} on conflict do nothing;`;

  const rows = await db.run(sqll);
  return Response.json({
    rows,
  });
};
