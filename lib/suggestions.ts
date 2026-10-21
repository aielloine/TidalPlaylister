import { MOODS, moodTags } from "./moods";

// Idées de playlists classées par nombre de favoris non classés qu'elles rangeraient (UnsortedTrack).
export type Unsorted = { label: string; genres: string[] };
export type Suggestion = {
  key: string; // "mood:<index>" | "genre:<nom>"
  name: string;
  count: number; // favoris non classés couverts (chacun compté une fois)
  tags: string[]; // tags libres qui les couvrent, du plus fréquent au moins fréquent
  examples: string[];
  exists: boolean; // une playlist de ce nom existe déjà : elle sera complétée
  coverSub: string; // sous-titre de la pochette qui sera générée (3 premiers tags mappés)
};

const MIN_GENRE_HITS = 3; // en dessous, un genre seul ne justifie pas une playlist

export const titleCase = (s: string) => s.replace(/(^|[\s/&-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

function cover(tracks: Unsorted[], tags: Set<string>) {
  const hits = tracks.filter((t) => t.genres.some((g) => tags.has(g)));
  const freq = new Map<string, number>();
  for (const t of hits) for (const g of t.genres) if (tags.has(g)) freq.set(g, (freq.get(g) ?? 0) + 1);
  return {
    count: hits.length,
    tags: [...freq].sort((a, b) => b[1] - a[1]).map(([g]) => g),
    examples: hits.slice(0, 3).map((t) => t.label),
  };
}

export function suggestPlaylists(tracks: Unsorted[], mapped: Set<string>, ignored: Set<string>, playlistNames: Set<string>) {
  const free = (g: string) => !mapped.has(g) && !ignored.has(g);
  const out: Suggestion[] = [];

  MOODS.forEach((m, i) => {
    const tags = moodTags(m).map(([g]) => g).filter(free);
    const c = cover(tracks, new Set(tags));
    if (c.count) out.push({ key: `mood:${i}`, name: m.name, exists: playlistNames.has(m.name.toLowerCase()), coverSub: tags.slice(0, 3).join(" · "), ...c });
  });

  // Genres fréquents qu'aucune idée du catalogue ne couvre : une playlist à leur nom.
  const catalog = new Set(MOODS.flatMap((m) => moodTags(m).map(([g]) => g)));
  const freq = new Map<string, number>();
  for (const t of tracks) for (const g of t.genres) if (free(g) && !catalog.has(g)) freq.set(g, (freq.get(g) ?? 0) + 1);
  for (const [g, n] of freq) {
    if (n < MIN_GENRE_HITS) continue;
    const name = titleCase(g);
    out.push({ key: `genre:${g}`, name, exists: playlistNames.has(name.toLowerCase()), coverSub: g, ...cover(tracks, new Set([g])) });
  }

  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Comptes par mood (index) pour le catalogue complet, 0 si rien à ranger.
export const moodCounts = (s: Suggestion[]) =>
  new Map(s.filter((x) => x.key.startsWith("mood:")).map((x) => [Number(x.key.slice(5)), x.count]));
