import { Alert, Button, Card } from "@mui/material";
import {
  addMapping,
  applyIdeaTo,
  applyMood,
  applySuggestion,
  applySuggestions,
  assignGenre,
  createPlaylist,
  deleteMapping,
  ignoreGenre,
  mergePlaylists,
  saveIgnoredGenres,
  setMappingPriority,
} from "@/app/actions";
import AddToPlaylist from "@/components/AddToPlaylist";
import GenrePicker from "@/components/GenrePicker";
import IgnoredGenres from "@/components/IgnoredGenres";
import MappingChip from "@/components/MappingChip";
import UnmappedGenres from "@/components/UnmappedGenres";
import { Cover, coverSrc, Icon, Mono, PlainCover, SectionTitle } from "@/components/ui";
import { getSettings, prisma } from "@/lib/db";
import { deezerGenreList } from "@/lib/deezer";
import { parseList } from "@/lib/genres";
import { coverSub } from "@/lib/coverImage";
import { lastfmEnabled } from "@/lib/lastfm";
import { MOODS, moodTags } from "@/lib/moods";
import { moodCounts, suggestPlaylists, type Suggestion } from "@/lib/suggestions";
import { getPlaylists, getTidalGenres, type Playlist } from "@/lib/tidal";

export const dynamic = "force-dynamic";

const TOP_SUGGESTIONS = 6;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

function Header({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-2">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5">
        <h1 className="m-0 font-display text-[clamp(28px,2.8vw,36px)] font-bold leading-[1.1] tracking-[-0.02em]">Playlists &amp; mappings</h1>
        <p className="m-0 text-[14.5px] text-dim">
          Chaque genre ou tag pointe vers une playlist. Quand un titre en a plusieurs, la priorité la plus haute gagne.
        </p>
      </div>
      {children}
    </div>
  );
}

const LastfmNote = () => (
  <Alert severity="info" icon={<Icon name="info" strokeWidth={2} className="text-lilac-soft" />}>
    Tags Last.fm désactivés : renseignez <code className="rounded-md bg-night/50 px-1.5 font-mono text-[13px]">LASTFM_API_KEY</code> (clé gratuite sur
    last.fm/api/account/create) pour des genres et ambiances bien plus fins que Tidal/Deezer.
  </Alert>
);

export default async function Playlists({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error: actionError, notice } = await searchParams;
  if (!(await prisma.tidalToken.count()))
    return (
      <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-[clamp(16px,3vw,32px)] pb-16 pt-7">
        <Header />
        <section
          aria-labelledby="pv-title"
          className="flex flex-col items-center gap-6 rounded-3xl border border-[#232831] px-[clamp(20px,4vw,48px)] py-[72px] text-center"
          style={{ background: "radial-gradient(520px 260px at 50% 0%, rgba(46,230,214,0.08), transparent 70%), #13161b" }}
        >
          <div aria-hidden="true" className="relative h-[130px] w-[220px]">
            <span className="absolute left-1.5 top-[22px] size-24 -rotate-10 rounded-[14px] border border-[#2a303a] bg-[#1b1f26]" />
            <span className="absolute right-1.5 top-[22px] size-24 rotate-10 rounded-[14px] border border-[#2a303a] bg-[#1b1f26]" />
            <span className="absolute left-[58px] top-1.5">
              <Cover name="Électro chill" size={104} />
            </span>
          </div>
          <div className="flex max-w-[520px] flex-col gap-2">
            <h2 id="pv-title" className="m-0 font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">
              Connectez d&apos;abord votre compte Tidal
            </h2>
            <p className="m-0 text-[15px] text-dim">Vos playlists, leurs genres et des idées de playlists prêtes à l&apos;emploi apparaîtront ici.</p>
          </div>
          <a
            href="/api/tidal/login"
            className="inline-flex h-[52px] items-center gap-2.5 rounded-full bg-aqua px-7 text-[15.5px] font-semibold text-aqua-ink no-underline shadow-[0_10px_30px_-12px_rgba(46,230,214,0.7)] hover:bg-[#7ff3e8]"
          >
            <Icon name="note" strokeWidth={2} />
            Se connecter à Tidal
          </a>
        </section>
        {!lastfmEnabled() && <LastfmNote />}
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

  const [mappings, genres, settings, unsortedRows] = await Promise.all([
    prisma.mapping.findMany({ orderBy: [{ priority: "desc" }, { genre: "asc" }] }),
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    getSettings(),
    prisma.unsortedTrack.findMany(),
  ]);
  const ignoredList = parseList(settings.ignoredGenres);
  const ignored = new Set(ignoredList);
  const mapped = new Set(mappings.map((m) => m.genre));
  const known = new Set(playlists.map((p) => p.id));
  const orphans = error ? [] : mappings.filter((m) => !known.has(m.playlistId));
  const playlistNames = new Set(playlists.map((p) => p.name.toLowerCase()));
  const targets = playlists.map((p) => ({ id: p.id, name: p.name })); // « Ajouter à… »
  // Sous-titre de pochette d'une ambiance : ses tags libres ou déjà mappés vers elle (même ordre qu'à la création).
  const mappedTo = new Map(mappings.map((m) => [m.genre, m.playlistName.toLowerCase()]));
  const moodSub = (m: (typeof MOODS)[number]) =>
    moodTags(m)
      .map(([t]) => t)
      .filter((t) => (mappedTo.get(t) ?? m.name.toLowerCase()) === m.name.toLowerCase())
      .slice(0, 3)
      .join(" · ");

  // Favoris non classés au dernier passage : comptes par genre + idées de playlists.
  const unsorted = unsortedRows.map((u) => ({ label: u.label, genres: JSON.parse(u.genres) as string[] }));
  const hits = new Map<string, number>();
  for (const u of unsorted) for (const g of u.genres) hits.set(g, (hits.get(g) ?? 0) + 1);
  const unmapped = genres
    .filter((g) => !mapped.has(g.name) && !ignored.has(g.name))
    .map((g) => ({ name: g.name, count: hits.get(g.name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const suggestions = suggestPlaylists(unsorted, mapped, ignored, playlistNames);
  const top = suggestions.slice(0, TOP_SUGGESTIONS);
  const perMood = moodCounts(suggestions);
  const catalog = MOODS.map((m, i) => ({ m, i, count: perMood.get(i) ?? 0 })).sort((a, b) => b.count - a.count || a.i - b.i);

  // Autocomplétion : genres Tidal + Deezer + rencontrés sur vos titres, hors genres déjà mappés.
  const ok = (r: PromiseSettledResult<string[]>) => (r.status === "fulfilled" ? r.value : []);
  const options = [...new Set([...ok(tidalGenres), ...ok(deezer), ...genres.map((g) => g.name)])]
    .filter((g) => !mapped.has(g) && !ignored.has(g))
    .sort();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-[clamp(16px,3vw,32px)] pb-16 pt-7">
      <Header>
        <form action={createPlaylist} className="flex max-w-[480px] flex-[1_1_360px] gap-2">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#2a303a] bg-hollow px-3.5 focus-within:border-aqua">
            <Icon name="plus" size={16} strokeWidth={2} className="text-muted" />
            <span className="sr-only">Nom de la nouvelle playlist Tidal</span>
            <input
              name="name"
              required
              placeholder="Nouvelle playlist Tidal…"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-faint"
            />
          </label>
          <Button type="submit" variant="contained" sx={{ minHeight: 48, boxShadow: "none" }}>
            Créer
          </Button>
        </form>
      </Header>

      {actionError && <Alert severity="error">{actionError}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">Lecture des playlists impossible : {error}</Alert>}
      {!ok(tidalGenres).length && !ok(deezer).length && (
        <Alert severity="warning">
          Listes de genres Tidal et Deezer indisponibles
          {deezer.status === "rejected" && ` (Deezer : ${(deezer.reason as Error).message})`}.
        </Alert>
      )}
      {!lastfmEnabled() && <LastfmNote />}
      {!genres.length && (
        <Alert severity="info" icon={<Icon name="info" strokeWidth={2} className="text-lilac-soft" />}>
          Lancez un dry run depuis le dashboard : les genres de vos favoris remonteront ici, avec des idées de playlists pour les ranger.
        </Alert>
      )}

      {top.length > 0 && <Suggestions top={top} rest={suggestions.slice(TOP_SUGGESTIONS)} unsortedCount={unsorted.length} targets={targets} />}

      {unmapped.length > 0 && (
        <Card component="section" aria-labelledby="unmapped-title" className="flex flex-col gap-3.5 p-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2.5">
              <SectionTitle id="unmapped-title">Genres détectés non mappés</SectionTitle>
              <span className="inline-flex h-6 items-center rounded-full bg-amber/13 px-2.5 font-mono text-[12.5px] font-semibold text-amber">{unmapped.length}</span>
            </div>
            <span className="text-[13px] text-muted">Rencontrés pendant les synchros. Cliquez sur un genre pour l&apos;associer à une playlist.</span>
          </div>
          <UnmappedGenres
            genres={unmapped}
            playlists={playlists.map((p) => {
              const own = mappings.filter((m) => m.playlistId === p.id);
              return { ...p, sub: own.length ? coverSub(own) : null };
            })}
            assign={assignGenre}
            ignore={ignoreGenre}
          />
        </Card>
      )}

      <div className="flex flex-wrap items-stretch gap-4">
        <Card component="section" aria-labelledby="moods-title" className="flex min-w-0 flex-[3_1_520px] flex-col gap-3.5 p-[22px]">
          <div className="flex flex-col gap-1">
            <SectionTitle id="moods-title">Playlists d&apos;ambiance</SectionTitle>
            <p className="m-0 text-[13.5px] text-muted">
              Un clic crée la playlist (ou réutilise celle du même nom) et y mappe les tags encore libres. « Ajouter à… » les met plutôt dans une
              playlist existante.
            </p>
          </div>
          <ul className="tp-scroll m-0 flex max-h-[560px] list-none flex-col gap-1 overflow-auto p-0">
            {catalog.map(({ m, i, count }) => {
              const exists = playlistNames.has(m.name.toLowerCase());
              return (
                <li key={m.name}>
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] bg-raised p-2.5">
                    <Cover name={m.name} sub={moodSub(m)} size={52} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold">{m.name}</span>
                        <span className="inline-flex h-5 items-center rounded-md border border-line bg-hollow px-1.5 font-mono text-[11px] text-dim">prio {m.priority}</span>
                        {exists && <span className="text-xs text-[#6ee7a0]">· existe déjà</span>}
                        {count > 0 && <span className="text-xs font-semibold text-amber">· {plural(count, "favori")} à ranger</span>}
                      </div>
                      <span className="truncate text-[12.5px] text-muted">{moodTags(m).map(([t]) => t).join(", ")}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <form action={applyMood.bind(null, i)} aria-label={`${exists ? "Compléter" : "Créer"} ${m.name}`}>
                        <Button type="submit" size="small" variant={exists ? "outlined" : "contained"} color={exists ? "inherit" : "primary"} sx={{ boxShadow: "none" }}>
                          {exists ? "Compléter" : "Créer"}
                        </Button>
                      </form>
                      <AddToPlaylist action={applyIdeaTo.bind(null, `mood:${i}`)} playlists={targets} label={`Ajouter « ${m.name} » à une playlist existante`} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card component="section" aria-labelledby="ignored-title" className="flex min-w-0 flex-[2_1_360px] flex-col gap-3.5 p-[22px]">
          <div className="flex flex-col gap-1">
            <SectionTitle id="ignored-title">Genres ignorés</SectionTitle>
            <p className="m-0 text-[13.5px] text-muted">
              Jamais utilisés pour classer un titre. Une source Tidal/Deezer avec plus de 4 genres est traitée comme une compilation : on passe au repli
              suivant.
            </p>
          </div>
          <IgnoredGenres action={saveIgnoredGenres} initial={ignoredList} />
        </Card>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">
          Mes playlists Tidal <span className="font-medium text-faint">· {playlists.length}</span>
        </h2>
        <span className="text-[13px] text-muted">Priorité : cliquez sur le nombre pour la modifier</span>
      </div>

      {playlists.length > 1 && (
        <MergeForm
          playlists={playlists.map((p) => {
            const own = mappings.filter((m) => m.playlistId === p.id);
            return { ...p, sub: own.length ? coverSub(own) : null };
          })}
        />
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-4">
        {playlists.map((p) => {
          const own = mappings.filter((m) => m.playlistId === p.id);
          const sub = coverSub(own);
          return (
            <Card component="article" key={p.id} className="flex flex-col gap-4 p-[18px]">
              <div className="flex items-center gap-3.5">
                {own.length ? <Cover name={p.name} sub={sub} size={84} /> : <PlainCover size={84} />}
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="m-0 font-display text-xl font-semibold leading-[1.15] tracking-tight">{p.name}</h3>
                  <span className="text-[13px] text-muted">
                    {plural(p.tracks, "titre")} · {own.length ? plural(own.length, "genre") : "aucun genre"}
                  </span>
                  {own.length > 0 && (
                    <a
                      href={`${coverSrc(p.name, sub)}&download=1`}
                      download
                      title="Tidal ne permet pas aux applis tierces d'envoyer une pochette : téléchargez-la puis ajoutez-la à la playlist depuis l'appli Tidal."
                      className="inline-flex items-center gap-1 self-start text-xs font-semibold text-lilac-soft no-underline hover:text-ink"
                    >
                      <Icon name="download" size={13} strokeWidth={2} />
                      Télécharger la pochette
                    </a>
                  )}
                </div>
              </div>
              {own.length ? (
                <ul aria-label="Genres mappés" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {own.map((m) => (
                    <MappingChip
                      key={m.id}
                      genre={m.genre}
                      priority={m.priority}
                      setPriority={setMappingPriority.bind(null, m.id)}
                      remove={deleteMapping.bind(null, m.id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="m-0 rounded-xl border border-dashed border-[#2f3540] p-3.5 text-center text-[13.5px] text-muted">
                  Aucun genre associé : rien ne sera classé ici.
                </p>
              )}
              <GenrePicker action={addMapping.bind(null, p.id, p.name)} options={options} label={`Ajouter des genres à ${p.name}`} />
            </Card>
          );
        })}
      </div>

      {orphans.length > 0 && (
        <Alert severity="warning">
          <span className="mr-2">Mappings vers des playlists introuvables (supprimées ?) :</span>
          {orphans.map((m) => (
            <form key={m.id} action={deleteMapping.bind(null, m.id)} className="m-0.5 inline-flex">
              <span className="inline-flex h-8 items-center gap-0.5 rounded-full bg-tag pl-3 pr-1 text-[13px] text-soft">
                {m.genre} → {m.playlistName}
                <button
                  type="submit"
                  aria-label={`Supprimer le mapping ${m.genre}`}
                  className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:text-ink"
                >
                  <Icon name="x" size={12} strokeWidth={2.4} />
                </button>
              </span>
            </form>
          ))}
        </Alert>
      )}
    </main>
  );
}

// Idées de playlists classées par nombre de favoris non classés qu'elles rangeraient.
type Target = { id: string; name: string };
function Suggestions({ top, rest, unsortedCount, targets }: { top: Suggestion[]; rest: Suggestion[]; unsortedCount: number; targets: Target[] }) {
  return (
    <section
      aria-labelledby="ideas-title"
      className="flex flex-col gap-[18px] rounded-3xl border border-[#232831] p-[clamp(20px,2.4vw,28px)]"
      style={{ background: "radial-gradient(620px 280px at 0% 0%, rgba(166,155,255,0.10), transparent 70%), radial-gradient(520px 260px at 100% 100%, rgba(46,230,214,0.07), transparent 70%), #13161b" }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5">
          <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-lilac-soft">
            <Icon name="sparkles" size={15} />
            Idées de playlists
          </span>
          <h2 id="ideas-title" className="m-0 font-display text-[clamp(22px,2.2vw,28px)] font-bold leading-[1.15] tracking-[-0.02em]">
            {plural(unsortedCount, "favori")} attendent une playlist
          </h2>
          <p className="m-0 text-[14px] text-dim">
            D&apos;après les genres de vos favoris non classés. Un clic crée la playlist sur Tidal (ou complète celle du même nom) et y mappe les tags ;
            « Ajouter à… » les met dans une playlist existante. Les titres sont rangés à la prochaine synchro.
          </p>
        </div>
        <form action={applySuggestions}>
          {top.map((s) => (
            <input key={s.key} type="hidden" name="key" value={s.key} />
          ))}
          <Button type="submit" variant="contained" color="secondary" startIcon={<Icon name="sparkles" />} sx={{ boxShadow: "0 10px 30px -12px rgba(166,155,255,0.7)" }}>
            Tout créer ({top.length})
          </Button>
        </form>
      </div>

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3 p-0">
        {top.map((s) => (
          <li key={s.key}>
            <div className="flex h-full flex-col gap-3 rounded-[18px] border border-edge bg-stage p-4">
              <div className="flex items-center gap-3">
                <Cover name={s.name} sub={s.coverSub} size={56} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-display text-[17px] font-semibold tracking-tight">{s.name}</span>
                  <span className="text-[13px]">
                    <strong className="font-semibold text-amber">{plural(s.count, "favori")}</strong>
                    <span className="text-muted"> à ranger{s.exists && " · existe déjà"}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.tags.slice(0, 5).map((t) => (
                  <span key={t} className="inline-flex h-6 items-center rounded-full border border-[#2a303a] px-2 text-xs text-soft">
                    {t}
                  </span>
                ))}
                {s.tags.length > 5 && <span className="text-xs leading-6 text-faint">+{s.tags.length - 5}</span>}
              </div>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12.5px] text-muted">
                {s.examples.map((e) => (
                  <li key={e} className="truncate">
                    {e}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-2">
                <form action={applySuggestion.bind(null, s.key)} className="flex">
                  <Button type="submit" size="small" fullWidth variant={s.exists ? "outlined" : "contained"} color={s.exists ? "inherit" : "primary"} sx={{ boxShadow: "none" }}>
                    {s.exists ? "Compléter" : "Créer"} « {s.name} »
                  </Button>
                </form>
                <AddToPlaylist
                  action={applyIdeaTo.bind(null, s.key)}
                  playlists={targets}
                  label={`Ajouter « ${s.name} » à une playlist existante`}
                  selectClassName="w-full max-w-none"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {rest.length > 0 && (
        <details className="group rounded-[14px] border border-edge bg-stage/60 px-4 py-3">
          <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-soft">
            <span className="group-open:hidden">Voir {plural(rest.length, "autre idée", "autres idées")}</span>
            <span className="hidden group-open:inline">Masquer les autres idées</span>
          </summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
            {rest.map((s) => (
              <li key={s.key}>
                <div className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-raised">
                  <Cover name={s.name} sub={s.coverSub} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {s.name} <Mono className="text-xs text-faint">· {s.count}</Mono>
                  </span>
                  <span className="hidden min-w-0 flex-1 truncate text-xs text-muted sm:block">{s.tags.slice(0, 4).join(", ")}</span>
                  <form action={applySuggestion.bind(null, s.key)} aria-label={`${s.exists ? "Compléter" : "Créer"} ${s.name}`}>
                    <Button type="submit" size="small" variant="outlined" color="inherit">
                      {s.exists ? "Compléter" : "Créer"}
                    </Button>
                  </form>
                  <AddToPlaylist action={applyIdeaTo.bind(null, s.key)} playlists={targets} label={`Ajouter « ${s.name} » à une playlist existante`} className="max-sm:hidden" />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// Fusion de playlists : sources cochées → cible. Formulaire natif (fonctionne sans JS).
function MergeForm({ playlists }: { playlists: (Playlist & { sub: string | null })[] }) {
  return (
    <details className="group rounded-[18px] border border-edge bg-stage">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-[18px] text-[14.5px] font-semibold text-soft hover:text-ink">
        <Icon name="merge" size={17} />
        Fusionner des playlists
        <span className="ml-auto text-xs font-normal text-muted group-open:hidden">Regrouper plusieurs playlists en une seule</span>
      </summary>
      <form action={mergePlaylists} aria-label="Fusionner des playlists" className="flex flex-col gap-4 border-t border-edge p-[18px]">
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[13px] font-semibold text-soft">Playlists à fusionner</legend>
          <div className="flex flex-wrap gap-2">
            {playlists.map((p) => (
              <label
                key={p.id}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[#2a303a] pl-1.5 pr-3.5 text-[13.5px] text-soft hover:border-[#3a414c] has-[:checked]:border-aqua has-[:checked]:bg-aqua/12 has-[:checked]:font-semibold has-[:checked]:text-aqua has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-aqua"
              >
                <input type="checkbox" name="source" value={p.id} className="sr-only" />
                {p.sub === null ? <PlainCover size={28} /> : <Cover name={p.name} sub={p.sub} size={28} />}
                {p.name}
                <span className="font-mono text-[11.5px] font-normal text-faint">{p.tracks}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex flex-col gap-2 text-[13px] font-semibold text-soft">
            Dans la playlist
            <select
              name="target"
              required
              defaultValue=""
              className="h-11 min-w-[220px] cursor-pointer rounded-xl border border-[#2a303a] bg-hollow px-3 text-[14px] font-normal text-ink outline-none focus:border-aqua [&>option]:bg-stage"
            >
              <option value="" disabled>
                Choisir la cible…
              </option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px] text-soft">
            <input type="checkbox" name="deleteSources" className="size-4 accent-[#ff6b6b]" />
            Supprimer ensuite les playlists fusionnées sur Tidal
          </label>
          <Button type="submit" variant="contained" color="inherit" sx={{ ml: "auto", bgcolor: "#eef1f5", color: "#0b0d10", "&:hover": { bgcolor: "#ffffff" } }}>
            Fusionner
          </Button>
        </div>
        <p className="m-0 text-[12.5px] leading-normal text-muted">
          Les titres sont copiés dans la cible sans doublon, et les genres mappés des playlists fusionnées passent sur la cible. Sans suppression, les
          playlists d&apos;origine restent intactes sur Tidal mais ne sont plus gérées.
        </p>
      </form>
    </details>
  );
}
