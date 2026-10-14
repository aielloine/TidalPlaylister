import { getSettings, prisma } from "./db";
import { groupDuplicates, parseList, pickMapping } from "./genres";
import { lastfmEnabled } from "./lastfm";
import { addToPlaylist, getFavoriteTrackIds, removeFavorites, resolveTracks, type TrackInfo as Track } from "./tidal";

// ponytail: seuls les N favoris les plus récents sont analysés à chaque passage (les titres triés sortent
// des favoris, donc la fenêtre avance). Monter la valeur si des titres anciens doivent être rattrapés.
const SCAN_LIMIT = 300;
const KEEP_LOG_RUNS = 50;

const g = globalThis as unknown as { syncRunning?: boolean };
export const isSyncRunning = () => !!g.syncRunning;

export async function runSync({ dryRun, trigger }: { dryRun: boolean; trigger: "cron" | "manual" }) {
  // Verrou : cron et déclenchement manuel ne tournent jamais en parallèle.
  if (g.syncRunning) throw new Error("Synchronisation déjà en cours");
  g.syncRunning = true;
  const run = await prisma.syncRun.create({ data: { dryRun, trigger } });
  const log = (level: "info" | "moved" | "skipped" | "error", message: string, trackId?: string) =>
    prisma.logEntry.create({ data: { runId: run.id, level, message, trackId } });
  const counts = { moved: 0, skipped: 0, failed: 0 };

  try {
    await prisma.logEntry.deleteMany({ where: { runId: { lte: run.id - KEEP_LOG_RUNS } } });
    await log("info", `Démarrage (${trigger}${dryRun ? ", DRY RUN : aucune modification sur Tidal" : ""})`);

    const mappings = new Map((await prisma.mapping.findMany()).map((m) => [m.genre, m]));
    const ignored = new Set(parseList((await getSettings()).ignoredGenres));
    const ids = await getFavoriteTrackIds(SCAN_LIMIT);
    await log(
      "info",
      `${ids.length} favori(s) analysé(s), ${mappings.size} genre(s) mappé(s), Last.fm ${lastfmEnabled() ? "actif" : "inactif (LASTFM_API_KEY absent)"}`,
    );

    const tracks = await resolveTracks(ids, ignored);
    const seen = new Set(tracks.flatMap((t) => t.genres));
    for (const name of seen) await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });

    // Doublons (même ISRC ou même artiste + titre normalisé) : un seul exemplaire va dans la playlist,
    // tous sortent des favoris. Le premier est le favori le plus récent.
    type Entry = { main: Track; dups: Track[]; genre: string };
    const byPlaylist = new Map<string, { name: string; entries: Entry[] }>();
    for (const [main, ...dups] of groupDuplicates(tracks)) {
      const genres = [...new Set([main, ...dups].flatMap((t) => t.genres))];
      const dupNote = dups.length ? ` (+ ${dups.length} doublon(s))` : "";
      const pick = pickMapping(genres, mappings);
      if (!pick) {
        counts.skipped += 1 + dups.length;
        await log(
          "skipped",
          `${main.label}${dupNote} — ${genres.length ? `genre non mappé (${genres.join(", ")})` : "aucun genre"} : reste en favori`,
          main.id,
        );
        continue;
      }
      const m = pick.mapping;
      const group = byPlaylist.get(m.playlistId) ?? { name: m.playlistName, entries: [] };
      group.entries.push({ main, dups, genre: pick.genre });
      byPlaylist.set(m.playlistId, group);
    }

    for (const [playlistId, { name, entries }] of byPlaylist) {
      const allIds = entries.flatMap((e) => [e.main.id, ...e.dups.map((d) => d.id)]);
      const prefix = dryRun ? "[DRY RUN] " : "";
      try {
        if (!dryRun) {
          await addToPlaylist(playlistId, entries.map((e) => e.main.id));
          // Retrait des favoris seulement après un ajout réussi : en cas d'erreur, le titre reste en favori.
          await removeFavorites(allIds);
        }
        counts.moved += allIds.length;
        for (const { main, dups, genre } of entries) {
          const others = main.genres.filter((x) => x !== genre).slice(0, 5);
          await log("moved", `${prefix}${main.label} → « ${name} » via ${genre}${others.length ? ` (${others.join(", ")})` : ""}`, main.id);
          for (const d of dups) await log("moved", `${prefix}${d.label} — doublon de ${main.id} : retiré des favoris`, d.id);
        }
      } catch (e) {
        counts.failed += allIds.length;
        await log("error", `Échec pour « ${name} » (${allIds.length} titre(s)) : ${(e as Error).message}`);
      }
    }

    await log("info", `Terminé : ${counts.moved} déplacé(s), ${counts.skipped} ignoré(s), ${counts.failed} en échec`);
    return await prisma.syncRun.update({
      where: { id: run.id },
      data: { ...counts, status: counts.failed ? "error" : "success", finishedAt: new Date() },
    });
  } catch (e) {
    await log("error", (e as Error).message);
    await prisma.syncRun.update({ where: { id: run.id }, data: { ...counts, status: "error", finishedAt: new Date() } });
    throw e;
  } finally {
    g.syncRunning = false;
  }
}
