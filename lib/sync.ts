import { getSettings, prisma } from "./db";
import { groupDuplicates, parseList, pickMapping } from "./genres";
import { lastfmEnabled } from "./lastfm";
import {
  addFavorites,
  addToPlaylist,
  getFavoriteTrackIds,
  getPlaylistItems,
  getPlaylistTrackIds,
  getTrackInfo,
  removeFavorites,
  removeFromPlaylist,
  resolveTracks,
  type TrackInfo as Track,
} from "./tidal";

const KEEP_LOG_RUNS = 50;
const BACKFILL_PER_RUN = 200; // titres classés avant le stockage des genres : ré-analysés par lots

const g = globalThis as unknown as { syncRunning?: boolean };
export const isSyncRunning = () => !!g.syncRunning;

export async function runSync({ dryRun, trigger }: { dryRun: boolean; trigger: "cron" | "manual" }) {
  // Verrou : cron et déclenchement manuel ne tournent jamais en parallèle.
  if (g.syncRunning) throw new Error("Synchronisation déjà en cours");
  g.syncRunning = true;
  const run = await prisma.syncRun.create({ data: { dryRun, trigger } });
  // genres : tous ceux du titre, pour les afficher (et les remapper) depuis les logs, même s'il a été classé.
  const log = (level: "info" | "moved" | "removed" | "skipped" | "error", message: string, trackId?: string, genres?: string[]) =>
    prisma.logEntry.create({ data: { runId: run.id, level, message, trackId, genres: genres && JSON.stringify(genres) } });
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
    type Entry = { main: Track; dups: Track[]; genre: string; genres: string[] };
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
          genres,
        );
        continue;
      }
      const m = pick.mapping;
      const group = byPlaylist.get(m.playlistId) ?? { name: m.playlistName, entries: [] };
      group.entries.push({ main, dups, genre: pick.genre, genres });
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
          // byApp : seuls les titres ajoutés par l'appli pourront en être retirés plus tard (pas ceux déjà présents).
          for (const e of entries)
            for (const t of [e.main, ...e.dups]) {
              const data = { playlistId, label: t.label, genres: JSON.stringify(e.genres), byApp: t === e.main && !isPresent(e) };
              await prisma.processedTrack.upsert({ where: { trackId: t.id }, update: {}, create: { trackId: t.id, ...data } });
            }
          // Retrait des favoris seulement après un ajout réussi : en cas d'erreur, le titre reste en favori.
          if (!keep) await removeFavorites(allIds);
        }
        counts.moved += keep ? toAdd.length : allIds.length;
        counts.skipped += keep ? entries.length - toAdd.length : 0;
        for (const e of entries) {
          const { main, dups, genre, genres } = e;
          if (isPresent(e)) {
            await log("info", `${prefix}${main.label} — déjà dans « ${name} » : non ré-ajouté${keep ? "" : ", retiré des favoris"}`, main.id, genres);
          } else {
            const others = main.genres.filter((x) => x !== genre).slice(0, 5);
            await log("moved", `${prefix}${main.label} → « ${name} » via ${genre}${others.length ? ` (${others.join(", ")})` : ""}${favNote}`, main.id, genres);
          }
          for (const d of dups)
            await log("moved", `${prefix}${d.label} — doublon de ${main.id} : ${keep ? "non ajouté (reste en favori)" : "retiré des favoris"}`, d.id);
        }
      } catch (e) {
        counts.failed += allIds.length;
        await log("error", `Échec pour « ${name} » (${allIds.length} titre(s)) : ${(e as Error).message}`);
      }
    }

    const rebalanced = settings.pruneMismatched ? await rebalance({ dryRun, favorites: new Set(ids), mappings, ignored, log, counts }) : 0;

    // Suggestions de playlists : favoris restés non classés à ce passage (dry run compris).
    await prisma.$transaction([prisma.unsortedTrack.deleteMany(), prisma.unsortedTrack.createMany({ data: unsorted })]);

    await log(
      "info",
      `Terminé : ${counts.moved} classé(s), ${counts.skipped} ignoré(s), ${counts.failed} en échec${rebalanced ? `, ${rebalanced} rangé(s) à nouveau` : ""}`,
    );
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

type Mappings = Map<string, { playlistId: string; playlistName: string; priority: number }>;
type Log = (level: "info" | "moved" | "removed" | "error", message: string, trackId?: string, genres?: string[]) => Promise<unknown>;

// Titres déjà classés par l'appli dont les genres ne mènent plus à leur playlist (mapping supprimé ou réassigné,
// genre ignoré…) : déplacés vers la bonne playlist, ou retirés et remis en favori s'ils ne correspondent plus à rien.
// Ne touche qu'aux playlists encore mappées, et jamais à un titre retiré à la main ou présent avant l'appli.
// favorites : favoris lus à ce passage. Un titre qui sort de sa playlist sans en rejoindre une autre est remis en
// favori s'il n'y est pas (sinon il disparaîtrait de la bibliothèque).
async function rebalance({
  dryRun,
  favorites,
  mappings,
  ignored,
  log,
  counts,
}: {
  dryRun: boolean;
  favorites: Set<string>;
  mappings: Mappings;
  ignored: Set<string>;
  log: Log;
  counts: { failed: number };
}) {
  const prefix = dryRun ? "[DRY RUN] " : "";
  const names = new Map([...mappings.values()].map((m) => [m.playlistId, m.playlistName]));
  const managed = { byApp: true, playlistId: { in: [...names.keys()] } };

  // Titres classés avant que l'appli ne mémorise leurs genres : ré-analysés par lots.
  const missing = await prisma.processedTrack.findMany({ where: { ...managed, genres: null }, take: BACKFILL_PER_RUN });
  if (missing.length) {
    const infos = await resolveTracks(missing.map((r) => r.trackId), ignored);
    for (const t of infos)
      await prisma.processedTrack.update({ where: { trackId: t.id }, data: { label: t.label, genres: JSON.stringify(t.genres) } });
    // Introuvables dans le catalogue Tidal (retirés, ou indisponibles dans le pays) : genres impossibles à connaître.
    // On garde le titre là où il est (byApp false : plus jamais ré-analysé ni déplacé) et on récupère au moins son nom.
    const found = new Set(infos.map((t) => t.id));
    const lost = missing.filter((r) => !found.has(r.trackId));
    for (const r of lost) {
      const t = await getTrackInfo(r.trackId).catch(() => null);
      const label = t?.title ? `${t.artist || "?"} — ${t.title}` : null;
      await prisma.processedTrack.update({ where: { trackId: r.trackId }, data: { byApp: false, ...(label && { label }) } });
      await log("info", `${label ?? r.trackId} — introuvable sur Tidal : genres inconnus, laissé dans « ${names.get(r.playlistId) ?? r.playlistId} »`, r.trackId);
    }
    const left = await prisma.processedTrack.count({ where: { ...managed, genres: null } });
    await log("info", `${infos.length} titre(s) déjà classé(s) ré-analysé(s) pour vérifier leur playlist${left ? ` (${left} au prochain passage)` : ""}`);
  }

  const rows = await prisma.processedTrack.findMany({ where: { ...managed, genres: { not: null } } });
  const moves = rows
    .map((r) => {
      const genres = (JSON.parse(r.genres!) as string[]).filter((g) => !ignored.has(g));
      const pick = pickMapping(genres, mappings);
      return { r, genres, to: pick?.mapping.playlistId ?? null, genre: pick?.genre ?? "" };
    })
    .filter((m) => m.to !== m.r.playlistId);
  if (!moves.length) return 0;

  let done = 0;
  const targets = new Map<string, Set<string>>(); // contenu des playlists cibles, lu une fois
  for (const [from, list] of Map.groupBy(moves, (m) => m.r.playlistId)) {
    const fromName = names.get(from) ?? from;
    try {
      const items = await getPlaylistItems(from);
      const gone = list.filter((m) => !items.has(m.r.trackId)); // retiré à la main : on n'y touche plus
      const live = list.filter((m) => items.has(m.r.trackId));
      if (!dryRun && gone.length)
        await prisma.processedTrack.updateMany({ where: { trackId: { in: gone.map((m) => m.r.trackId) } }, data: { byApp: false } });

      const toAdd = new Map<string, string[]>();
      for (const m of live.filter((m) => m.to)) {
        if (!targets.has(m.to!)) targets.set(m.to!, await getPlaylistTrackIds(m.to!));
        if (!targets.get(m.to!)!.has(m.r.trackId)) toAdd.set(m.to!, [...(toAdd.get(m.to!) ?? []), m.r.trackId]);
      }
      if (live.some((m) => !items.get(m.r.trackId)!.length)) throw new Error("Tidal n'a pas fourni l'identifiant des entrées de la playlist");
      const orphans = live.filter((m) => !m.to).map((m) => m.r.trackId);
      const refav = orphans.filter((id) => !favorites.has(id));
      if (!dryRun) {
        // Ajout avant retrait : en cas d'erreur, le titre reste au moins dans une playlist.
        for (const [to, ids] of toAdd) {
          await addToPlaylist(to, ids);
          ids.forEach((id) => targets.get(to)!.add(id));
        }
        if (refav.length) await addFavorites(refav);
        await removeFromPlaylist(from, live.flatMap((m) => items.get(m.r.trackId)!.map((itemId) => ({ trackId: m.r.trackId, itemId }))));
        for (const m of live)
          if (m.to) await prisma.processedTrack.update({ where: { trackId: m.r.trackId }, data: { playlistId: m.to } });
        await prisma.processedTrack.deleteMany({ where: { trackId: { in: orphans } } }); // redevient un favori à classer
      }
      for (const m of live) {
        const label = m.r.label ?? m.r.trackId;
        if (m.to) await log("moved", `${prefix}${label} → « ${names.get(m.to)} » via ${m.genre} (retiré de « ${fromName} »)`, m.r.trackId, m.genres);
        else
          await log(
            "removed",
            `${prefix}${label} — retiré de « ${fromName} » : plus aucun genre mappé${refav.includes(m.r.trackId) ? ", remis en favori" : ""}`,
            m.r.trackId,
            m.genres,
          );
      }
      done += live.length;
    } catch (e) {
      counts.failed += list.length;
      await log("error", `Échec du rangement de « ${fromName} » (${list.length} titre(s)) : ${(e as Error).message}`);
    }
  }
  return done;
}
