"use server";

import cron from "node-cron";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { defaultPriority, normGenre, parseList } from "@/lib/genres";
import { coverSub } from "@/lib/coverImage";
import { MOODS, moodTags } from "@/lib/moods";
import { titleCase } from "@/lib/suggestions";
import { startScheduler } from "@/lib/scheduler";
import { isSyncRunning, runSync } from "@/lib/sync";
import * as tidal from "@/lib/tidal";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createAdmin(f: FormData) {
  if (await prisma.user.count()) redirect("/login");
  const username = str(f, "username");
  const password = String(f.get("password") ?? "");
  const err = !username
    ? "Nom d'utilisateur requis"
    : password.length < 8
      ? "Mot de passe : 8 caractères minimum"
      : password !== f.get("confirm")
        ? "Les mots de passe ne correspondent pas"
        : null;
  if (err) redirect(`/setup?error=${encodeURIComponent(err)}`);
  await prisma.user.create({ data: { username, passwordHash: hashPassword(password) } });
  redirect("/login?created=1");
}

export async function syncNow(dryRun: boolean) {
  await requireUser();
  if (!isSyncRunning()) runSync({ dryRun, trigger: "manual" }).catch((e) => console.error("[sync]", e));
  await new Promise((r) => setTimeout(r, 300)); // laisse le SyncRun se créer avant le re-render
  revalidatePath("/");
}

export async function saveSettings(f: FormData) {
  await requireUser();
  const cronExpression = str(f, "cronExpression");
  if (!cron.validate(cronExpression)) redirect(`/?error=${encodeURIComponent(`Expression cron invalide : ${cronExpression}`)}`);
  const scanLimit = Number(str(f, "scanLimit") || 300);
  if (!Number.isInteger(scanLimit) || scanLimit < 0) redirect(`/?error=${encodeURIComponent("Nombre de favoris analysés : entier ≥ 0 attendu")}`);
  const data = {
    cronExpression,
    cronEnabled: f.get("cronEnabled") === "on",
    dryRun: f.get("dryRun") === "on",
    removeFromFavorites: f.get("removeFromFavorites") === "on",
    pruneMismatched: f.get("pruneMismatched") === "on",
    scanLimit,
  };
  await prisma.settings.upsert({ where: { id: 1 }, update: data, create: data });
  await startScheduler();
  revalidatePath("/");
}

export async function disconnectTidal() {
  await requireUser();
  await tidal.disconnect();
  revalidatePath("/");
}

export async function createPlaylist(f: FormData) {
  await requireUser();
  const name = str(f, "name");
  if (name) await tidal.createPlaylist(name);
  revalidatePath("/playlists");
}

const priorityOf = (f: FormData) => {
  const v = str(f, "priority");
  return v === "" || !Number.isFinite(Number(v)) ? undefined : Math.round(Number(v));
};

export async function addMapping(playlistId: string, playlistName: string, f: FormData) {
  await requireUser();
  // Champ "genres" : liste séparée par des virgules ; un genre déjà mappé ailleurs est réassigné.
  // Priorité vide = automatique (0 pour un genre générique, 10 sinon).
  const priority = priorityOf(f);
  for (const genre of parseList(f.getAll("genres").join(","))) {
    const p = priority ?? defaultPriority(genre);
    await prisma.mapping.upsert({
      where: { genre },
      update: { playlistId, playlistName, priority: p },
      create: { genre, playlistId, playlistName, priority: p },
    });
  }
  revalidatePath("/playlists");
}

export async function setMappingPriority(id: number, f: FormData) {
  await requireUser();
  const priority = priorityOf(f);
  if (priority !== undefined) await prisma.mapping.update({ where: { id }, data: { priority } });
  revalidatePath("/playlists");
}

export async function saveIgnoredGenres(f: FormData) {
  await requireUser();
  await getSettings();
  await prisma.settings.update({ where: { id: 1 }, data: { ignoredGenres: parseList(str(f, "ignoredGenres")).join(",") } });
  revalidatePath("/playlists");
}

// Mappe vers la playlist les genres encore libres (un genre déjà mappé ailleurs n'est jamais réassigné).
async function mapFree(playlistId: string, playlistName: string, wanted: [string, number][]) {
  const taken = new Set((await prisma.mapping.findMany({ select: { genre: true } })).map((m) => m.genre));
  for (const [genre, priority] of wanted)
    if (!taken.has(genre) && taken.add(genre)) await prisma.mapping.create({ data: { genre, priority, playlistId, playlistName } });
}

// Crée (ou réutilise, par nom) une playlist et y mappe les genres encore libres.
async function createAndMap(name: string, wanted: [string, number][], existing?: tidal.Playlist[]) {
  const found = (existing ?? (await tidal.getPlaylists())).find((p) => p.name.toLowerCase() === name.toLowerCase());
  const playlistId = found?.id ?? (await tidal.createPlaylist(name));
  const playlistName = found?.name ?? name;
  await mapFree(playlistId, playlistName, wanted);
  if (!found) existing?.push({ id: playlistId, name, tracks: 0 });
}

// Clé d'idée : "mood:<index>" (catalogue) ou "genre:<nom>" (playlist au nom d'un genre détecté).
function idea(key: string): [string, [string, number][]] | null {
  if (key.startsWith("mood:")) {
    const mood = MOODS[Number(key.slice(5))];
    return mood ? [mood.name, moodTags(mood)] : null;
  }
  if (key.startsWith("genre:")) {
    const genre = normGenre(key.slice(6));
    return genre ? [titleCase(genre), [[genre, defaultPriority(genre)]]] : null;
  }
  return null;
}

export async function applyMood(index: number) {
  await requireUser();
  const i = idea(`mood:${index}`);
  if (i) await createAndMap(...i);
  revalidatePath("/playlists");
}

export async function applySuggestion(key: string) {
  await requireUser();
  const i = idea(key);
  if (i) await createAndMap(...i);
  revalidatePath("/playlists");
}

// « Ajouter à… » : les tags encore libres d'une idée vont dans une playlist existante (aucune création).
export async function applyIdeaTo(key: string, f: FormData) {
  await requireUser();
  const i = idea(key);
  const playlistId = str(f, "playlistId");
  const target = playlistId ? (await tidal.getPlaylists()).find((p) => p.id === playlistId) : undefined;
  if (i && target) await mapFree(target.id, target.name, i[1]);
  revalidatePath("/playlists");
}

// « Tout créer » : un seul aller-retour pour lister les playlists existantes.
export async function applySuggestions(f: FormData) {
  await requireUser();
  const playlists = await tidal.getPlaylists();
  for (const key of f.getAll("key").map(String)) {
    const i = idea(key);
    if (i) await createAndMap(i[0], i[1], playlists);
  }
  revalidatePath("/playlists");
}

// Depuis un chip « genre non mappé » : l'associe à une playlist existante.
export async function assignGenre(f: FormData) {
  await requireUser();
  const genre = normGenre(str(f, "genre"));
  const playlistId = str(f, "playlistId");
  if (!genre || !playlistId) return;
  const p = priorityOf(f) ?? defaultPriority(genre);
  const playlistName = str(f, "playlistName");
  await prisma.mapping.upsert({
    where: { genre },
    update: { playlistId, playlistName, priority: p },
    create: { genre, playlistId, playlistName, priority: p },
  });
  revalidatePath("/playlists");
  revalidatePath("/"); // chips de genres des logs
}

export async function ignoreGenre(genre: string) {
  await requireUser();
  const { ignoredGenres } = await getSettings();
  await prisma.settings.update({ where: { id: 1 }, data: { ignoredGenres: parseList(`${ignoredGenres},${genre}`).join(",") } });
  revalidatePath("/playlists");
  revalidatePath("/");
}

// Depuis un chip de genre des logs : retire son mapping (le genre redevient « non mappé »).
export async function unmapGenre(genre: string) {
  await requireUser();
  await prisma.mapping.deleteMany({ where: { genre: normGenre(genre) } });
  revalidatePath("/playlists");
  revalidatePath("/");
}

// Playlists Tidal pour le menu d'un genre des logs, chargées à la première ouverture (pas d'appel Tidal à chaque
// rendu du dashboard). sub : sous-titre de pochette si la playlist est gérée, null sinon.
export async function listPlaylists() {
  await requireUser();
  const [playlists, mappings] = await Promise.all([tidal.getPlaylists(), prisma.mapping.findMany()]);
  return playlists.map((p) => {
    const own = mappings.filter((m) => m.playlistId === p.id);
    return { ...p, sub: own.length ? coverSub(own) : null };
  });
}

// Fusion : copie les titres des sources dans la cible (sans doublon, dans l'ordre), y transfère leurs genres et le
// suivi des titres déjà classés, puis supprime éventuellement les sources sur Tidal.
export async function mergePlaylists(f: FormData) {
  await requireUser();
  const target = str(f, "target");
  const sources = [...new Set(f.getAll("source").map(String))].filter((id) => id && id !== target);
  const back = (key: "error" | "notice", msg: string) => redirect(`/playlists?${key}=${encodeURIComponent(msg)}`);
  if (!target || !sources.length) back("error", "Fusion : choisissez au moins une playlist à fusionner et une playlist cible différente.");
  const remove = f.get("deleteSources") === "on";
  let added = 0;
  let dest: tidal.Playlist | undefined;
  try {
    const playlists = new Map((await tidal.getPlaylists()).map((p) => [p.id, p]));
    dest = playlists.get(target);
    if (!dest) throw new Error("playlist cible introuvable");
    const have = await tidal.getPlaylistTrackIds(target);
    for (const id of sources) {
      if (!playlists.has(id)) throw new Error(`playlist ${id} introuvable`);
      const tracks = [...(await tidal.getPlaylistTrackIds(id))].filter((t) => !have.has(t) && have.add(t));
      if (tracks.length) await tidal.addToPlaylist(target, tracks);
      added += tracks.length;
      await prisma.mapping.updateMany({ where: { playlistId: id }, data: { playlistId: target, playlistName: dest.name } });
      await prisma.processedTrack.updateMany({ where: { playlistId: id }, data: { playlistId: target } });
      if (remove) await tidal.deletePlaylist(id);
    }
  } catch (e) {
    back("error", `Fusion interrompue : ${(e as Error).message}`);
  }
  revalidatePath("/playlists");
  back(
    "notice",
    `${sources.length} playlist${sources.length > 1 ? "s fusionnées" : " fusionnée"} dans « ${dest!.name} » : ${added} titre${added > 1 ? "s ajoutés" : " ajouté"}${remove ? ", source" + (sources.length > 1 ? "s supprimées" : " supprimée") : ""}.`,
  );
}

export async function deleteMapping(id: number) {
  await requireUser();
  await prisma.mapping.delete({ where: { id } });
  revalidatePath("/playlists");
}
