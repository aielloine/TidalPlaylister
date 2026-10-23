"use client";

import { Popover } from "@mui/material";
import { useState } from "react";
import { ExampleList } from "@/components/Preview";
import { Cover, Icon, PlainCover } from "@/components/ui";

export type MenuPlaylist = { id: string; name: string; tracks: number; sub: string | null }; // sub null : playlist non gérée
export type GenreMapping = { playlistId: string; playlistName: string; priority: number };

// Menu d'un genre (chips « non mappés » de /playlists, chips des logs) : exemples à écouter, mapping actuel,
// association à une playlist (ou réassignation), retrait du mapping, genre ignoré.
export default function GenreMenu({
  anchor,
  genre,
  mapping,
  playlists,
  playlistsError,
  assign,
  ignore,
  unmap,
  onClose,
  footer,
}: {
  anchor: HTMLElement | null;
  genre: string | null;
  mapping?: GenreMapping;
  playlists: MenuPlaylist[] | null; // null : en cours de chargement
  playlistsError?: string;
  assign: (f: FormData) => Promise<void>;
  ignore: (genre: string) => Promise<void>;
  unmap?: (genre: string) => Promise<void>;
  onClose: () => void;
  footer?: React.ReactNode; // actions propres au contexte (ex. filtrer les logs)
}) {
  // Priorité : celle du mapping actuel quand on réassigne, sinon automatique. Réinitialisée à chaque ouverture (key).
  const [priority, setPriority] = useState(mapping ? String(mapping.priority) : "");

  return (
    <Popover
      open={!!anchor && !!genre}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{
        paper: {
          sx: { mt: 1, width: 360, maxWidth: "calc(100vw - 32px)", p: 1.75 },
          role: "dialog",
          "aria-label": `${mapping ? "Changer la playlist de" : "Associer"} ${genre ?? ""}${mapping ? "" : " à une playlist"}`,
        },
      }}
    >
      {genre && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1 border-b border-[#2a303a] pb-2.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Exemples · {genre}</span>
            <ExampleList tags={[genre]} />
          </div>
          {mapping ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-dim">
              <strong className="font-semibold text-ink">{genre}</strong>
              <span>va dans</span>
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-tag pl-[3px] pr-2 font-medium text-ink">
                <Cover name={mapping.playlistName} size={16} />
                {mapping.playlistName}
              </span>
              <span className="font-mono text-[11.5px] text-faint">prio {mapping.priority}</span>
              <span className="w-full">Changer pour…</span>
            </div>
          ) : (
            <span className="text-[13px] text-dim">
              Associer <strong className="font-semibold text-ink">{genre}</strong> à…
            </span>
          )}
          <div className="tp-scroll flex max-h-72 flex-col gap-0.5 overflow-auto">
            {playlistsError && <span className="py-3 text-[13px] text-[#ff8a8a]">Lecture des playlists impossible : {playlistsError}</span>}
            {!playlists && !playlistsError && <span className="py-3 text-[13px] text-muted">Chargement des playlists…</span>}
            {playlists && !playlists.length && <span className="py-3 text-[13px] text-muted">Aucune playlist : créez-en une d&apos;abord.</span>}
            {playlists?.map((p) => {
              const current = mapping?.playlistId === p.id;
              return (
                <form key={p.id} action={assign} onSubmit={onClose}>
                  <input type="hidden" name="genre" value={genre} />
                  <input type="hidden" name="playlistId" value={p.id} />
                  <input type="hidden" name="playlistName" value={p.name} />
                  <input type="hidden" name="priority" value={priority} />
                  <button
                    type="submit"
                    aria-current={current || undefined}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 px-2 text-left text-sm text-ink hover:bg-[#262b34] ${
                      current ? "bg-aqua/10" : "bg-transparent"
                    }`}
                  >
                    {p.sub === null ? <PlainCover size={28} /> : <Cover name={p.name} sub={p.sub} size={28} />}
                    <span className="flex-1 truncate">{p.name}</span>
                    {current ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Playlist actuelle" className="flex-none text-aqua">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs text-muted">
                        {p.tracks} titre{p.tracks > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                </form>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#2a303a] pt-2.5">
            <label className="flex items-center gap-2 text-[13px] text-dim">
              Priorité
              <input
                value={priority}
                onChange={(e) => setPriority(e.target.value.replace(/[^\d-]/g, ""))}
                inputMode="numeric"
                placeholder="auto"
                className="h-9 w-16 rounded-lg border border-[#2a303a] bg-hollow px-2.5 font-mono text-[13px] text-ink outline-none focus:border-aqua"
              />
            </label>
            <div className="flex flex-wrap items-center">
              {mapping && unmap && (
                <form action={unmap.bind(null, genre)} onSubmit={onClose}>
                  <button type="submit" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] text-dim hover:text-ink">
                    <Icon name="x" size={13} strokeWidth={2.2} />
                    Démapper
                  </button>
                </form>
              )}
              <form action={ignore.bind(null, genre)} onSubmit={onClose}>
                <button type="submit" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] text-dim hover:text-ink">
                  <Icon name="eyeOff" size={14} strokeWidth={2} />
                  Ignorer ce genre
                </button>
              </form>
            </div>
          </div>
          {footer}
        </div>
      )}
    </Popover>
  );
}
