// Titres déjà classés par l'appli (ProcessedTrack), avec leurs genres mémorisés : listés dans les logs et sous
// chaque playlist pour retrouver un titre et changer la playlist de ses genres.
import { prisma } from "./db";
import { parseList, pickMapping } from "./genres";

export type ClassifiedTrack = {
  trackId: string;
  label: string;
  genres: string[];
  playlistId: string;
  playlistName: string | null; // null : playlist plus mappée (nom inconnu sans appel Tidal)
  at: string; // date de classement, déjà formatée
  managed: boolean; // false : déjà présent avant l'appli ou retiré à la main, l'appli n'y touche plus
  via: string | null; // genre qui décide aujourd'hui de sa playlist (mappings actuels)
  next: string | null; // playlist où il ira à la prochaine synchro (« Ranger à nouveau »), si ce n'est pas la sienne
};

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export async function classifiedTracks(ignoredGenres: string, names: Map<string, string> = new Map()): Promise<ClassifiedTrack[]> {
  const [rows, mappingRows] = await Promise.all([
    prisma.processedTrack.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.mapping.findMany(),
  ]);
  const ignored = new Set(parseList(ignoredGenres));
  const mappings = new Map(mappingRows.map((m) => [m.genre, m]));
  for (const m of mappingRows) if (!names.has(m.playlistId)) names.set(m.playlistId, m.playlistName);
  return rows.map((r) => {
    const genres = (JSON.parse(r.genres ?? "[]") as string[]).filter((g) => !ignored.has(g));
    const pick = pickMapping(genres, mappings);
    const managed = r.byApp && mappingRows.some((m) => m.playlistId === r.playlistId);
    return {
      trackId: r.trackId,
      label: r.label ?? r.trackId,
      genres,
      playlistId: r.playlistId,
      playlistName: names.get(r.playlistId) ?? null,
      at: DATE.format(r.createdAt),
      managed,
      via: pick?.genre ?? null,
      next: managed && pick?.mapping.playlistId !== r.playlistId ? (pick?.mapping.playlistName ?? "aucune (remis en favori)") : null,
    };
  });
}
