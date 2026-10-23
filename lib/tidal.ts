import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { deezerGenres } from "./deezer";
import { fetchRetry } from "./http";
import { usable } from "./genres";
import { lastfmTags } from "./lastfm";

// Surchargeables pour les tests (faux serveur Tidal).
const API = process.env.TIDAL_API_URL ?? "https://openapi.tidal.com/v2";
const TOKEN_URL = process.env.TIDAL_TOKEN_URL ?? "https://auth.tidal.com/v1/oauth2/token";
const SCOPES = "user.read collection.read collection.write playlists.read playlists.write";

export const redirectUri = () => `${process.env.NEXTAUTH_URL}/api/tidal/callback`;
const clientId = () => {
  if (!process.env.TIDAL_CLIENT_ID) throw new Error("TIDAL_CLIENT_ID manquant");
  return process.env.TIDAL_CLIENT_ID;
};

// ---------- OAuth2 (Authorization Code + PKCE) ----------

export function startAuthorization() {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  const url = new URL("https://login.tidal.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    state,
  }).toString();
  return { url: url.toString(), verifier, state };
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetchRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), ...params }),
  }, "Tidal");
  if (!res.ok) throw new Error(`Token Tidal refusé (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function completeAuthorization(code: string, verifier: string) {
  const t = await requestToken({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  });
  if (!t.refresh_token) throw new Error("Tidal n'a pas renvoyé de refresh token");
  const me = await rawFetch("/users/me", t.access_token).then((r) => r.json());
  const data = {
    tidalUserId: me.data.id as string,
    countryCode: (me.data.attributes?.country as string) ?? "US",
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
    scope: t.scope ?? SCOPES,
  };
  await prisma.tidalToken.upsert({ where: { id: 1 }, update: data, create: data });
}

export const disconnect = () => prisma.tidalToken.deleteMany();

const g = globalThis as unknown as { tidalRefresh?: Promise<string> };

async function accessToken() {
  const tok = await prisma.tidalToken.findUnique({ where: { id: 1 } });
  if (!tok) throw new Error("Tidal non connecté");
  if (tok.expiresAt.getTime() - Date.now() > 60_000) return tok.accessToken;
  // Un seul refresh à la fois : deux appels concurrents réutiliseraient un refresh token déjà consommé.
  g.tidalRefresh ??= (async () => {
    const t = await requestToken({ grant_type: "refresh_token", refresh_token: tok.refreshToken });
    await prisma.tidalToken.update({
      where: { id: 1 },
      data: {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? tok.refreshToken,
        expiresAt: new Date(Date.now() + t.expires_in * 1000),
      },
    });
    return t.access_token;
  })().finally(() => (g.tidalRefresh = undefined));
  return g.tidalRefresh;
}

// ---------- HTTP ----------

async function rawFetch(path: string, token: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const res = await fetchRetry(
    path.startsWith("http") ? path : API + path,
    { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.api+json", ...init.headers } },
    "Tidal",
  );
  if (res.status === 429 && attempt < 5) {
    const wait = Number(res.headers.get("Retry-After")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait * 1000));
    return rawFetch(path, token, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`Tidal ${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status}: ${await res.text()}`);
  return res;
}

async function api<T = JsonApiDoc>(path: string, init?: RequestInit): Promise<T> {
  const res = await rawFetch(path, await accessToken(), init);
  return res.status === 204 || res.headers.get("content-length") === "0" ? ({} as T) : res.json();
}

type Resource = {
  id: string;
  type: string;
  attributes?: Record<string, any>;
  relationships?: Record<string, { data?: { id: string; type: string }[] }>;
  meta?: Record<string, any>;
};
type JsonApiDoc = { data: Resource | Resource[]; included?: Resource[]; links?: { next?: string } };

// Suit links.next et concatène les pages.
async function all(path: string, limit = Infinity) {
  const data: Resource[] = [];
  let next: string | undefined = path;
  while (next && data.length < limit) {
    const doc: JsonApiDoc = await api(next);
    data.push(...(doc.data as Resource[]));
    next = doc.links?.next;
  }
  return data.slice(0, limit);
}

const qs = (params: [string, string][]) => new URLSearchParams(params).toString();
const chunk = <T>(arr: T[], n: number) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const country = async () =>
  (await prisma.tidalToken.findUniqueOrThrow({ where: { id: 1 } })).countryCode;

// ---------- Playlists ----------

export type Playlist = { id: string; name: string; tracks: number };

export async function getPlaylists(): Promise<Playlist[]> {
  const tok = await prisma.tidalToken.findUniqueOrThrow({ where: { id: 1 } });
  const data = await all(
    `/playlists?${qs([["filter[owners.id]", tok.tidalUserId], ["countryCode", tok.countryCode], ["sort", "name"]])}`,
  );
  return data.map((p) => ({ id: p.id, name: p.attributes?.name, tracks: p.attributes?.numberOfTrackItems ?? 0 }));
}

export async function createPlaylist(name: string): Promise<string> {
  const doc = await api("/playlists", {
    method: "POST",
    body: JSON.stringify({ data: { type: "playlists", attributes: { name, accessType: "UNLISTED" } } }),
  });
  return (doc.data as Resource).id;
}

export async function addToPlaylist(playlistId: string, trackIds: string[]) {
  for (const ids of chunk(trackIds, 50))
    await api(`/playlists/${playlistId}/relationships/items`, {
      method: "POST",
      // SKIP : si une synchro précédente a ajouté le titre sans réussir à le retirer des favoris, pas de doublon.
      body: JSON.stringify({ data: ids.map((id) => ({ id, type: "tracks" })), meta: { onDuplicates: "SKIP" } }),
    });
}

// trackId -> identifiants des entrées de la playlist (un titre peut y figurer plusieurs fois).
export async function getPlaylistItems(playlistId: string) {
  const data = await all(`/playlists/${playlistId}/relationships/items?countryCode=${await country()}`);
  const items = new Map<string, string[]>();
  for (const d of data.filter((d) => d.type === "tracks")) items.set(d.id, [...(items.get(d.id) ?? []), d.meta?.itemId].filter(Boolean));
  return items;
}

export const getPlaylistTrackIds = async (playlistId: string) => new Set((await getPlaylistItems(playlistId)).keys());

// Retire des entrées d'une playlist (Tidal exige l'itemId de chaque entrée, pas seulement l'id du titre).
export async function removeFromPlaylist(playlistId: string, entries: { trackId: string; itemId: string }[]) {
  for (const part of chunk(entries, 20))
    await api(`/playlists/${playlistId}/relationships/items`, {
      method: "DELETE",
      body: JSON.stringify({ data: part.map((e) => ({ id: e.trackId, type: "tracks", meta: { itemId: e.itemId } })) }),
    });
}

export async function renamePlaylist(playlistId: string, name: string) {
  await api(`/playlists/${playlistId}`, {
    method: "PATCH",
    body: JSON.stringify({ data: { id: playlistId, type: "playlists", attributes: { name } } }),
  });
}

// Supprime une playlist (fusion). Les pochettes ne sont pas gérées ici : POST /artworks est refusé aux accès
// tiers (« Access tier is insufficient »), elles se téléchargent depuis l'appli et se posent à la main.
export async function deletePlaylist(playlistId: string) {
  await api(`/playlists/${playlistId}`, { method: "DELETE" });
}

// ---------- Titre seul (extraits audio) ----------

export async function getTrackInfo(trackId: string) {
  const doc = await api(`/tracks/${encodeURIComponent(trackId)}?${qs([["include", "artists"], ["countryCode", await country()]])}`);
  const t = doc.data as Resource;
  const artist = (doc.included ?? []).find((r) => r.type === "artists")?.attributes?.name as string | undefined;
  return { isrc: t.attributes?.isrc as string | undefined, title: (t.attributes?.title as string) ?? "", artist: artist ?? "" };
}

// ---------- Favoris ----------

// limit = 0 : tous les favoris.
export async function getFavoriteTrackIds(limit: number) {
  const data = await all(`/userCollectionTracks/me/relationships/items?sort=-addedAt`, limit || Infinity);
  // Tidal peut renvoyer un même titre deux fois (chevauchement de pages) : dédoublonné, ordre conservé.
  return [...new Set(data.filter((d) => d.type === "tracks").map((d) => d.id))];
}

export async function addFavorites(trackIds: string[]) {
  for (const ids of chunk(trackIds, 50))
    await api(`/userCollectionTracks/me/relationships/items`, {
      method: "POST",
      body: JSON.stringify({ data: ids.map((id) => ({ id, type: "tracks" })) }),
    });
}

export async function removeFavorites(trackIds: string[]) {
  for (const ids of chunk(trackIds, 50))
    await api(`/userCollectionTracks/me/relationships/items`, {
      method: "DELETE",
      body: JSON.stringify({ data: ids.map((id) => ({ id, type: "tracks" })) }),
    });
}

// ---------- Genres ----------

// Liste officielle des genres Tidal (l'API n'expose pas d'autre moyen de tous les lister).
// Mis en cache 6 h : appelé à chaque affichage de /playlists, et la liste ne bouge quasiment jamais.
const GENRES_TTL = 6 * 3600_000;
const genreCache = globalThis as unknown as { tidalGenres?: { at: number; list: string[] } };
export async function getTidalGenres() {
  const c = genreCache.tidalGenres;
  if (c && Date.now() - c.at < GENRES_TTL) return c.list;
  const data = await all(`/genres?filter[id]=USER_SELECTABLE&locale=en-US`);
  // Sans gravité : l'autocomplétion se rabat sur les genres Deezer et ceux vus sur vos titres.
  if (!data.length) console.warn("[tidal] /genres?filter[id]=USER_SELECTABLE a renvoyé 0 genre (prochain essai dans 6 h)");
  const list = data.map((g) => String(g.attributes?.genreName ?? "").trim().toLowerCase()).filter(Boolean);
  genreCache.tidalGenres = { at: Date.now(), list };
  return list;
}

export type TrackInfo = { id: string; label: string; artist: string; title: string; isrc?: string; genres: string[] };

const rel = (r: Resource, name: string) => r.relationships?.[name]?.data?.map((d) => d.id) ?? [];
const genreNames = (ids: string[], byId: Map<string, Resource>) =>
  ids.map((id) => byId.get(id)?.attributes?.genreName?.trim().toLowerCase()).filter(Boolean) as string[];

// Genres candidats, du plus fin au plus générique :
//   1. tags Last.fm (titre, puis artiste si peu de tags), triés par score ;
//   2. premier repli exploitable parmi : genre de la piste Tidal → genre de l'album Tidal → genres Deezer (ISRC).
// Un repli est sauté s'il est vide, entièrement ignoré, ou s'il a plus de COMPILATION_THRESHOLD genres.
export async function resolveTracks(trackIds: string[], ignored = new Set<string>()): Promise<TrackInfo[]> {
  const cc = await country();
  const out: TrackInfo[] = [];
  for (const ids of chunk(trackIds, 20)) {
    const doc = await api(
      `/tracks?${qs([...ids.map((id): [string, string] => ["filter[id]", id]), ["include", "genres"], ["include", "artists"], ["include", "albums"], ["countryCode", cc]])}`,
    );
    const byId = new Map((doc.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));
    const get = (type: string) => new Map([...byId].filter(([k]) => k.startsWith(type + ":")).map(([k, v]) => [k.split(":")[1], v]));
    const genres = get("genres");
    const artists = get("artists");
    const tracks = doc.data as Resource[];
    const own = new Map(tracks.map((t) => [t.id, usable(genreNames(rel(t, "genres"), genres), ignored)]));

    const albumIds = [...new Set(tracks.filter((t) => !own.get(t.id)!.length).map((t) => rel(t, "albums")[0]).filter(Boolean))];
    const albumGenres = new Map<string, string[]>();
    for (const aIds of chunk(albumIds, 20)) {
      const a = await api(
        `/albums?${qs([...aIds.map((id): [string, string] => ["filter[id]", id]), ["include", "genres"], ["countryCode", cc]])}`,
      );
      const ag = new Map((a.included ?? []).filter((r) => r.type === "genres").map((r) => [r.id, r]));
      for (const album of a.data as Resource[]) albumGenres.set(album.id, usable(genreNames(rel(album, "genres"), ag), ignored));
    }

    for (const t of tracks) {
      const isrc = t.attributes?.isrc as string | undefined;
      const names = rel(t, "artists").map((id) => artists.get(id)?.attributes?.name as string).filter(Boolean);
      const title = (t.attributes?.title as string) ?? t.id;
      let fallback = own.get(t.id)!;
      if (!fallback.length) fallback = albumGenres.get(rel(t, "albums")[0]) ?? [];
      if (!fallback.length && isrc) fallback = usable(await deezerGenres(isrc), ignored);
      // Pas de seuil « compilation » ici : Last.fm renvoie naturellement beaucoup de tags.
      const tags = (await lastfmTags(names[0] ?? "", title)).filter((x) => !ignored.has(x));
      out.push({
        id: t.id,
        label: `${names.join(", ") || "?"} — ${title}`,
        artist: names[0] ?? "",
        title,
        isrc,
        genres: [...new Set([...tags, ...fallback])],
      });
    }
  }
  return out;
}
