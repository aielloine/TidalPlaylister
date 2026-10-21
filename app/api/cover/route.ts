import { NextResponse, type NextRequest } from "next/server";
import { renderCover } from "@/lib/coverImage";

// Aperçu de la pochette générée : /api/cover?name=Électro%20chill&sub=french%20house%20·%20nu%20disco
const g = globalThis as unknown as { coverPreviews?: Map<string, Buffer> };
const cache = (g.coverPreviews ??= new Map());

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim().slice(0, 80);
  const sub = (req.nextUrl.searchParams.get("sub") ?? "").trim().slice(0, 120);
  if (!name) return new NextResponse("name requis", { status: 400 });
  const key = `${name}\n${sub}`;
  let png = cache.get(key);
  if (!png) {
    png = await renderCover(name, sub);
    if (cache.size > 200) cache.clear(); // ponytail: purge grossière, l'aperçu se régénère en ~100 ms
    cache.set(key, png);
  }
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });
}
