// Tags communautaires Last.fm (track.getTopTags, puis artist.getTopTags si le titre a peu de tags).
// Bien plus fins que les genres Tidal/Deezer (« french house », « melodic dubstep », « indie folk »…) et triés
// par score : le premier tag est le genre dominant. Désactivé si LASTFM_API_KEY est absent.
import { normGenre } from "./genres";

const API = process.env.LASTFM_API_URL ?? "https://ws.audioscrobbler.com/2.0/";
const MIN_COUNT = 20; // score relatif 0-100 (100 = tag principal)
const FEW_TAGS = 3; // en dessous, on complète avec les tags de l'artiste

export const lastfmEnabled = () => !!process.env.LASTFM_API_KEY;

// ponytail: caches mémoire perdus au redémarrage, comme Deezer.
const g = globalThis as unknown as { lastfmCache?: Map<string, string[]> };
const cache = (g.lastfmCache ??= new Map());

// null = erreur transitoire (réseau, quota) : on ne met pas en cache.
async function topTags(params: Record<string, string>, attempt = 0): Promise<string[] | null> {
  await new Promise((r) => setTimeout(r, 220)); // quota Last.fm : ~5 requêtes / s
  const url = new URL(API);
  url.search = new URLSearchParams({ ...params, autocorrect: "1", api_key: process.env.LASTFM_API_KEY!, format: "json" }).toString();
  let d: any;
  try {
    d = await (await fetch(url)).json();
  } catch (e) {
    console.warn("[lastfm]", (e as Error).message);
    return null;
  }
  if (d.error === 29 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 5000)); // quota dépassé
    return topTags(params, attempt + 1);
  }
  if (d.error === 6) return []; // titre / artiste inconnu
  if (d.error) {
    console.warn(`[lastfm] ${params.method} : ${d.message ?? d.error}`);
    return null;
  }
  const raw = d.toptags?.tag ?? [];
  return ([] as { name: string; count: number | string }[])
    .concat(raw) // un seul tag : Last.fm renvoie un objet au lieu d'un tableau
    .filter((t) => Number(t.count) >= MIN_COUNT)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .map((t) => normGenre(t.name))
    .filter(Boolean);
}

async function cached(key: string, params: Record<string, string>) {
  if (cache.has(key)) return cache.get(key)!;
  const tags = await topTags(params);
  if (tags) cache.set(key, tags);
  return tags ?? [];
}

export async function lastfmTags(artist: string, title: string): Promise<string[]> {
  if (!lastfmEnabled() || !artist) return [];
  const a = artist.toLowerCase();
  const tags = await cached(`t:${a}\u0000${title.toLowerCase()}`, { method: "track.gettoptags", artist, track: title });
  if (tags.length >= FEW_TAGS) return tags;
  const artistTags = await cached(`a:${a}`, { method: "artist.gettoptags", artist });
  return [...new Set([...tags, ...artistTags])];
}
