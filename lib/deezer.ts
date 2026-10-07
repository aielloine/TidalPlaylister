// Repli pour les genres : l'API publique Tidal ne renseigne quasiment aucun genre. Deezer (API publique, sans clé)
// retrouve le titre par ISRC et expose les genres de son album.
const API = process.env.DEEZER_API_URL ?? "https://api.deezer.com";

// ponytail: cache mémoire ISRC -> genres, perdu au redémarrage ; le passer en base si le volume de favoris explose.
const g = globalThis as unknown as { deezerCache?: Map<string, string[]> };
const cache = (g.deezerCache ??= new Map());

async function get(path: string, attempt = 0): Promise<any> {
  await new Promise((r) => setTimeout(r, 110)); // quota Deezer : 50 requêtes / 5 s
  const d = await (await fetch(API + path)).json();
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
  const track = await get(`/track/isrc:${encodeURIComponent(isrc)}`);
  const genres = track.error || !track.album?.id ? [] : names(await get(`/album/${track.album.id}`));
  if (!track.error || track.error.code === 800) cache.set(isrc, genres); // 800 = introuvable : inutile de réessayer
  return genres;
}

export async function deezerGenreList(): Promise<string[]> {
  const d = await get("/genre");
  return ((d.data ?? []) as { id: number; name: string }[]).filter((x) => x.id !== 0).map((x) => x.name.trim().toLowerCase());
}
