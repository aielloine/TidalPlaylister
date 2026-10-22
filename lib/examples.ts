// Exemples de titres pour un genre ou une idée de playlist : d'abord vos propres titres (favoris non classés,
// titres déjà classés) qui portent ces genres, puis des titres connus du genre (Last.fm, sinon une playlist Deezer).
import { prisma } from "./db";
import { deezerPreview, deezerTagTracks, type Preview } from "./deezer";
import { lastfmEnabled, lastfmTagTracks } from "./lastfm";

export type Example = { label: string; trackId?: string; preview?: Preview | null; mine: boolean };

const LIMIT = 6;
const g = globalThis as unknown as { tagExamples?: Map<string, { at: number; list: Example[] }> };
const cache = (g.tagExamples ??= new Map());
const TTL = 3600_000;

async function external(tag: string): Promise<Example[]> {
  const hit = cache.get(tag);
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  let list: Example[];
  if (lastfmEnabled()) {
    const tracks = await lastfmTagTracks(tag, LIMIT);
    list = [];
    for (const t of tracks) list.push({ label: `${t.artist} — ${t.title}`, preview: await deezerPreview(undefined, t.artist, t.title).catch(() => null), mine: false });
  } else {
    list = (await deezerTagTracks(tag, LIMIT)).map((t) => ({ label: `${t.artist} — ${t.title}`, preview: t.preview, mine: false }));
  }
  list = list.filter((e) => e.preview);
  if (cache.size > 200) cache.clear();
  cache.set(tag, { at: Date.now(), list });
  return list;
}

export async function examplesFor(tags: string[]): Promise<Example[]> {
  const wanted = new Set(tags);
  const [unsorted, processed] = await Promise.all([
    prisma.unsortedTrack.findMany(),
    prisma.processedTrack.findMany({ where: { genres: { not: null }, label: { not: null } }, orderBy: { createdAt: "desc" } }),
  ]);
  const mine: Example[] = [];
  for (const t of [...unsorted, ...processed]) {
    if (mine.length >= LIMIT) break;
    const genres = JSON.parse(t.genres ?? "[]") as string[];
    if (genres.some((x) => wanted.has(x)) && !mine.some((m) => m.trackId === t.trackId)) mine.push({ label: t.label!, trackId: t.trackId, mine: true });
  }
  if (mine.length >= LIMIT || !tags.length) return mine;
  const more = await external(tags[0]).catch((e) => {
    console.warn("[examples]", (e as Error).message);
    return [];
  });
  return [...mine, ...more.slice(0, LIMIT - mine.length)];
}
