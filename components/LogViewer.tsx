"use client";

import { useMemo, useState } from "react";
import GenreMenu, { type GenreMapping, type MenuPlaylist } from "@/components/GenreMenu";
import { PlayButton } from "@/components/Preview";
import { Cover, Icon } from "@/components/ui";

// genres : tous ceux du titre (null : ligne sans titre, ou log antérieur à leur mémorisation et titre inconnu).
export type LogLine = { id: number; time: string; level: string; message: string; trackId?: string | null; genres?: string[] | null };

const LEVELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  info: { label: "INFO", color: "#aab3c0", bg: "rgba(154,164,178,0.12)", dot: "#9aa4b2" },
  moved: { label: "MOVED", color: "#2ee6d6", bg: "rgba(46,230,214,0.12)", dot: "#2ee6d6" },
  removed: { label: "REMOVED", color: "#c3baff", bg: "rgba(166,155,255,0.14)", dot: "#a69bff" },
  skipped: { label: "SKIPPED", color: "#f5b544", bg: "rgba(245,181,68,0.13)", dot: "#f5b544" },
  error: { label: "ERROR", color: "#ff8a8a", bg: "rgba(255,107,107,0.15)", dot: "#ff6b6b" },
};
const FILTERS = [{ key: "all", label: "Tout", dot: "#eef1f5" }, ...Object.entries(LEVELS).map(([key, l]) => ({ key, label: l.label, dot: l.dot }))];

// Les messages viennent de lib/sync.ts ; on en extrait artiste, titre, playlist et genre pour l'affichage.
// Si un format change, la ligne s'affiche telle quelle (texte brut).
const MOVED = /^(\[DRY RUN\] )?(.+?) → « (.+?) » via (.+?)(?: \(([^)]*)\))?( \(reste en favori\))?$/;
const REMOVED = /^(\[DRY RUN\] )?(.+?) — retiré de « (.+?) » : (.+)$/;
const SKIPPED = /^(.+?)(?: \(\+ (\d+) doublon\(s\)\))? — (?:genre non mappé \((.*)\)|aucun genre) : reste en favori$/;

const splitLabel = (label: string) => {
  const i = label.indexOf(" — ");
  return i < 0 ? { artist: label, title: "" } : { artist: label.slice(0, i), title: label.slice(i + 3) };
};

type Parsed =
  | { kind: "moved"; dry: boolean; artist: string; title: string; playlist: string; genre: string; others: string[]; keep: boolean; from?: string }
  | { kind: "removed"; dry: boolean; artist: string; title: string; playlist: string; why: string }
  | { kind: "skipped"; artist: string; title: string; dups: number; genres: string[] }
  | { kind: "plain" };

function parse(l: LogLine): Parsed {
  if (l.level === "moved") {
    const m = l.message.match(MOVED);
    if (m) {
      const keep = !!m[6] || m[5] === "reste en favori";
      const from = m[5]?.match(/^retiré de « (.+) »$/)?.[1];
      const others = m[5] && !from && m[5] !== "reste en favori" ? m[5].split(", ") : []; // anciens logs : 5 autres genres max
      return { kind: "moved", dry: !!m[1], ...splitLabel(m[2]), playlist: m[3], genre: m[4], others, keep, from };
    }
  }
  if (l.level === "removed") {
    const m = l.message.match(REMOVED);
    if (m) return { kind: "removed", dry: !!m[1], ...splitLabel(m[2]), playlist: m[3], why: m[4] };
  }
  if (l.level === "skipped") {
    const m = l.message.match(SKIPPED);
    if (m) return { kind: "skipped", ...splitLabel(m[1]), dups: Number(m[2] ?? 0), genres: m[3] ? m[3].split(", ") : [] };
  }
  return { kind: "plain" };
}

const Track = ({ artist, title }: { artist: string; title: string }) => (
  <span>
    <strong className="font-semibold text-ink">{artist}</strong>
    {title && <span className="text-dim"> — {title}</span>}
  </span>
);

const PlaylistChip = ({ name }: { name: string }) => (
  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-tag pl-[3px] pr-2 font-medium text-ink">
    <Cover name={name} size={16} />
    {name}
  </span>
);

function TrackActions({ trackId }: { trackId: string }) {
  return (
    <span className="flex items-center gap-0.5">
      <PlayButton previewKey={`log:${trackId}`} trackId={trackId} />
      <a
        href={`https://tidal.com/browse/track/${encodeURIComponent(trackId)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Ouvrir dans Tidal"
        title="Ouvrir dans Tidal"
        className="inline-flex size-[22px] items-center justify-center rounded-full text-faint no-underline hover:text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 4h6v6" />
          <path d="M20 4l-9 9" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      </a>
    </span>
  );
}

const SHOWN_TAGS = 6;

// Chips des genres d'un titre, cliquables : exemples, mapping actuel, (ré)association à une playlist.
// via : genre qui a décidé du classement (en tête, en couleur). Pointillés ambre : genre non mappé.
function TagChips({
  genres,
  via,
  mappings,
  open,
  onOpen,
}: {
  genres: string[];
  via?: string;
  mappings: Record<string, GenreMapping>;
  open: string | null;
  onOpen: (el: HTMLElement, genre: string) => void;
}) {
  const [all, setAll] = useState(false);
  const list = via ? [via, ...genres.filter((g) => g !== via)] : genres;
  const shown = all ? list : list.slice(0, SHOWN_TAGS);
  return (
    <>
      {shown.map((g) => {
        const m = mappings[g];
        const on = open === g;
        const tone = on
          ? "border-aqua bg-aqua/12 text-aqua"
          : g === via
            ? "border-aqua/45 bg-aqua/8 text-[#7ff3e8] hover:border-aqua"
            : m
              ? "border-[#2a303a] text-soft hover:border-soft"
              : "border-dashed border-amber/55 text-[#f5c46e] hover:border-amber";
        return (
          <button
            key={g}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={on}
            title={m ? `${g} → « ${m.playlistName} » · cliquer pour changer` : `${g} : non mappé · cliquer pour l'associer`}
            onClick={(e) => onOpen(e.currentTarget, g)}
            className={`inline-flex h-[22px] cursor-pointer items-center rounded-full border bg-transparent px-2 text-[12.5px] ${tone}`}
          >
            {g}
          </button>
        );
      })}
      {list.length > SHOWN_TAGS && (
        <button type="button" onClick={() => setAll(!all)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-faint hover:text-ink">
          {all ? "moins" : `+${list.length - SHOWN_TAGS}`}
        </button>
      )}
    </>
  );
}

export default function LogViewer({
  logs,
  mappings = {},
  pruneMismatched = true,
  assign,
  ignore,
  unmap,
  loadPlaylists,
}: {
  logs: LogLine[];
  mappings?: Record<string, GenreMapping>;
  pruneMismatched?: boolean;
  assign?: (f: FormData) => Promise<void>;
  ignore?: (genre: string) => Promise<void>;
  unmap?: (genre: string) => Promise<void>;
  loadPlaylists?: () => Promise<MenuPlaylist[]>;
}) {
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; genre: string } | null>(null);
  // Playlists du menu : chargées à la 1re ouverture, rechargées si les mappings ont changé depuis (pochettes).
  const mapKey = useMemo(() => JSON.stringify(mappings), [mappings]);
  const [pl, setPl] = useState<{ key: string; list?: MenuPlaylist[]; error?: string } | null>(null);
  const rows = useMemo(
    () =>
      logs.map((l) => {
        const parsed = parse(l);
        const genres = l.genres ?? (parsed.kind === "moved" ? [parsed.genre, ...parsed.others] : parsed.kind === "skipped" ? parsed.genres : []);
        return { ...l, parsed, genres, haystack: [l.message, ...genres].join(" ").toLowerCase() };
      }),
    [logs],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: logs.length };
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [logs]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (level === "all" || r.level === level) && (!needle || r.haystack.includes(needle)) && (!tag || r.genres.includes(tag)));

  const interactive = !!(assign && ignore && loadPlaylists);
  const openMenu = (el: HTMLElement, genre: string) => {
    setMenu({ el, genre });
    if (loadPlaylists && (pl?.key !== mapKey || pl.error)) {
      setPl({ key: mapKey });
      loadPlaylists()
        .then((list) => setPl({ key: mapKey, list }))
        .catch((e) => setPl({ key: mapKey, error: (e as Error).message }));
    }
  };
  const chips = (genres: string[], via?: string) =>
    interactive ? (
      <TagChips genres={genres} via={via} mappings={mappings} open={menu?.genre ?? null} onOpen={openMenu} />
    ) : (
      [via, ...genres.filter((g) => g !== via)].filter(Boolean).map((g) => (
        <span key={g} className="inline-flex h-[22px] items-center rounded-full border border-[#2a303a] px-2 text-[12.5px] text-soft">
          {g}
        </span>
      ))
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Filtrer par niveau" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = f.key === level;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => setLevel(f.key)}
                className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold ${
                  on ? "border-ink bg-ink text-night" : "border-line bg-[#181b21] text-soft hover:border-[#3a414c]"
                }`}
              >
                <span className="size-2 rounded-[2px]" style={{ background: f.dot }} />
                <span className="font-mono tracking-wide">{f.label}</span>
                <span className={`font-medium ${on ? "text-[#4a515c]" : "text-muted"}`}>{counts[f.key] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <label className="flex h-11 min-w-0 flex-[1_1_240px] items-center gap-2.5 rounded-full border border-line bg-hollow px-3.5">
          <Icon name="search" size={16} className="text-muted" strokeWidth={2} />
          <span className="sr-only">Rechercher dans les logs</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un titre, un artiste, un genre…"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        {tag && (
          <button
            type="button"
            onClick={() => setTag(null)}
            aria-label={`Retirer le filtre genre ${tag}`}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-aqua bg-aqua/12 px-3.5 text-[13px] font-semibold text-aqua"
          >
            Genre : {tag}
            <Icon name="x" size={13} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <ol aria-label="Lignes de log" className="tp-scroll m-0 flex max-h-[560px] list-none flex-col gap-0.5 overflow-auto rounded-[14px] border border-[#1d2128] bg-well p-1.5">
        {!logs.length && <li className="px-4 py-10 text-center text-sm text-muted">Aucune synchronisation pour l&apos;instant.</li>}
        {logs.length > 0 && !shown.length && <li className="px-4 py-10 text-center text-sm text-muted">Aucune ligne ne correspond à ces filtres.</li>}
        {shown.map((r) => {
          const lv = LEVELS[r.level] ?? LEVELS.info;
          const p = r.parsed;
          return (
            <li
              key={r.id}
              className="grid grid-cols-[66px_78px_52px_minmax(0,1fr)] items-start gap-3 rounded-lg px-2.5 py-2 max-sm:grid-cols-[58px_52px_minmax(0,1fr)] max-sm:gap-2"
              style={{ background: r.level === "error" ? "rgba(255,107,107,0.06)" : undefined }}
            >
              <span className="font-mono text-[12.5px] leading-[22px] text-faint">{r.time}</span>
              <span
                className="inline-flex h-[22px] items-center justify-center rounded-md font-mono text-[11px] font-semibold tracking-wider max-sm:hidden"
                style={{ color: lv.color, background: lv.bg }}
              >
                {lv.label}
              </span>
              <span className="flex h-[22px] items-center">{r.trackId && <TrackActions trackId={r.trackId} />}</span>
              {/* title : message brut, au survol (et repère stable pour les tests) */}
              <div className="min-w-0 text-[13.5px] leading-[22px]" title={r.message}>
                {p.kind === "moved" && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {p.dry && <span className="rounded bg-lilac/14 px-1.5 font-mono text-[11px] font-semibold text-lilac-soft">DRY RUN</span>}
                    <Track artist={p.artist} title={p.title} />
                    <span aria-hidden="true" className="text-[#5c6472]">
                      →
                    </span>
                    <PlaylistChip name={p.playlist} />
                    <span className="text-faint">via</span>
                    {chips(r.genres, p.genre)}
                    {p.keep && <span className="text-[12.5px] text-faint">(reste en favori)</span>}
                    {p.from && <span className="text-[12.5px] text-faint">(retiré de « {p.from} »)</span>}
                  </div>
                )}
                {p.kind === "removed" && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {p.dry && <span className="rounded bg-lilac/14 px-1.5 font-mono text-[11px] font-semibold text-lilac-soft">DRY RUN</span>}
                    <Track artist={p.artist} title={p.title} />
                    <span className="text-faint">retiré de</span>
                    <PlaylistChip name={p.playlist} />
                    <span className="text-[12.5px] text-faint">{p.why}</span>
                    {chips(r.genres)}
                  </div>
                )}
                {p.kind === "skipped" && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Track artist={p.artist} title={p.title} />
                    {p.dups > 0 && <span className="text-[12.5px] text-faint">+ {p.dups} doublon(s)</span>}
                    <span className="text-faint">{r.genres.length ? "genre non mappé" : "aucun genre"}</span>
                    {chips(r.genres)}
                  </div>
                )}
                {p.kind === "plain" && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span style={{ color: r.level === "error" ? "#ffb3b3" : "#c4cad4" }}>{r.message}</span>
                    {r.genres.length > 0 && chips(r.genres)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {interactive && (
        <GenreMenu
          key={menu ? `${menu.genre}|${mappings[menu.genre]?.playlistId ?? ""}` : ""}
          anchor={menu?.el ?? null}
          genre={menu?.genre ?? null}
          mapping={menu ? mappings[menu.genre] : undefined}
          playlists={pl?.list ?? null}
          playlistsError={pl?.error}
          assign={assign!}
          ignore={ignore!}
          unmap={unmap}
          onClose={() => setMenu(null)}
          footer={
            menu && (
              <div className="flex flex-col gap-1.5 border-t border-[#2a303a] pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTag(menu.genre);
                    setMenu(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 text-xs font-semibold text-lilac-soft hover:text-ink"
                >
                  <Icon name="search" size={13} strokeWidth={2.2} />
                  Voir les titres de ce genre dans les logs
                </button>
                <span className="text-[12px] leading-[1.45] text-muted">
                  {pruneMismatched
                    ? "Les titres déjà classés via ce genre changent de playlist à la prochaine synchro (« Ranger à nouveau »)."
                    : "« Ranger à nouveau » est désactivé : les titres déjà classés restent dans leur playlist actuelle."}
                </span>
              </div>
            )
          }
        />
      )}
    </div>
  );
}
