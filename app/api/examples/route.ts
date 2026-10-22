import { NextResponse, type NextRequest } from "next/server";
import { examplesFor } from "@/lib/examples";
import { normGenre } from "@/lib/genres";

// Exemples à écouter pour des genres : /api/examples?tag=french%20house&tag=nu%20disco
export async function GET(req: NextRequest) {
  const tags = req.nextUrl.searchParams.getAll("tag").map(normGenre).filter(Boolean).slice(0, 20);
  if (!tags.length) return NextResponse.json({ error: "tag requis" }, { status: 400 });
  return NextResponse.json({ examples: await examplesFor(tags) }, { headers: { "Cache-Control": "private, max-age=300" } });
}
