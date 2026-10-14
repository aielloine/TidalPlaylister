// Règles de choix du genre : priorités, genres ignorés, compilations, doublons.

// Au-delà de ce nombre de genres, une source (piste/album Tidal, album Deezer) est considérée comme une
// compilation : ses genres ne veulent rien dire et on passe à la source suivante.
export const COMPILATION_THRESHOLD = 4;

// Genres ignorés : Settings.ignoredGenres (modifiable sur /playlists).

// Genres « parapluie » : priorité 0 par défaut, pour que le spécifique (rap français, dubstep, disco…) gagne.
// ⚠️ liste recopiée dans la migration 20261009120000 pour les mappings existants.
const GENERIC = new Set([
  "pop", "rock", "electro", "electronic", "electronica", "dance", "rap/hip hop", "hip-hop", "hip hop", "rap",
  "alternative", "alternatif", "indie", "r&b", "soul & funk", "jazz", "classique", "classical", "metal", "folk",
  "country", "reggae", "latino", "world", "variété", "variété française", "chanson française", "musique africaine",
]);
export const defaultPriority = (genre: string) => (GENERIC.has(genre) ? 0 : 10);

export const normGenre = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const parseList = (s: string) => [...new Set(s.split(",").map(normGenre).filter(Boolean))];

// Garde les genres non ignorés d'une source, ou [] si elle ressemble à une compilation.
export function usable(genres: string[], ignored: Set<string>) {
  if (genres.length > COMPILATION_THRESHOLD) return [];
  return genres.filter((g) => !ignored.has(g));
}

// Genre mappé le plus prioritaire ; à égalité, le premier dans l'ordre du titre (tags Last.fm par score décroissant).
export function pickMapping<M extends { priority: number }>(genres: string[], mappings: Map<string, M>) {
  let best: { genre: string; mapping: M } | undefined;
  for (const genre of genres) {
    const mapping = mappings.get(genre);
    if (mapping && (!best || mapping.priority > best.mapping.priority)) best = { genre, mapping };
  }
  return best;
}

// ---------- Doublons ----------

const VERSION_NOISE = /\b(feat|ft|featuring|with|remaster(ed)?|radio edit|edit|single version|album version|explicit|clean|mono|stereo|bonus track)\b/;

export function normTitle(title: string) {
  let t = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // « (feat. X) », « [Remastered 2011] », « - Radio Edit » : même morceau. « (Acoustic) », « (Remix) » : non.
  t = t.replace(/[([][^)\]]*[)\]]/g, (m) => (VERSION_NOISE.test(m) ? " " : m));
  t = t.replace(/\s+-\s+(.*)$/, (m, rest) => (VERSION_NOISE.test(rest) ? " " : m));
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

// Regroupe les titres identiques (même ISRC, ou même artiste principal + titre normalisé), ordre conservé.
export function groupDuplicates<T extends { isrc?: string; artist: string; title: string }>(tracks: T[]): T[][] {
  const groups: T[][] = [];
  const index = new Map<string, number>();
  for (const t of tracks) {
    const keys = [t.isrc && `isrc:${t.isrc.toUpperCase()}`, `at:${normTitle(t.artist)}|${normTitle(t.title)}`].filter(Boolean) as string[];
    const found = keys.map((k) => index.get(k)).find((i) => i !== undefined);
    const i = found ?? groups.push([]) - 1;
    groups[i].push(t);
    for (const k of keys) index.set(k, i);
  }
  return groups;
}
