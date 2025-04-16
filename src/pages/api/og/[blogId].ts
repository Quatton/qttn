import { ImageResponse } from "@cloudflare/pages-plugin-vercel-og/api";
import { Og } from "./_og";

export async function GET() {
  return new ImageResponse(Og, {
    width: 1920,
    height: 1080,
  });
}
