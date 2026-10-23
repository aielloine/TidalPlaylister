"use client";

import { useState } from "react";
import { GenreFilterChip, GenreTags, useGenres } from "@/components/Genres";
import { TrackActions } from "@/components/LogViewer";
import { Cover, Icon } from "@/components/ui";
import type { ClassifiedTrack } from "@/lib/tracks";

const PAGE = 100;

// Titres déjà classés : recherche (titre, artiste, genre), filtre genre, tags cliquables pour changer la playlist
// d'un genre. Liste globale (logs) : date et playlist de chaque titre ; sous une playlist (compact) : ni l'un ni l'autre.
export default function TrackList({ tracks, compact = false, label = "Titres classés" }: { tracks: ClassifiedTrack[]; compact?: boolean; label?: string }) {
  const g = useGenres();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const needle = q.trim().toLowerCase();
  const tag = g?.filter;
  const shown = tracks.filter(
    (t) => (!tag || t.genres.includes(tag)) && (!needle || [t.label, t.playlistName ?? "", ...t.genres].join(" ").toLowerCase().includes(needle)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-11 min-w-0 flex-[1_1_240px] items-center gap-2.5 rounded-full border border-line bg-hollow px-3.5">
          <Icon name="search" size={16} className="text-muted" strokeWidth={2} />
          <span className="sr-only">Rechercher dans {label.toLowerCase()}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un titre, un artiste, un genre…"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        <GenreFilterChip />
      </div>
      <ol aria-label={label} className="tp-scroll m-0 flex max-h-[560px] list-none flex-col gap-0.5 overflow-auto rounded-[14px] border border-[#1d2128] bg-well p-1.5">
        {!tracks.length && <li className="px-4 py-10 text-center text-sm text-muted">Aucun titre classé pour l&apos;instant.</li>}
        {tracks.length > 0 && !shown.length && <li className="px-4 py-10 text-center text-sm text-muted">Aucun titre ne correspond à ces filtres.</li>}
        {shown.slice(0, limit).map((t) => {
          const i = t.label.indexOf(" — ");
          return (
            <li
              key={t.trackId}
              className={`grid items-start gap-3 rounded-lg px-2.5 py-2 max-sm:gap-2 ${compact ? "grid-cols-[52px_minmax(0,1fr)]" : "grid-cols-[66px_52px_minmax(0,1fr)]"}`}
            >
              {!compact && (
                <span className="font-mono text-[12.5px] leading-[22px] text-faint" title="Classé le">
                  {t.at}
                </span>
              )}
              <span className="flex h-[22px] items-center">
                <TrackActions trackId={t.trackId} />
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] leading-[22px]">
                <span>
                  <strong className="font-semibold text-ink">{i < 0 ? t.label : t.label.slice(0, i)}</strong>
                  {i >= 0 && <span className="text-dim"> — {t.label.slice(i + 3)}</span>}
                </span>
                {!compact && (
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-tag pl-[3px] pr-2 font-medium text-ink">
                    {t.playlistName ? <Cover name={t.playlistName} size={16} /> : <Icon name="note" size={14} className="text-faint" />}
                    {t.playlistName ?? "playlist non gérée"}
                  </span>
                )}
                <GenreTags genres={t.genres} via={t.via} />
                {!t.managed && (
                  <span className="text-[12.5px] text-faint" title="Déjà dans la playlist avant l'appli, ou retiré à la main : l'appli n'y touche plus">
                    (non géré)
                  </span>
                )}
                {t.next && g?.pruneMismatched !== false && <span className="text-[12.5px] text-amber">→ {t.next} à la prochaine synchro</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + PAGE)}
          className="cursor-pointer self-center border-0 bg-transparent text-[13px] font-semibold text-lilac-soft hover:text-ink"
        >
          Afficher plus ({shown.length - limit} restants)
        </button>
      )}
    </div>
  );
}
