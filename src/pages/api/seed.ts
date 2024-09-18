import { db } from "@/db/drizzle";
import { Words } from "@/db/schema";
import type { EndpointHandler } from "astro";
import { count } from "drizzle-orm";

export const GET: EndpointHandler["GET"] = async (ctx) => {
  if (
    !import.meta.env.DEV &&
    ctx.request.headers.get("Authorization") !==
      `Bearer ${import.meta.env.SEEDER_TOKEN}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  // const words = (await fetch(
  //   "https://raw.githubusercontent.com/dwyl/english-words/master/words_dictionary.json",
  // ).then(async (res) => Object.keys(await res.json()))) as string[];

  // console.log(words.length);
  // const wordChunks = words.slice(370100);
  // let rowsAffected = 0;

  // const result = await db
  //   .insert(Words)
  //   .values(wordChunks.map((name) => ({ name })))
  //   .onConflictDoNothing();
  // rowsAffected += result.rowsAffected;

  const res = await db
    .select({ count: count() })
    .from(Words)
    .then((res) => res[0].count);

  return new Response(
    JSON.stringify({
      count: res,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  );
};
