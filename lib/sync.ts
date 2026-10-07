import { prisma } from "./db";
import { addToPlaylist, getFavoriteTrackIds, removeFavorites, resolveTracks } from "./tidal";

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
    const ids = await getFavoriteTrackIds(SCAN_LIMIT);
    await log("info", `${ids.length} favori(s) analysé(s), ${mappings.size} genre(s) mappé(s)`);

    const tracks = await resolveTracks(ids);
    const seen = new Set(tracks.flatMap((t) => t.genres));
    for (const name of seen) await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });

    // Regroupement par playlist de destination.
    const byPlaylist = new Map<string, { name: string; tracks: typeof tracks }>();
    for (const t of tracks) {
      const genre = t.genres.find((x) => mappings.has(x));
      if (!genre) {
        counts.skipped++;
        await log(
          "skipped",
          `${t.label} — ${t.genres.length ? `genre non mappé (${t.genres.join(", ")})` : "aucun genre"} : reste en favori`,
          t.id,
        );
        continue;
      }
      const m = mappings.get(genre)!;
      const group = byPlaylist.get(m.playlistId) ?? { name: m.playlistName, tracks: [] };
      group.tracks.push(t);
      byPlaylist.set(m.playlistId, group);
    }

    for (const [playlistId, { name, tracks: group }] of byPlaylist) {
      const groupIds = group.map((t) => t.id);
      try {
        if (!dryRun) {
          await addToPlaylist(playlistId, groupIds);
          // Retrait des favoris seulement après un ajout réussi : en cas d'erreur, le titre reste en favori.
          await removeFavorites(groupIds);
        }
        counts.moved += group.length;
        for (const t of group)
          await log("moved", `${dryRun ? "[DRY RUN] " : ""}${t.label} → « ${name} » (${t.genres.join(", ")})`, t.id);
      } catch (e) {
        counts.failed += group.length;
        await log("error", `Échec pour « ${name} » (${group.length} titre(s)) : ${(e as Error).message}`);
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
