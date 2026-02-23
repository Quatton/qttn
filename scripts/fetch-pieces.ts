import fs from "node:fs";

const pieces = ["K", "Q", "R", "B", "N", "P"];
const colors = ["white", "black"];

const baseUrl =
  "https://raw.githubusercontent.com/nikfrank/react-chess-pieces/refs/heads/master/src/";

async function fetchSvgs() {
  const svgMap: Record<string, string> = {};

  const fetchPromises = pieces.flatMap((piece) =>
    colors.map(async (color) => {
      const key = `${color === "white" ? piece.toUpperCase() : piece.toLowerCase()}-${color}`;
      const url = `${baseUrl}${key}.svg`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const svgContent = await response.text();
        return { key, svgContent: svgContent.trim() };
      } catch (error) {
        console.error(error);
        return null;
      }
    }),
  );

  const results = await Promise.allSettled(fetchPromises);

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const { key, svgContent } = result.value;
      svgMap[key] = svgContent;
    }
  }

  const json = JSON.stringify(svgMap, null, 2);
  fs.writeFileSync("chess-pieces.json", json);
  console.log("Saved to chess-pieces.json");
  console.log(json);
}

fetchSvgs();
