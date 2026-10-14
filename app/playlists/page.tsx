import { Alert, Button, Card, CardContent, Chip, TextField, Typography } from "@mui/material";
import { addMapping, applyMood, createPlaylist, deleteMapping, saveIgnoredGenres, setMappingPriority } from "@/app/actions";
import { getSettings, prisma } from "@/lib/db";
import { parseList } from "@/lib/genres";
import { lastfmEnabled } from "@/lib/lastfm";
import { MOODS } from "@/lib/moods";
import GenrePicker from "@/components/GenrePicker";
import { deezerGenreList } from "@/lib/deezer";
import { getPlaylists, getTidalGenres, type Playlist } from "@/lib/tidal";

export const dynamic = "force-dynamic";

export default async function Playlists() {
  if (!(await prisma.tidalToken.count()))
    return (
      <main className="mx-auto max-w-6xl p-4">
        <Alert severity="warning">Connectez d&apos;abord votre compte Tidal depuis le dashboard.</Alert>
      </main>
    );

  let playlists: Playlist[] = [];
  let error = "";
  const [pl, tidalGenres, deezer] = await Promise.allSettled([getPlaylists(), getTidalGenres(), deezerGenreList()]);
  if (pl.status === "fulfilled") playlists = pl.value;
  else error = (pl.reason as Error).message;
  // Rafraîchit le nom en cache des mappings si la playlist a été renommée sur Tidal.
  for (const p of playlists)
    await prisma.mapping.updateMany({ where: { playlistId: p.id, NOT: { playlistName: p.name } }, data: { playlistName: p.name } });

  const [mappings, genres, settings] = await Promise.all([
    prisma.mapping.findMany({ orderBy: [{ priority: "desc" }, { genre: "asc" }] }),
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  const ignored = new Set(parseList(settings.ignoredGenres));
  const mapped = new Set(mappings.map((m) => m.genre));
  const known = new Set(playlists.map((p) => p.id));
  const orphans = error ? [] : mappings.filter((m) => !known.has(m.playlistId));
  const unmapped = genres.filter((g) => !mapped.has(g.name) && !ignored.has(g.name));
  // Autocomplétion : genres Tidal + Deezer + rencontrés sur vos titres, hors genres déjà mappés.
  const ok = (r: PromiseSettledResult<string[]>) => (r.status === "fulfilled" ? r.value : []);
  const options = [...new Set([...ok(tidalGenres), ...ok(deezer), ...genres.map((g) => g.name)])]
    .filter((g) => !mapped.has(g) && !ignored.has(g))
    .sort();
  const playlistNames = new Set(playlists.map((p) => p.name.toLowerCase()));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      {error && <Alert severity="error">Lecture des playlists impossible : {error}</Alert>}
      {!ok(tidalGenres).length && !ok(deezer).length && (
        <Alert severity="warning">
          Listes de genres Tidal et Deezer indisponibles
          {deezer.status === "rejected" && ` (Deezer : ${(deezer.reason as Error).message})`}.
        </Alert>
      )}
      {!lastfmEnabled() && (
        <Alert severity="info">
          Tags Last.fm désactivés : renseignez LASTFM_API_KEY (clé gratuite sur last.fm/api/account/create) pour des
          genres et ambiances bien plus fins que Tidal/Deezer.
        </Alert>
      )}
      {!genres.length && (
        <Alert severity="info">
          Lancez un Dry Run depuis le dashboard : les genres de vos favoris seront ajoutés aux suggestions.
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <Typography variant="overline" className="md:w-56">
            Nouvelle playlist Tidal
          </Typography>
          <form action={createPlaylist} className="flex flex-1 gap-2">
            <TextField name="name" label="Nom" size="small" required className="flex-1" />
            <Button type="submit" variant="contained">
              Créer
            </Button>
          </form>
        </CardContent>
      </Card>

      {unmapped.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="overline">Genres détectés non mappés</Typography>
            <div className="mt-2 flex flex-wrap gap-1">
              {unmapped.map((g) => (
                <Chip key={g.name} label={g.name} size="small" variant="outlined" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <Typography variant="overline">Playlists d&apos;ambiance</Typography>
            <Typography variant="body2" color="text.secondary">
              Crée la playlist (ou réutilise celle du même nom) et y mappe les tags encore libres. Le plus prioritaire
              gagne quand un titre en a plusieurs.
            </Typography>
            {MOODS.map((mood, i) => (
              <form key={mood.name} action={applyMood.bind(null, i)} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Typography variant="body2">
                    {mood.name} <span className="opacity-60">· prio {mood.priority}</span>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" className="block truncate">
                    {[...mood.tags, ...(mood.generic ?? [])].join(", ")}
                  </Typography>
                </div>
                <Button type="submit" size="small" variant="outlined">
                  {playlistNames.has(mood.name.toLowerCase()) ? "Compléter" : "Créer"}
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <Typography variant="overline">Genres ignorés</Typography>
            <Typography variant="body2" color="text.secondary">
              Jamais utilisés pour classer un titre. Une source Tidal/Deezer avec plus de 4 genres est traitée comme une
              compilation : on passe au repli suivant.
            </Typography>
            <form action={saveIgnoredGenres} className="flex items-start gap-2">
              <TextField
                name="ignoredGenres"
                defaultValue={parseList(settings.ignoredGenres).join(", ")}
                size="small"
                multiline
                className="flex-1"
                helperText="Séparés par des virgules"
              />
              <Button type="submit" variant="outlined">
                Enregistrer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {playlists.map((p) => {
          const own = mappings.filter((m) => m.playlistId === p.id);
          return (
            <Card key={p.id}>
              <CardContent className="flex h-full flex-col gap-3">
                <div>
                  <Typography variant="h6">{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.tracks} titre(s)
                  </Typography>
                </div>
                <div className="flex min-h-8 flex-col gap-1">
                  {own.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Aucun genre associé
                    </Typography>
                  )}
                  {own.map((m) => (
                    <div key={m.id} className="flex items-center gap-1">
                      {/* Entrée pour enregistrer la priorité */}
                      <form action={setMappingPriority.bind(null, m.id)}>
                        <input
                          name="priority"
                          type="number"
                          defaultValue={m.priority}
                          title="Priorité (la plus haute gagne)"
                          className="w-12 rounded border border-white/20 bg-transparent px-1 text-right text-xs"
                        />
                      </form>
                      <form action={deleteMapping.bind(null, m.id)}>
                        <Chip label={`${m.genre}  ✕`} color="primary" size="small" component="button" type="submit" clickable />
                      </form>
                    </div>
                  ))}
                </div>
                <GenrePicker action={addMapping.bind(null, p.id, p.name)} options={options} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {orphans.length > 0 && (
        <Alert severity="warning">
          Mappings vers des playlists introuvables (supprimées ?) :{" "}
          {orphans.map((m) => (
            <form key={m.id} action={deleteMapping.bind(null, m.id)} className="inline">
              <Chip label={`${m.genre} → ${m.playlistName}  ✕`} size="small" component="button" type="submit" clickable className="m-0.5" />
            </form>
          ))}
        </Alert>
      )}
    </main>
  );
}
