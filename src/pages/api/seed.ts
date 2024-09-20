import { db } from "@/db/drizzle";
import { now, Words } from "@/db/schema";
import type { EndpointHandler } from "astro";
import { count, eq, sql } from "drizzle-orm";

export const GET: EndpointHandler["GET"] = async (ctx) => {
  if (
    !import.meta.env.DEV &&
    ctx.request.headers.get("Authorization") !==
      `Bearer ${import.meta.env.SEEDER_TOKEN}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const words = (
    await fetch(
      "https://raw.githubusercontent.com/first20hours/google-10000-english/refs/heads/master/google-10000-english-no-swears.txt",
    ).then(async (res) => res.text())
  ).split("\n");

  const totalWords = words.length;
  const wordWithSpaceCount = words.filter((word) => word.includes(" ")).length;

  const workChunker = (arr: string[], chunkSize: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize));
    }

    if (arr.length - chunks.length * chunkSize > 0) {
      chunks.push(arr.slice(chunks.length * chunkSize));
    }

    return chunks;
  };

  let rowsAffected = 0;
  const wordChunks: string[][] = [];
  // const wordChunks = workChunker(words, 1000);

  const rowsAffecteds = await Promise.all(
    wordChunks.map(async (chunk) =>
      db
        .insert(Words)
        .values(
          chunk.map((name) => ({
            name,
            is_phrase: name.includes(" "),
            sampled_count: 100,
            success_count: 100,
            rejected_count: 0,
            rejected_rate: 0,
            success_rate: 0,
          })),
        )
        .onConflictDoUpdate({
          target: [Words.name],
          set: {
            created_at: now,
          },
        })
        .then((res) => res.rowsAffected),
    ),
  );

  rowsAffected = rowsAffecteds.reduce((acc, cur) => acc + cur, 0);

  const res = await db
    .select({ count: count() })
    .from(Words)
    .then((res) => res[0].count);

  return new Response(
    JSON.stringify({
      dbCount: res,
      rowsAffected,
      wordWithSpaceCount,
      count: totalWords,
      words: words.slice(0, 100),
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  );
};
