"use server";

import cron from "node-cron";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { cronExpression, cronEnabled: f.get("cronEnabled") === "on", dryRun: f.get("dryRun") === "on" },
    create: { cronExpression, cronEnabled: f.get("cronEnabled") === "on", dryRun: f.get("dryRun") === "on" },
  });
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

export async function addMapping(playlistId: string, playlistName: string, f: FormData) {
  await requireUser();
  // "rock, Indie Rock" -> ["rock", "indie rock"] ; un genre déjà mappé ailleurs est réassigné.
  for (const genre of str(f, "genres").toLowerCase().split(",").map((g) => g.trim()).filter(Boolean))
    await prisma.mapping.upsert({
      where: { genre },
      update: { playlistId, playlistName },
      create: { genre, playlistId, playlistName },
    });
  revalidatePath("/playlists");
}

export async function deleteMapping(id: number) {
  await requireUser();
  await prisma.mapping.delete({ where: { id } });
  revalidatePath("/playlists");
}
