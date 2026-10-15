"use server";

import cron from "node-cron";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { defaultPriority, parseList } from "@/lib/genres";
import { MOODS } from "@/lib/moods";
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

// Crée (ou réutilise, par nom) la playlist d'ambiance et y mappe ses tags encore libres.
export async function applyMood(index: number) {
  await requireUser();
  const mood = MOODS[index];
  if (!mood) return;
  const existing = (await tidal.getPlaylists()).find((p) => p.name.toLowerCase() === mood.name.toLowerCase());
  const playlistId = existing?.id ?? (await tidal.createPlaylist(mood.name));
  const taken = new Set((await prisma.mapping.findMany({ select: { genre: true } })).map((m) => m.genre));
  const wanted: [string, number][] = [...mood.tags.map((t): [string, number] => [t, mood.priority]), ...(mood.generic ?? []).map((t): [string, number] => [t, 1])];
  for (const [genre, priority] of wanted)
    if (!taken.has(genre) && taken.add(genre)) await prisma.mapping.create({ data: { genre, priority, playlistId, playlistName: existing?.name ?? mood.name } });
  revalidatePath("/playlists");
}

export async function deleteMapping(id: number) {
  await requireUser();
  await prisma.mapping.delete({ where: { id } });
  revalidatePath("/playlists");
}
