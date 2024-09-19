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

  const words = (
    await fetch(
      "https://raw.githubusercontent.com/meetDeveloper/freeDictionaryAPI/refs/heads/master/meta/wordList/english.txt",
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
  const wordChunks = workChunker(words, 1000).slice(0, 0);

  for (const chunk of wordChunks) {
    const result = await db
      .insert(Words)
      .values(chunk.map((name) => ({ name, is_phrase: name.includes(" ") })))
      .onConflictDoNothing();
    rowsAffected += result.rowsAffected;
  }

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
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  );
};
