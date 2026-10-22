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
const drops = { tracks: 1, deezer: 1 }; // coupures réseau simulées (socket fermée sans réponse)
const state = { favorites: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"], added: {}, manual: {}, created: [], deleted: [], deezerIsrcs: [], artworkCalls: 0 };
const createdId = (i) => `p${9 + i}`; // Nouvelle = p9, Indie / folk calme = p10, …

const fake = createServer(async (req, res) => {
  const url = new URL(req.url, FAKE);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const body = raw.toString();
  const json = (o) => res.writeHead(200, { "content-type": "application/vnd.api+json" }).end(JSON.stringify(o));
  const p = url.pathname;
  const ids = url.searchParams.getAll("filter[id]");
  const genreRes = (gs) => gs.map((id) => ({ id, type: "genres", attributes: { genreName: genres[id] } }));

  if ((p === "/v2/tracks" && drops.tracks-- > 0) || (p.startsWith("/deezer/track/") && drops.deezer-- > 0)) return req.socket.destroy();

  // Faux Deezer
  if (p.startsWith("/deezer/track/isrc:")) {
    const isrc = decodeURIComponent(p.split(":")[1]);
    state.deezerIsrcs.push(isrc);
    if (isrc === "ISRC6") return json({ id: 6, album: { id: 66 } });
    return json(isrc === "ISRC5" ? { id: 5, album: { id: 55 }, preview: "https://cdn.test/p5.mp3", link: "https://deezer.test/5" } : { error: { type: "DataException", code: 800 } });
  }
  if (p === "/deezer/album/66") return json({ id: 66, genres: { data: [{ id: 116, name: "Rap/Hip Hop" }, { id: 117, name: "Rap français" }] } });
  if (p === "/lastfm/") {
    assert.equal(url.searchParams.get("api_key"), "lfm");
    const method = url.searchParams.get("method");
    lastfmCalls.push(`${method}:${url.searchParams.get("track") ?? url.searchParams.get("artist")}`);
    if (method === "track.gettoptags") return json({ toptags: { tag: lastfmTracks[url.searchParams.get("track")] ?? [] } });
    if (method === "artist.gettoptags") return json({ toptags: { tag: { name: "Artist Tag", count: 100 } } }); // objet seul
    if (method === "tag.gettoptracks") return json({ tracks: { track: [{ name: "Hit", artist: { name: "Star" } }] } });
  }
  if (p === "/deezer/album/55") return json({ id: 55, genres: { data: [{ id: 2, name: "Reggae" }] } });
  if (p === "/deezer/search")
    return json({ data: url.searchParams.get("q").includes("Star") ? [{ id: 9, preview: "https://cdn.test/star.mp3", link: "https://deezer.test/9" }] : [] });
  if (p === "/deezer/genre") return json({ data: [{ id: 0, name: "All" }, { id: 1, name: "Pop" }, { id: 2, name: "Reggae" }] });

  if (p === "/token") return json({ access_token: "AT", refresh_token: "RT", expires_in: 3600 });
  if (p === "/v2/users/me") return json({ data: { id: "u1", type: "users", attributes: { country: "FR" } } });
  if (p === "/v2/playlists" && req.method === "GET") {
    assert.equal(url.searchParams.get("filter[owners.id]"), "u1");
    return url.searchParams.get("page[cursor]")
      ? json({
          data: [
            { id: "p2", type: "playlists", attributes: { name: "Jazz", numberOfTrackItems: 3 } },
            ...state.created
              .map((name, i) => ({ id: createdId(i), type: "playlists", attributes: { name, numberOfTrackItems: 0 } }))
              .filter((pl) => !state.deleted.includes(pl.id)),
          ],
          links: {},
        })
      : json({
          data: [{ id: "p1", type: "playlists", attributes: { name: "Rock", numberOfTrackItems: 5 } }],
          links: { next: "/playlists?filter[owners.id]=u1&page[cursor]=c2" },
        });
  }
  if (p === "/v2/playlists" && req.method === "POST") {
    state.created.push(JSON.parse(body).data.attributes.name);
    return json({ data: { id: createdId(state.created.length - 1), type: "playlists" } });
  }
  if (p === "/v2/userCollectionTracks/me/relationships/items" && req.method === "GET")
    return json({ data: state.favorites.map((id) => ({ id, type: "tracks" })), links: {} });
  if (p === "/v2/userCollectionTracks/me/relationships/items" && req.method === "POST") {
    for (const { id } of JSON.parse(body).data) if (!state.favorites.includes(id)) state.favorites.push(id);
    return json({ data: [] });
  }
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
  const one = p.match(/^\/v2\/tracks\/(\w+)$/);
  if (one)
    return json({
      data: { id: one[1], type: "tracks", attributes: { title: tracks[one[1]].title, isrc: tracks[one[1]].isrc ?? `ISRC-${one[1]}` } },
      included: [{ id: "ar1", type: "artists", attributes: { name: "Artist" } }],
    });
  // Pochettes : refusées aux accès tiers, comme le vrai Tidal. L'appli ne doit plus jamais essayer.
  if (p.startsWith("/v2/artworks")) {
    state.artworkCalls++;
    return res.writeHead(403).end(JSON.stringify({ errors: [{ code: "UNAUTHORIZED", detail: "Access tier is insufficient" }] }));
  }
  const del = p.match(/^\/v2\/playlists\/(\w+)$/);
  if (del && req.method === "DELETE") {
    state.deleted.push(del[1]);
    return res.writeHead(204).end();
  }
  if (p === "/v2/albums")
    return json({
      data: ids.map((id) => ({ id, type: "albums", relationships: { genres: { data: albums[id].map((g) => ({ id: g, type: "genres" })) } } })),
      included: genreRes(ids.flatMap((id) => albums[id])),
    });
  const m = p.match(/^\/v2\/playlists\/(\w+)\/relationships\/items$/);
  if (m && req.method === "GET")
    return json({
      data: [...(state.manual[m[1]] ?? []), ...(state.added[m[1]] ?? [])].map((id) => ({ id, type: "tracks", meta: { itemId: `${m[1]}:${id}` } })),
      links: {},
    });
  if (m && req.method === "DELETE") {
    for (const { id, meta } of JSON.parse(body).data) {
      assert.equal(meta.itemId, `${m[1]}:${id}`);
      state.added[m[1]] = (state.added[m[1]] ?? []).filter((x) => x !== id);
    }
    return res.writeHead(204).end();
  }
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
  HTTP_RETRY_DELAYS_MS: "50,50",
  NODE_PATH: "", // comme dans l'image Docker : pas de modules globaux (sharp doit venir de next)
  COVER_FONT_CDN: "", // pas de téléchargement de police en test : police par défaut de next/og
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
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) fd.append(k, x); // tableau : champ répété
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
  assert.match(await page("/"), />Connecté<[\s\S]*?Utilisateur [\s\S]*?u1</);

  // Playlists (pagination) + création + mappings
  const pl = await page("/playlists");
  assert.ok(pl.includes(">Rock<") && pl.includes(">Jazz<"), "playlists des 2 pages affichées");
  await submit("/playlists", "Créer", { name: "Nouvelle" });
  assert.deepEqual(state.created, ["Nouvelle"]);
  await submit("/playlists", "Ajouter des genres à Rock", { genres: "Rock" });
  await submit("/playlists", "Ajouter des genres à Jazz", { genres: "jazz, Blues" });
  await submit("/playlists", "Ajouter des genres à Rock", { genres: "Rap/Hip Hop" }); // générique : priorité auto 0
  await submit("/playlists", "Ajouter des genres à Jazz", { genres: "rap français" }); // spécifique : priorité auto 10
  await submit("/playlists", 'aria-label="Créer Indie / folk calme"'); // ambiance : crée la playlist p10 + tags
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
  assert.ok(drops.tracks < 0 && drops.deezer < 0, "coupures réseau simulées"); // et rattrapées : la synchro ci-dessus a abouti

  // Réel (t6 a été ajouté à la main dans « Jazz » entre-temps)
  state.manual.p2 = ["t6"];
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  assert.deepEqual(state.added, { p1: ["t1"], p2: ["t2"], p10: ["t8"] }); // doublon t7 non ajouté, t6 déjà dans p2
  assert.deepEqual(state.favorites, ["t3", "t4", "t5"]); // mais retirés des favoris
  dash = await page("/");
  assert.match(dash, /Song Six — déjà dans « Jazz » : non ré-ajouté, retiré des favoris/);
  assert.match(dash, /Titres triés<[\s\S]*?>5</);

  // Mode « conserver les favoris » + tous les favoris analysés
  await submit("/", "Enregistrer", { cronExpression: "0 * * * *", scanLimit: "0", pruneMismatched: "on" });
  assert.match(await page("/"), /Favoris conservés/);
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

  // Idées de playlists pour les favoris non classés (t3, t4, t5) : genre fréquent hors catalogue, puis catalogue
  assert.match(pl3, /Idées de playlists[\s\S]*?3 favoris attendent une playlist/);
  assert.match(pl3, /Artist Tag[\s\S]*?3 favoris/);
  assert.match(pl3, /Reggae \/ dancehall/);
  await submit("/playlists", "Tout créer");
  assert.deepEqual(state.created.slice(2), ["Artist Tag", "Électro chill", "Reggae / dancehall"]);
  const pl4 = await page("/playlists");
  assert.doesNotMatch(pl4, /Idées de playlists/); // tous leurs tags sont maintenant mappés
  assert.doesNotMatch(pl4.slice(pl4.indexOf("Genres détectés non mappés"), pl4.indexOf("Playlists d")), /artist tag/);

  // Rangement : « artist tag » (prio 10) bat désormais « rock » et « jazz » (génériques, prio 0) ; t1, retiré à la
  // main de Rock, n'est pas touché. Nouveaux favoris t3/t4 → Artist Tag (p11), t5 → Reggae (p13).
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  dash = await page("/");
  assert.match(dash, /Song Nine → « Artist Tag » via artist tag \(retiré de « Rock »\)/);
  assert.match(dash, /Song Two → « Artist Tag » via artist tag \(retiré de « Jazz »\)/);
  assert.deepEqual(state.added.p1, []);
  assert.deepEqual(state.added.p2, []);
  assert.deepEqual(state.added.p11.sort(), ["t2", "t3", "t4", "t9"]);
  assert.deepEqual(state.added.p13, ["t5"]);
  assert.deepEqual(state.added.p10, ["t8"]); // indie folk (prio 20) reste devant artist tag

  // Plus de « artist tag » ni de « jazz » : chacun retrouve sa playlist, ou sort et revient en favori.
  await submit("/playlists", "Ajouter des genres à Artist Tag", { genres: "garder géré" }); // Artist Tag reste gérée
  await submit("/playlists", 'aria-label="Retirer artist tag"');
  await submit("/playlists", 'aria-label="Retirer jazz"');
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  dash = await page("/");
  assert.match(dash, /Song Nine → « Rock » via rock \(retiré de « Artist Tag »\)/);
  assert.match(dash, /Song Four → « Électro chill » via electro \(retiré de « Artist Tag »\)/);
  assert.match(dash, /Song Three — retiré de « Artist Tag » : plus aucun genre mappé/);
  assert.match(dash, /Song Two — retiré de « Artist Tag » : plus aucun genre mappé, remis en favori/);
  assert.deepEqual(state.added.p11, []);
  assert.deepEqual(state.added.p1, ["t9"]);
  assert.ok(state.favorites.includes("t2") && state.favorites.filter((x) => x === "t3").length === 1);

  // Pochettes : générées pour les playlists gérées, téléchargeables (Tidal refuse l'envoi), jamais envoyées
  const pl5 = await page("/playlists");
  assert.match(pl5, /href="\/api\/cover\?name=Rock&amp;sub=[^"]*&amp;download=1"[^>]*>[\s\S]*?Télécharger la pochette/);
  const nouvelle = pl5.slice(pl5.indexOf(">Nouvelle</h3>"), pl5.indexOf("Ajouter des genres à Nouvelle"));
  assert.ok(nouvelle && !nouvelle.includes("Télécharger la pochette")); // Nouvelle : aucun genre, pas gérée
  const jpg = await http(`/api/cover?name=${encodeURIComponent("Électro chill")}&sub=electro&download=1`);
  assert.equal(jpg.headers.get("content-type"), "image/jpeg");
  assert.match(jpg.headers.get("content-disposition"), /attachment; filename="electro-chill\.jpg"/);
  const bytes = Buffer.from(await jpg.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  const thumbRes = await http(`/api/cover?name=Rock&w=64`);
  assert.equal(thumbRes.headers.get("content-type"), "image/png"); // vignette dessinée à sa taille, sans encodeur
  const thumb = Buffer.from(await thumbRes.arrayBuffer());
  assert.ok(thumb.length < bytes.length / 4, "vignette réduite");
  assert.equal(state.artworkCalls, 0);

  // « Ajouter à… » : les tags libres de l'ambiance Rap FR vont dans Jazz (p2), sans créer de playlist
  const createdBefore = state.created.length;
  await submit("/playlists", 'aria-label="Ajouter « Rap FR » à une playlist existante"', { playlistId: "p2" });
  assert.equal(state.created.length, createdBefore);
  const pl6 = await page("/playlists");
  const jazzCard = pl6.slice(pl6.indexOf(">Jazz</h3>"), pl6.indexOf("Ajouter des genres à Jazz"));
  assert.ok(jazzCard.includes('aria-label="Retirer french rap"') && jazzCard.includes('aria-label="Retirer rap français"'));

  // Fusion : Électro chill (p12) et Reggae (p13) dans Rock (p1), sources supprimées
  assert.deepEqual([state.added.p1, state.added.p12, state.added.p13], [["t9"], ["t4"], ["t5"]]);
  const MERGE = 'aria-label="Fusionner des playlists"';
  const invalid = await submit("/playlists", MERGE, { source: "p1", target: "p1" }); // source = cible
  assert.match(decodeURIComponent(invalid.headers.get("location") ?? ""), /error=Fusion : choisissez/);
  const merged = await submit("/playlists", MERGE, { source: ["p12", "p13"], target: "p1", deleteSources: "on" });
  assert.match(decodeURIComponent(merged.headers.get("location") ?? ""), /notice=2 playlists fusionnées dans « Rock » : 2 titres ajoutés, sources supprimées/);
  assert.deepEqual(state.added.p1, ["t9", "t4", "t5"]);
  assert.deepEqual(state.deleted, ["p12", "p13"]);
  const pl7 = await page("/playlists");
  assert.ok(!pl7.includes(">Électro chill</h3>") && !pl7.includes(">Reggae / dancehall</h3>"));
  const rockCard = pl7.slice(pl7.indexOf(">Rock</h3>"), pl7.indexOf("Ajouter des genres à Rock"));
  assert.ok(rockCard.includes('aria-label="Retirer electro"') && rockCard.includes('aria-label="Retirer reggae"'), "genres transférés");
  // Le suivi a suivi : la synchro suivante ne déplace ni ne retire t4/t5
  await submit("/", "Synchronisation réelle");
  await waitIdle();
  assert.doesNotMatch(await page("/"), /Song (Four|Five) (→|—)/);
  assert.deepEqual(state.added.p1, ["t9", "t4", "t5"]);

  // Exemples à écouter : d'abord vos titres portant le genre, puis des titres connus (Last.fm + extrait Deezer)
  const ex = (await (await http("/api/examples?tag=Reggae")).json()).examples;
  assert.deepEqual(ex.map((e) => [e.trackId ?? null, e.mine, e.preview?.url ?? null]), [["t5", true, null], [null, false, "https://cdn.test/star.mp3"]]);
  assert.equal(ex[1].label, "Star — Hit");
  assert.match(await page("/playlists"), /Écouter des exemples/);

  // Extraits audio des logs
  assert.match(dash, /aria-label="Écouter un extrait \(30 s\)"/);
  assert.deepEqual(await (await http("/api/preview/t5")).json(), { url: "https://cdn.test/p5.mp3", link: "https://deezer.test/5" });
  assert.equal((await http("/api/preview/t3")).status, 404); // ni ISRC ni recherche Deezer

  // Planification
  assert.match((await submit("/", "Enregistrer", { cronExpression: "pas un cron", cronEnabled: "on" })).headers.get("location") ?? "", /error=/);
  await submit("/", "Enregistrer", { cronExpression: "0 3 * * *", cronEnabled: "on" });
  dash = await page("/");
  assert.match(dash, />0 3 \* \* \*<[\s\S]*?>Réel</);
  assert.match(dash, /, 03:00</); // prochaine exécution à 3 h

  console.log("\n✅ e2e OK");
} finally {
  stop();
}
