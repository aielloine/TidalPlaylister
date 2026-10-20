import { getSettings, prisma } from "./db";
import { groupDuplicates, parseList, pickMapping } from "./genres";
import { lastfmEnabled } from "./lastfm";
import { addToPlaylist, getFavoriteTrackIds, getPlaylistTrackIds, removeFavorites, resolveTracks, type TrackInfo as Track } from "./tidal";

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

    const settings = await getSettings();
    const keep = !settings.removeFromFavorites;
    const mappings = new Map((await prisma.mapping.findMany()).map((m) => [m.genre, m]));
    const ignored = new Set(parseList(settings.ignoredGenres));
    // Même fenêtre en dry run et en réel : les N favoris les plus récents (0 = tous).
    const ids = await getFavoriteTrackIds(settings.scanLimit);
    await log(
      "info",
      `${ids.length} favori(s) analysé(s) (${settings.scanLimit ? `${settings.scanLimit} plus récents max` : "tous"}), ` +
        `${mappings.size} genre(s) mappé(s), Last.fm ${lastfmEnabled() ? "actif" : "inactif (LASTFM_API_KEY absent)"}, ` +
        `favoris ${keep ? "conservés" : "retirés après classement"}`,
    );

    // Titres déjà classés lors d'un passage précédent : jamais ré-ajoutés (même retirés de la playlist à la main).
    const done = new Set((await prisma.processedTrack.findMany({ select: { trackId: true } })).map((p) => p.trackId));
    const already = ids.filter((id) => done.has(id));
    if (already.length) {
      // Mode « retirer » : finit le déplacement (retrait raté, ou bascule depuis le mode « conserver »).
      if (!keep && !dryRun) await removeFavorites(already);
      await log(
        "info",
        `${dryRun ? "[DRY RUN] " : ""}${already.length} titre(s) déjà classé(s) : non ré-ajouté(s)${keep ? "" : ", retiré(s) des favoris"}`,
      );
    }

    const tracks = await resolveTracks(ids.filter((id) => !done.has(id)), ignored);
    const seen = new Set(tracks.flatMap((t) => t.genres));
    for (const name of seen) await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });

    // Doublons (même ISRC ou même artiste + titre normalisé) : un seul exemplaire va dans la playlist,
    // tous sortent des favoris (mode « retirer »). Le premier est le favori le plus récent.
    type Entry = { main: Track; dups: Track[]; genre: string };
    const byPlaylist = new Map<string, { name: string; entries: Entry[] }>();
    const unsorted: { trackId: string; label: string; genres: string }[] = [];
    for (const [main, ...dups] of groupDuplicates(tracks)) {
      const genres = [...new Set([main, ...dups].flatMap((t) => t.genres))];
      const dupNote = dups.length ? ` (+ ${dups.length} doublon(s))` : "";
      const pick = pickMapping(genres, mappings);
      if (!pick) {
        counts.skipped += 1 + dups.length;
        unsorted.push({ trackId: main.id, label: main.label, genres: JSON.stringify(genres) });
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

    const prefix = dryRun ? "[DRY RUN] " : "";
    const favNote = keep ? " (reste en favori)" : "";
    for (const [playlistId, { name, entries }] of byPlaylist) {
      const allIds = [...new Set(entries.flatMap((e) => [e.main.id, ...e.dups.map((d) => d.id)]))];
      try {
        // Jamais de doublon dans la playlist : on saute les titres (ou un de leurs doublons) déjà présents.
        const present = await getPlaylistTrackIds(playlistId);
        const isPresent = (e: Entry) => [e.main, ...e.dups].some((t) => present.has(t.id));
        const toAdd = entries.filter((e) => !isPresent(e));
        if (!dryRun) {
          await addToPlaylist(playlistId, toAdd.map((e) => e.main.id));
          // upsert un par un : robuste aux doublons d'ID et aux enregistrements d'un passage interrompu.
          for (const trackId of allIds)
            await prisma.processedTrack.upsert({ where: { trackId }, update: {}, create: { trackId, playlistId } });
          // Retrait des favoris seulement après un ajout réussi : en cas d'erreur, le titre reste en favori.
          if (!keep) await removeFavorites(allIds);
        }
        counts.moved += keep ? toAdd.length : allIds.length;
        counts.skipped += keep ? entries.length - toAdd.length : 0;
        for (const e of entries) {
          const { main, dups, genre } = e;
          if (isPresent(e)) {
            await log("info", `${prefix}${main.label} — déjà dans « ${name} » : non ré-ajouté${keep ? "" : ", retiré des favoris"}`, main.id);
          } else {
            const others = main.genres.filter((x) => x !== genre).slice(0, 5);
            await log("moved", `${prefix}${main.label} → « ${name} » via ${genre}${others.length ? ` (${others.join(", ")})` : ""}${favNote}`, main.id);
          }
          for (const d of dups)
            await log("moved", `${prefix}${d.label} — doublon de ${main.id} : ${keep ? "non ajouté (reste en favori)" : "retiré des favoris"}`, d.id);
        }
      } catch (e) {
        counts.failed += allIds.length;
        await log("error", `Échec pour « ${name} » (${allIds.length} titre(s)) : ${(e as Error).message}`);
      }
    }

    // Suggestions de playlists : favoris restés non classés à ce passage (dry run compris).
    await prisma.$transaction([prisma.unsortedTrack.deleteMany(), prisma.unsortedTrack.createMany({ data: unsorted })]);

    await log("info", `Terminé : ${counts.moved} classé(s), ${counts.skipped} ignoré(s), ${counts.failed} en échec`);
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
