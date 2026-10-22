// Repli pour les genres : l'API publique Tidal ne renseigne quasiment aucun genre. Deezer (API publique, sans clé)
// retrouve le titre par ISRC et expose les genres de son album.
import { fetchRetry } from "./http";

const API = process.env.DEEZER_API_URL ?? "https://api.deezer.com";

// ponytail: cache mémoire ISRC -> genres, perdu au redémarrage ; le passer en base si le volume de favoris explose.
const g = globalThis as unknown as { deezerCache?: Map<string, string[]> };
const cache = (g.deezerCache ??= new Map());

async function get(path: string, attempt = 0): Promise<any> {
  await new Promise((r) => setTimeout(r, 110)); // quota Deezer : 50 requêtes / 5 s
  const d = await (await fetchRetry(API + path, {}, "Deezer")).json();
  if (d.error?.code === 4 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 5000)); // quota dépassé
    return get(path, attempt + 1);
  }
  return d;
}

const names = (album: any) =>
  ((album?.genres?.data ?? []) as { name: string }[]).map((x) => x.name.trim().toLowerCase()).filter(Boolean);

export async function deezerGenres(isrc: string): Promise<string[]> {
  if (cache.has(isrc)) return cache.get(isrc)!;
  let track: any;
  try {
    track = await get(`/track/isrc:${encodeURIComponent(isrc)}`);
  } catch (e) {
    // Repli facultatif : Deezer injoignable ne fait pas échouer la synchro (pas de mise en cache, réessayé au passage suivant).
    console.warn("[deezer]", (e as Error).message);
    return [];
  }
  if (track.error || !track.album?.id) {
    if (track.error?.code === 800) cache.set(isrc, []); // 800 = introuvable : inutile de réessayer
    return [];
  }
  try {
    const genres = names(await get(`/album/${track.album.id}`));
    cache.set(isrc, genres);
    return genres;
  } catch (e) {
    console.warn("[deezer]", (e as Error).message);
    return [];
  }
}

export async function deezerGenreList(): Promise<string[]> {
  const d = await get("/genre");
  return ((d.data ?? []) as { id: number; name: string }[]).filter((x) => x.id !== 0).map((x) => x.name.trim().toLowerCase());
}

// Extrait de 30 s (MP3 public Deezer) : par ISRC, sinon recherche artiste + titre. Les liens expirent : cache court.
export type Preview = { url: string; cover?: string; link?: string };
const pg = globalThis as unknown as { deezerPreviews?: Map<string, { at: number; p: Preview | null }> };
const previews = (pg.deezerPreviews ??= new Map());
const PREVIEW_TTL = 10 * 60_000;

const toPreview = (t: any): Preview | null => (t?.preview ? { url: t.preview, cover: t.album?.cover_medium, link: t.link } : null);

export async function deezerPreview(isrc: string | undefined, artist: string, title: string): Promise<Preview | null> {
  const key = isrc || `${artist}|${title}`;
  const hit = previews.get(key);
  if (hit && Date.now() - hit.at < PREVIEW_TTL) return hit.p;
  let p: Preview | null = null;
  if (isrc) {
    const t = await get(`/track/isrc:${encodeURIComponent(isrc)}`);
    if (!t.error) p = toPreview(t);
  }
  if (!p && title) {
    const clean = title.replace(/\s*[([].*?[)\]]/g, ""); // « (feat. X) », « [Remastered] » gênent la recherche
    const q = artist ? `artist:"${artist}" track:"${clean}"` : clean;
    const r = await get(`/search?${new URLSearchParams({ q, limit: "1" })}`);
    p = toPreview(r.data?.[0]);
  }
  if (previews.size > 500) previews.clear();
  previews.set(key, { at: Date.now(), p });
  return p;
}

// Sans Last.fm : titres de la première playlist Deezer trouvée pour ce genre (exemples à écouter).
export async function deezerTagTracks(tag: string, limit = 5): Promise<{ artist: string; title: string; preview: Preview | null }[]> {
  const pl = await get(`/search/playlist?${new URLSearchParams({ q: tag, limit: "1" })}`);
  const id = pl.data?.[0]?.id;
  if (!id) return [];
  const t = await get(`/playlist/${id}/tracks?limit=${limit}`);
  return ((t.data ?? []) as any[]).map((x) => ({ artist: x.artist?.name ?? "", title: x.title ?? "", preview: toPreview(x) }));
}
