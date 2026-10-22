import { NextResponse, type NextRequest } from "next/server";
import { COVER_SIZE, renderCover } from "@/lib/coverImage";

// Pochette générée : /api/cover?name=Électro%20chill&sub=french%20house%20·%20nu%20disco
//   &w=64|128|256|512 : vignette PNG pour l'interface (sinon 1080 × 1080, JPEG si sharp est dispo) ; &download=1 : en pièce jointe.
const g = globalThis as unknown as { coverPreviews?: Map<string, Awaited<ReturnType<typeof renderCover>>> };
const cache = (g.coverPreviews ??= new Map());
const WIDTHS = [64, 128, 256, 512];

const fileName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "pochette";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const name = (q.get("name") ?? "").trim().slice(0, 80);
  const sub = (q.get("sub") ?? "").trim().slice(0, 120);
  if (!name) return new NextResponse("name requis", { status: 400 });
  const w = WIDTHS.includes(Number(q.get("w"))) ? Number(q.get("w")) : COVER_SIZE;
  const key = `${name}\n${sub}\n${w}`;
  let img = cache.get(key);
  if (!img) {
    try {
      img = await renderCover(name, sub, w);
    } catch (e) {
      console.error("[cover]", e);
      return new NextResponse(`Pochette impossible à générer : ${(e as Error).message}`, { status: 500 });
    }
    if (cache.size > 400) cache.clear(); // purge grossière : une pochette se régénère en ~100 ms
    cache.set(key, img);
  }
  const headers: Record<string, string> = { "Content-Type": img.type, "Cache-Control": "private, max-age=86400" };
  if (q.get("download")) headers["Content-Disposition"] = `attachment; filename="${fileName(name)}.${img.type === "image/png" ? "png" : "jpg"}"`;
  return new NextResponse(new Uint8Array(img.data), { headers });
}
