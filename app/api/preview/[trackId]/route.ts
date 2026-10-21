import { NextResponse } from "next/server";
import { deezerPreview } from "@/lib/deezer";
import { getTrackInfo } from "@/lib/tidal";

// Extrait audio d'un titre Tidal (pour les logs) : { url, cover, link } ou 404 si Deezer ne l'a pas.
export async function GET(_req: Request, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  try {
    const t = await getTrackInfo(trackId);
    const p = await deezerPreview(t.isrc, t.artist, t.title);
    if (!p) return NextResponse.json({ error: "Aucun extrait disponible pour ce titre" }, { status: 404 });
    return NextResponse.json(p, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
