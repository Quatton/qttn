import type { db } from "@/db/drizzle";
import { WordShortList } from "@/db/schema";
import { sql } from "drizzle-orm";

export const SHORT_LIST_LIMIT = 1000;

export async function refreshWordShortList(
  client: Parameters<Parameters<typeof db.transaction>[0]>[0],
  limit = SHORT_LIST_LIMIT,
) {
  await client.delete(WordShortList);

  const query = sql`
    insert into "word_short_list" ("id")
    select "id" from "words"
    where "likely_not_a_word_count" = 0
      and "inappropriate_count" = 0
    order by RANDOM()
    limit ${limit}
    on conflict do nothing;
  `;

  return await client.run(query);
}
