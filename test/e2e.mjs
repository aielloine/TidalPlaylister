// Test de bout en bout contre un faux serveur Tidal. Prérequis : `pnpm build`. Lancement : `node test/e2e.mjs`
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP = "http://127.0.0.1:3999";
const FAKE = "http://127.0.0.1:4010";

// ---------- Faux Tidal ----------
const genres = { g1: "Rock", g2: "Jazz", g3: "Electro" };
const tracks = {
  t1: { title: "Song One", genres: ["g1"], album: "a1" }, // genre piste -> rock
  t2: { title: "Song Two", genres: [], album: "a2" }, // genre album -> jazz
  t3: { title: "Song Three", genres: [], album: "a3" }, // aucun genre
  t4: { title: "Song Four", genres: ["g3"], album: "a1" }, // electro, non mappé
  t5: { title: "Song Five", genres: [], album: "a3", isrc: "ISRC5" }, // rien chez Tidal -> Deezer : reggae
};
const albums = { a1: [], a2: ["g2"], a3: [] };
const state = { favorites: ["t1", "t2", "t3", "t4", "t5"], added: {}, created: [], deezerIsrcs: [] };

const fake = createServer(async (req, res) => {
  const url = new URL(req.url, FAKE);
  let body = "";
  for await (const c of req) body += c;
  const json = (o) => res.writeHead(200, { "content-type": "application/vnd.api+json" }).end(JSON.stringify(o));
  const p = url.pathname;
  const ids = url.searchParams.getAll("filter[id]");
  const genreRes = (gs) => gs.map((id) => ({ id, type: "genres", attributes: { genreName: genres[id] } }));

  // Faux Deezer
  if (p.startsWith("/deezer/track/isrc:")) {
    const isrc = decodeURIComponent(p.split(":")[1]);
    state.deezerIsrcs.push(isrc);
    return json(isrc === "ISRC5" ? { id: 5, album: { id: 55 } } : { error: { type: "DataException", code: 800 } });
  }
  if (p === "/deezer/album/55") return json({ id: 55, genres: { data: [{ id: 2, name: "Reggae" }] } });
  if (p === "/deezer/genre") return json({ data: [{ id: 0, name: "All" }, { id: 1, name: "Pop" }, { id: 2, name: "Reggae" }] });

  if (p === "/token") return json({ access_token: "AT", refresh_token: "RT", expires_in: 3600 });
  if (p === "/v2/users/me") return json({ data: { id: "u1", type: "users", attributes: { country: "FR" } } });
  if (p === "/v2/playlists" && req.method === "GET") {
    assert.equal(url.searchParams.get("filter[owners.id]"), "u1");
    return url.searchParams.get("page[cursor]")
      ? json({ data: [{ id: "p2", type: "playlists", attributes: { name: "Jazz", numberOfTrackItems: 3 } }], links: {} })
      : json({
          data: [{ id: "p1", type: "playlists", attributes: { name: "Rock", numberOfTrackItems: 5 } }],
          links: { next: "/playlists?filter[owners.id]=u1&page[cursor]=c2" },
        });
  }
  if (p === "/v2/playlists" && req.method === "POST") {
    state.created.push(JSON.parse(body).data.attributes.name);
    return json({ data: { id: "p9", type: "playlists" } });
  }
  if (p === "/v2/userCollectionTracks/me/relationships/items" && req.method === "GET")
    return json({ data: state.favorites.map((id) => ({ id, type: "tracks" })), links: {} });
  if (p === "/v2/userCollectionTracks/me/relationships/items" && req.method === "DELETE") {
    const rm = JSON.parse(body).data.map((d) => d.id);
    state.favorites = state.favorites.filter((id) => !rm.includes(id));
    return res.writeHead(204).end();
  }
  if (p === "/v2/genres") {
    assert.equal(url.searchParams.get("filter[id]"), "USER_SELECTABLE");
    return json({ data: genreRes(["g1", "g2"]).concat({ id: "g4", type: "genres", attributes: { genreName: "Hip-Hop" } }), links: {} });
  }
  if (p === "/v2/tracks") {
    assert.deepEqual(url.searchParams.getAll("include").sort(), ["albums", "artists", "genres"]);
    return json({
      data: ids.map((id) => ({
        id,
        type: "tracks",
        attributes: { title: tracks[id].title, isrc: tracks[id].isrc ?? `ISRC-${id}` },
        relationships: {
          genres: { data: tracks[id].genres.map((g) => ({ id: g, type: "genres" })) },
          albums: { data: [{ id: tracks[id].album, type: "albums" }] },
          artists: { data: [{ id: "ar1", type: "artists" }] },
        },
      })),
      included: [...genreRes(Object.keys(genres)), { id: "ar1", type: "artists", attributes: { name: "Artist" } }],
    });
  }
  if (p === "/v2/albums")
    return json({
      data: ids.map((id) => ({ id, type: "albums", relationships: { genres: { data: albums[id].map((g) => ({ id: g, type: "genres" })) } } })),
      included: genreRes(ids.flatMap((id) => albums[id])),
    });
  const m = p.match(/^\/v2\/playlists\/(\w+)\/relationships\/items$/);
  if (m && req.method === "POST") {
    assert.equal(JSON.parse(body).meta.onDuplicates, "SKIP");
    (state.added[m[1]] ??= []).push(...JSON.parse(body).data.map((d) => d.id));
    return json({ data: [] });
  }
  res.writeHead(404).end(`fake: ${req.method} ${p}`);
});
await new Promise((r) => fake.listen(4010, "127.0.0.1", r));

// ---------- App ----------
const db = join(mkdtempSync(join(tmpdir(), "tp-")), "test.db");
const env = {
  ...process.env,
  DATABASE_URL: `file:${db}`,
  NEXTAUTH_URL: APP,
  NEXTAUTH_SECRET: "test-secret",
  TIDAL_CLIENT_ID: "cid",
  TIDAL_API_URL: `${FAKE}/v2`,
  TIDAL_TOKEN_URL: `${FAKE}/token`,
  DEEZER_API_URL: `${FAKE}/deezer`,
  PORT: "3999",
  HOSTNAME: "127.0.0.1",
};
execFileSync("node", ["migrate.mjs"], { env, stdio: "inherit" });
const app = spawn("node", [".next/standalone/server.js"], { env, stdio: "inherit" });
const stop = () => (app.kill(), fake.close());
process.on("exit", stop);

const jar = new Map();
async function http(path, init = {}) {
  const res = await fetch(APP + path, {
    redirect: "manual",
    ...init,
    headers: { origin: APP, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers },
  });
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
  return res;
}
// Soumet un formulaire rendu côté serveur (server action, sans JS) identifié par un extrait de son HTML.
async function submit(path, marker, fields = {}) {
  const html = await (await http(path)).text();
  const form = html.match(/<form[\s\S]*?<\/form>/g).find((f) => f.includes(marker));
  assert.ok(form, `formulaire "${marker}" introuvable sur ${path}`);
  const fd = new FormData();
  for (const [, attrs] of form.matchAll(/<input([^>]*type="hidden"[^>]*)>/g)) {
    const name = attrs.match(/name="([^"]*)"/)?.[1];
    const value = attrs.match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) fd.append(name.replaceAll("&amp;", "&"), value.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
  }
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return http(path, { method: "POST", body: fd });
}
const page = async (path) => (await (await http(path)).text()).replaceAll("<!-- -->", "");
const waitIdle = async () => {
  for (let i = 0; i < 50 && (await page("/")).includes("Synchronisation en cours"); i++) await new Promise((r) => setTimeout(r, 200));
};

for (let i = 0; ; i++) {
  try {
    await fetch(APP + "/login");
    break;
  } catch {
    if (i > 50) throw new Error("app non démarrée");
    await new Promise((r) => setTimeout(r, 200));
  }
}

try {
  // Setup initial forcé + protection
  assert.match((await http("/")).headers.get("location"), /\/login$/);
  assert.match((await http("/login")).headers.get("location"), /\/setup$/);
  assert.equal((await http("/api/tidal/login")).status, 401);
  assert.match((await submit("/setup", "Créer le compte", { username: "admin", password: "short", confirm: "short" })).headers.get("location"), /error=/);
  const created = await submit("/setup", "Créer le compte", { username: "admin", password: "password123", confirm: "password123" });
  assert.match(created.headers.get("location"), /\/login\?created=1/);
  assert.match((await http("/setup")).headers.get("location"), /\/login$/); // setup verrouillé ensuite

  // Login next-auth
  const { csrfToken } = await (await http("/api/auth/csrf")).json();
  const bad = await http("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, username: "admin", password: "wrong" }),
  });
  assert.match(bad.headers.get("location"), /error=/);
  await http("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, username: "admin", password: "password123" }),
  });
  assert.match(await page("/"), /Non connecté/);

  // OAuth Tidal
  let auth = new URL((await http("/api/tidal/login")).headers.get("location"));
  assert.equal(auth.origin, "https://login.tidal.com");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert.equal(auth.searchParams.get("redirect_uri"), `${APP}/api/tidal/callback`);
  const bogus = await http(`/api/tidal/callback?code=x&state=wrong`);
  assert.match(bogus.headers.get("location"), /invalide/);
  auth = new URL((await http("/api/tidal/login")).headers.get("location")); // cookie supprimé par l'échec
  const cb = await http(`/api/tidal/callback?code=x&state=${auth.searchParams.get("state")}`);
  assert.match(cb.headers.get("location"), /tidal=ok/);
  assert.match(await page("/"), /Connecté \(utilisateur u1\)/);

  // Playlists (pagination) + création + mappings
  const pl = await page("/playlists");
  assert.ok(pl.includes(">Rock<") && pl.includes(">Jazz<"), "playlists des 2 pages affichées");
  await submit("/playlists", "Créer", { name: "Nouvelle" });
  assert.deepEqual(state.created, ["Nouvelle"]);
  await submit("/playlists", "p1", { genres: "Rock" });
  await submit("/playlists", "p2", { genres: "jazz, Blues" });
  const pl2 = await page("/playlists");
  assert.ok(pl2.includes("rock") && pl2.includes("blues"));
  // Autocomplétion : genres Tidal non encore mappés (rock/jazz le sont déjà)
  const options = JSON.parse(pl2.match(/\\"options\\":(\[[^\]]*\])/)[1].replaceAll('\\"', '"'));
  assert.deepEqual(options, ["hip-hop", "pop", "reggae"]);

  // Dry run : rien ne change sur Tidal
  await submit("/", "Dry run (simulation)");
  await waitIdle();
  let dash = await page("/");
  assert.match(dash, /\[DRY RUN\] Artist — Song One → « Rock » \(rock\)/);
  assert.match(dash, /\[DRY RUN\] Artist — Song Two → « Jazz » \(jazz\)/);
  assert.match(dash, /Song Three — aucun genre : reste en favori/);
  assert.match(dash, /Song Four — genre non mappé \(electro\) : reste en favori/);
  assert.match(dash, /Song Five — genre non mappé \(reggae\) : reste en favori/);
  assert.deepEqual(state.deezerIsrcs.sort(), ["ISRC-t3", "ISRC5"]); // Deezer seulement sans genre Tidal
  assert.deepEqual(state.added, {});
  assert.equal(state.favorites.length, 5);

  // Réel
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  assert.deepEqual(state.added, { p1: ["t1"], p2: ["t2"] });
  assert.deepEqual(state.favorites, ["t3", "t4", "t5"]);
  dash = await page("/");
  assert.match(dash, /Titres triés \(total\)[\s\S]*?>2</);

  // Genres détectés proposés au mapping
  assert.match(await page("/playlists"), /Genres détectés non mappés[\s\S]*electro[\s\S]*reggae/);
  assert.equal(state.deezerIsrcs.filter((i) => i === "ISRC5").length, 1); // cache : pas de 2e appel au 2e passage

  // Planification
  assert.match((await submit("/", "Enregistrer", { cronExpression: "pas un cron", cronEnabled: "on" })).headers.get("location") ?? "", /error=/);
  await submit("/", "Enregistrer", { cronExpression: "0 3 * * *", cronEnabled: "on" });
  dash = await page("/");
  assert.match(dash, /0 3 \* \* \* · réel/);
  assert.match(dash, /\d{2}\/\d{2}\/\d{4} 03:00:00/); // prochaine exécution à 3 h

  console.log("\n✅ e2e OK");
} finally {
  stop();
}
