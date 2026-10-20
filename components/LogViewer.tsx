"use client";

import { useMemo, useState } from "react";
import { coverGradient } from "@/lib/covers";
import { Icon } from "@/components/ui";

export type LogLine = { id: number; time: string; level: string; message: string };

const LEVELS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  info: { label: "INFO", color: "#aab3c0", bg: "rgba(154,164,178,0.12)", dot: "#9aa4b2" },
  moved: { label: "MOVED", color: "#2ee6d6", bg: "rgba(46,230,214,0.12)", dot: "#2ee6d6" },
  skipped: { label: "SKIPPED", color: "#f5b544", bg: "rgba(245,181,68,0.13)", dot: "#f5b544" },
  error: { label: "ERROR", color: "#ff8a8a", bg: "rgba(255,107,107,0.15)", dot: "#ff6b6b" },
};
const FILTERS = [{ key: "all", label: "Tout", dot: "#eef1f5" }, ...Object.entries(LEVELS).map(([key, l]) => ({ key, label: l.label, dot: l.dot }))];

// Les messages viennent de lib/sync.ts ; on en extrait artiste, titre, playlist et genre pour l'affichage.
// Si un format change, la ligne s'affiche telle quelle (texte brut).
const MOVED = /^(\[DRY RUN\] )?(.+?) → « (.+?) » via (.+?)(?: \(([^)]*)\))?( \(reste en favori\))?$/;
const SKIPPED = /^(.+?)(?: \(\+ (\d+) doublon\(s\)\))? — (?:genre non mappé \((.*)\)|aucun genre) : reste en favori$/;

const splitLabel = (label: string) => {
  const i = label.indexOf(" — ");
  return i < 0 ? { artist: label, title: "" } : { artist: label.slice(0, i), title: label.slice(i + 3) };
};

type Parsed =
  | { kind: "moved"; dry: boolean; artist: string; title: string; playlist: string; genre: string; keep: boolean }
  | { kind: "skipped"; artist: string; title: string; dups: number; genres: string[] }
  | { kind: "plain" };

function parse(l: LogLine): Parsed {
  if (l.level === "moved") {
    const m = l.message.match(MOVED);
    if (m) {
      const keep = !!m[6] || m[5] === "reste en favori";
      return { kind: "moved", dry: !!m[1], ...splitLabel(m[2]), playlist: m[3], genre: m[4], keep };
    }
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

export default function LogViewer({ logs }: { logs: LogLine[] }) {
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => logs.map((l) => ({ ...l, parsed: parse(l), haystack: l.message.toLowerCase() })), [logs]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: logs.length };
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [logs]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (level === "all" || r.level === level) && (!needle || r.haystack.includes(needle)));

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
              className="grid grid-cols-[66px_78px_minmax(0,1fr)] items-start gap-3 rounded-lg px-2.5 py-2 max-sm:grid-cols-[58px_minmax(0,1fr)]"
              style={{ background: r.level === "error" ? "rgba(255,107,107,0.06)" : undefined }}
            >
              <span className="font-mono text-[12.5px] leading-[22px] text-faint">{r.time}</span>
              <span
                className="inline-flex h-[22px] items-center justify-center rounded-md font-mono text-[11px] font-semibold tracking-wider max-sm:hidden"
                style={{ color: lv.color, background: lv.bg }}
              >
                {lv.label}
              </span>
              {/* title : message brut, au survol (et repère stable pour les tests) */}
              <div className="min-w-0 text-[13.5px] leading-[22px]" title={r.message}>
                {p.kind === "moved" && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {p.dry && <span className="rounded bg-lilac/14 px-1.5 font-mono text-[11px] font-semibold text-lilac-soft">DRY RUN</span>}
                    <Track artist={p.artist} title={p.title} />
                    <span aria-hidden="true" className="text-[#5c6472]">
                      →
                    </span>
                    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-tag pl-[3px] pr-2 font-medium text-ink">
                      <span className="size-4 rounded" style={{ background: coverGradient(p.playlist) }} />
                      {p.playlist}
                    </span>
                    <span className="text-faint">via</span>
                    <span className="inline-flex h-[22px] items-center rounded-full border border-[#2a303a] px-2 text-[12.5px] text-soft">{p.genre}</span>
                    {p.keep && <span className="text-[12.5px] text-faint">(reste en favori)</span>}
                  </div>
                )}
                {p.kind === "skipped" && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Track artist={p.artist} title={p.title} />
                    {p.dups > 0 && <span className="text-[12.5px] text-faint">+ {p.dups} doublon(s)</span>}
                    <span className="text-faint">{p.genres.length ? "genre non mappé" : "aucun genre"}</span>
                    {p.genres.slice(0, 4).map((g) => (
                      <span key={g} className="inline-flex h-[22px] items-center rounded-full border border-dashed border-amber/55 px-2 text-[12.5px] text-[#f5c46e]">
                        {g}
                      </span>
                    ))}
                    {p.genres.length > 4 && <span className="text-[12.5px] text-faint">+{p.genres.length - 4}</span>}
                  </div>
                )}
                {p.kind === "plain" && <span style={{ color: r.level === "error" ? "#ffb3b3" : "#c4cad4" }}>{r.message}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
