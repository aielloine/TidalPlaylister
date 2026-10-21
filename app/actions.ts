"use server";

import cron from "node-cron";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { defaultPriority, normGenre, parseList } from "@/lib/genres";
import { coverSub, renderCover } from "@/lib/coverImage";
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
  if (name) await tryCover(await tidal.createPlaylist(name), name);
  revalidatePath("/playlists");
}

// ---------- Pochettes générées ----------

async function coverSubtitle(playlistId: string) {
  return coverSub(await prisma.mapping.findMany({ where: { playlistId } }));
}

async function applyCoverTo(playlistId: string, name: string) {
  const artworkId = await tidal.setPlaylistCover(playlistId, await renderCover(name, await coverSubtitle(playlistId)));
  await prisma.playlistCover.upsert({ where: { playlistId }, update: { artworkId, name, appliedAt: new Date() }, create: { playlistId, artworkId, name } });
}

// À la création : une pochette ratée ne doit pas faire échouer la création de la playlist.
async function tryCover(playlistId: string, name: string) {
  await applyCoverTo(playlistId, name).catch((e) => console.warn(`[cover] « ${name} » : ${(e as Error).message}`));
}

const coverError = (e: unknown) => redirect(`/playlists?error=${encodeURIComponent(`Pochette non appliquée : ${(e as Error).message}`)}`);

export async function applyCover(playlistId: string, name: string) {
  await requireUser();
  try {
    await applyCoverTo(playlistId, name);
  } catch (e) {
    coverError(e);
  }
  revalidatePath("/playlists");
}

// Toutes les playlists gérées (au moins un genre mappé) sans pochette à jour.
export async function applyAllCovers() {
  await requireUser();
  const [playlists, covers, mapped] = await Promise.all([
    tidal.getPlaylists(),
    prisma.playlistCover.findMany(),
    prisma.mapping.findMany({ select: { playlistId: true }, distinct: ["playlistId"] }),
  ]);
  const managed = new Set(mapped.map((m) => m.playlistId));
  const fresh = new Map(covers.map((c) => [c.playlistId, c.name]));
  try {
    for (const p of playlists) if (managed.has(p.id) && fresh.get(p.id) !== p.name) await applyCoverTo(p.id, p.name);
  } catch (e) {
    coverError(e);
  }
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

// Crée (ou réutilise, par nom) une playlist et y mappe les genres encore libres.
async function createAndMap(name: string, wanted: [string, number][], existing?: tidal.Playlist[]) {
  const found = (existing ?? (await tidal.getPlaylists())).find((p) => p.name.toLowerCase() === name.toLowerCase());
  const playlistId = found?.id ?? (await tidal.createPlaylist(name));
  const playlistName = found?.name ?? name;
  const taken = new Set((await prisma.mapping.findMany({ select: { genre: true } })).map((m) => m.genre));
  for (const [genre, priority] of wanted)
    if (!taken.has(genre) && taken.add(genre)) await prisma.mapping.create({ data: { genre, priority, playlistId, playlistName } });
  if (!found) {
    existing?.push({ id: playlistId, name, tracks: 0 });
    await tryCover(playlistId, name); // nouvelle playlist : pochette générée d'office
  }
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
}

export async function ignoreGenre(genre: string) {
  await requireUser();
  const { ignoredGenres } = await getSettings();
  await prisma.settings.update({ where: { id: 1 }, data: { ignoredGenres: parseList(`${ignoredGenres},${genre}`).join(",") } });
  revalidatePath("/playlists");
}

export async function deleteMapping(id: number) {
  await requireUser();
  await prisma.mapping.delete({ where: { id } });
  revalidatePath("/playlists");
}
