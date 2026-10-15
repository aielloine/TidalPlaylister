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
const genres = { g1: "Rock", g2: "Jazz", g3: "Electro", g5: "Pop", g6: "Funk", g7: "Musiques de films" };
const tracks = {
  t1: { title: "Song One", genres: ["g1"], album: "a1" }, // genre piste -> rock
  t2: { title: "Song Two", genres: [], album: "a2" }, // genre album -> jazz
  t3: { title: "Song Three", genres: [], album: "a3" }, // aucun genre
  t4: { title: "Song Four", genres: ["g3"], album: "a1" }, // electro, non mappé
  t5: { title: "Song Five", genres: [], album: "a3", isrc: "ISRC5" }, // rien chez Tidal -> Deezer : reggae
  t6: { title: "Song Six", genres: [], album: "a4", isrc: "ISRC6" }, // album compilation (5 genres) -> Deezer : rap
  t7: { title: "Song One (Radio Edit)", genres: ["g1"], album: "a1", isrc: "ISRC7" }, // doublon de t1 (artiste + titre)
  t8: { title: "Song Eight", genres: ["g7"], album: "a1" }, // genre ignoré -> Last.fm : indie folk
  t9: { title: "Song Nine", genres: ["g1"], album: "a1" }, // liké plus tard, en mode « conserver »
};
const albums = { a1: [], a2: ["g2"], a3: [], a4: ["g1", "g2", "g3", "g5", "g6"] };
// Faux Last.fm : tags par titre ; l'artiste n'a qu'un tag non mappé (complète les titres avec < 3 tags).
const lastfmTracks = {
  "Song Eight": [{ name: "Indie Folk", count: 100 }, { name: "seen live", count: 90 }, { name: "mellow", count: 10 }],
};
const lastfmCalls = [];
const state = { favorites: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"], added: {}, manual: {}, created: [], deezerIsrcs: [] };

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
    if (isrc === "ISRC6") return json({ id: 6, album: { id: 66 } });
    return json(isrc === "ISRC5" ? { id: 5, album: { id: 55 } } : { error: { type: "DataException", code: 800 } });
  }
  if (p === "/deezer/album/66") return json({ id: 66, genres: { data: [{ id: 116, name: "Rap/Hip Hop" }, { id: 117, name: "Rap français" }] } });
  if (p === "/lastfm/") {
    assert.equal(url.searchParams.get("api_key"), "lfm");
    const method = url.searchParams.get("method");
    lastfmCalls.push(`${method}:${url.searchParams.get("track") ?? url.searchParams.get("artist")}`);
    if (method === "track.gettoptags") return json({ toptags: { tag: lastfmTracks[url.searchParams.get("track")] ?? [] } });
    if (method === "artist.gettoptags") return json({ toptags: { tag: { name: "Artist Tag", count: 100 } } }); // objet seul
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
  if (m && req.method === "GET")
    return json({ data: [...(state.manual[m[1]] ?? []), ...(state.added[m[1]] ?? [])].map((id) => ({ id, type: "tracks" })), links: {} });
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
  LASTFM_API_URL: `${FAKE}/lastfm/`,
  LASTFM_API_KEY: "lfm",
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
  await submit("/playlists", "p1", { genres: "Rap/Hip Hop" }); // générique : priorité auto 0
  await submit("/playlists", "p2", { genres: "rap français" }); // spécifique : priorité auto 10
  await submit("/playlists", "Indie / folk calme"); // ambiance : crée la playlist p9 + tags
  assert.deepEqual(state.created, ["Nouvelle", "Indie / folk calme"]);
  const pl2 = await page("/playlists");
  assert.ok(pl2.includes("rock") && pl2.includes("blues"));
  // Autocomplétion : genres Tidal non encore mappés (rock/jazz le sont déjà)
  const options = JSON.parse(pl2.match(/\\"options\\":(\[[^\]]*\])/)[1].replaceAll('\\"', '"'));
  assert.deepEqual(options, ["hip-hop", "pop", "reggae"]);

  // Dry run : rien ne change sur Tidal
  await submit("/", "Dry run (simulation)");
  await waitIdle();
  let dash = await page("/");
  assert.match(dash, /Last\.fm actif/);
  assert.match(dash, /\[DRY RUN\] Artist — Song One → « Rock » via rock \(artist tag\)/);
  assert.match(dash, /\[DRY RUN\] Artist — Song One \(Radio Edit\) — doublon de t1 : retiré des favoris/);
  assert.match(dash, /\[DRY RUN\] Artist — Song Two → « Jazz » via jazz/);
  assert.match(dash, /Song Three — genre non mappé \(artist tag\) : reste en favori/);
  assert.match(dash, /Song Four — genre non mappé \(artist tag, electro\) : reste en favori/);
  assert.match(dash, /Song Five — genre non mappé \(artist tag, reggae\) : reste en favori/);
  // Compilation Tidal ignorée -> Deezer ; « rap français » (prio 10) bat « rap/hip hop » (prio 0)
  assert.match(dash, /Song Six → « Jazz » via rap français \(artist tag, rap\/hip hop\)/);
  // « musiques de films » et « seen live » ignorés, « mellow » sous le seuil -> indie folk (mappé par l'ambiance)
  assert.match(dash, /Song Eight → « Indie \/ folk calme » via indie folk \(artist tag\)/);
  assert.deepEqual(state.deezerIsrcs.sort(), ["ISRC-t3", "ISRC-t8", "ISRC5", "ISRC6"]); // Deezer seulement sans genre Tidal exploitable
  assert.ok(lastfmCalls.includes("track.gettoptags:Song Eight") && lastfmCalls.includes("artist.gettoptags:Artist"));
  assert.equal(lastfmCalls.filter((c) => c === "artist.gettoptags:Artist").length, 1); // cache artiste
  assert.deepEqual(state.added, {});
  assert.equal(state.favorites.length, 8);

  // Réel (t6 a été ajouté à la main dans « Jazz » entre-temps)
  state.manual.p2 = ["t6"];
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  assert.deepEqual(state.added, { p1: ["t1"], p2: ["t2"], p9: ["t8"] }); // doublon t7 non ajouté, t6 déjà dans p2
  assert.deepEqual(state.favorites, ["t3", "t4", "t5"]); // mais retirés des favoris
  dash = await page("/");
  assert.match(dash, /Song Six — déjà dans « Jazz » : non ré-ajouté, retiré des favoris/);
  assert.match(dash, /Titres triés \(total\)[\s\S]*?>5</);

  // Mode « conserver les favoris » + tous les favoris analysés
  await submit("/", "Enregistrer", { cronExpression: "0 * * * *", scanLimit: "0" });
  assert.match(await page("/"), /favoris conservés/);
  state.added.p1 = []; // t1 retiré de la playlist à la main…
  state.favorites = ["t9", "t1", ...state.favorites, "t9"]; // … puis re-liké ; t9 est un nouveau like (renvoyé 2 fois par Tidal)
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  dash = await page("/");
  assert.match(dash, /analysé\(s\) \(tous\)/);
  assert.match(dash, /1 titre\(s\) déjà classé\(s\) : non ré-ajouté\(s\)</);
  assert.match(dash, /Song Nine → « Rock » via rock \(artist tag\) \(reste en favori\)/);
  assert.deepEqual(state.added.p1, ["t9"]); // t1 ne revient pas
  assert.deepEqual(state.favorites, ["t9", "t1", "t3", "t4", "t5", "t9"]); // rien n'est retiré des favoris
  assert.doesNotMatch(dash, /Échec/);
  await submit("/", "Synchronisation réelle"); // 2e passage : rien de nouveau
  await waitIdle();
  assert.deepEqual(state.added.p1, ["t9"]);
  assert.match(await page("/"), /2 titre\(s\) déjà classé\(s\)/);

  // Genres détectés proposés au mapping
  const pl3 = await page("/playlists");
  assert.match(pl3, /Genres détectés non mappés[\s\S]*electro[\s\S]*reggae/);
  const unmappedCard = pl3.slice(pl3.indexOf("Genres détectés non mappés"), pl3.indexOf("Playlists d"));
  assert.ok(unmappedCard.includes("artist tag") && !unmappedCard.includes("musiques de films"), "genres ignorés masqués");
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
