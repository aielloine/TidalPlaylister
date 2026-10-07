import { Alert, Button, Card, CardContent, Chip, TextField, Typography } from "@mui/material";
import { addMapping, createPlaylist, deleteMapping } from "@/app/actions";
import { prisma } from "@/lib/db";
import { getPlaylists, type Playlist } from "@/lib/tidal";

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
  try {
    playlists = await getPlaylists();
  } catch (e) {
    error = (e as Error).message;
  }
  // Rafraîchit le nom en cache des mappings si la playlist a été renommée sur Tidal.
  for (const p of playlists)
    await prisma.mapping.updateMany({ where: { playlistId: p.id, NOT: { playlistName: p.name } }, data: { playlistName: p.name } });

  const [mappings, genres] = await Promise.all([
    prisma.mapping.findMany({ orderBy: { genre: "asc" } }),
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
  ]);
  const mapped = new Set(mappings.map((m) => m.genre));
  const known = new Set(playlists.map((p) => p.id));
  const orphans = error ? [] : mappings.filter((m) => !known.has(m.playlistId));
  const unmapped = genres.filter((g) => !mapped.has(g.name));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      {error && <Alert severity="error">Lecture des playlists impossible : {error}</Alert>}

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

      <datalist id="genres">
        {unmapped.map((g) => (
          <option key={g.name} value={g.name} />
        ))}
      </datalist>

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
                <div className="flex min-h-8 flex-wrap gap-1">
                  {own.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Aucun genre associé
                    </Typography>
                  )}
                  {own.map((m) => (
                    <form key={m.id} action={deleteMapping.bind(null, m.id)}>
                      <Chip label={`${m.genre}  ✕`} color="primary" size="small" component="button" type="submit" clickable />
                    </form>
                  ))}
                </div>
                <form action={addMapping.bind(null, p.id, p.name)} className="mt-auto flex gap-2">
                  <TextField
                    name="genres"
                    label="Ajouter genre(s), séparés par des virgules"
                    size="small"
                    required
                    className="flex-1"
                    slotProps={{ htmlInput: { list: "genres" } }}
                  />
                  <Button type="submit" variant="outlined">
                    +
                  </Button>
                </form>
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
