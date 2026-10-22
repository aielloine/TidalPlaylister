"use client";

import { Popover } from "@mui/material";
import { useState } from "react";
import { ExampleList } from "@/components/Preview";
import { Cover, Icon, PlainCover } from "@/components/ui";

type Genre = { name: string; count: number };
type Playlist = { id: string; name: string; tracks: number; sub: string | null }; // sub null : playlist non gérée

// Chips des genres rencontrés et non mappés : un clic propose de les associer à une playlist ou de les ignorer.
export default function UnmappedGenres({
  genres,
  playlists,
  assign,
  ignore,
}: {
  genres: Genre[];
  playlists: Playlist[];
  assign: (f: FormData) => Promise<void>;
  ignore: (genre: string) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<{ el: HTMLElement; genre: string } | null>(null);
  const [priority, setPriority] = useState("");
  const close = () => setAnchor(null);

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((g) => {
        const on = anchor?.genre === g.name;
        return (
          <button
            key={g.name}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={on}
            onClick={(e) => {
              setPriority("");
              setAnchor({ el: e.currentTarget, genre: g.name });
            }}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] ${
              on ? "border-aqua bg-aqua/12 font-semibold text-aqua" : "border-dashed border-[#3a414c] bg-transparent text-soft hover:border-soft"
            }`}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} className={on ? "" : "text-faint"} />
            {g.name}
            {g.count > 0 && <span className="font-mono text-[11.5px] text-faint">{g.count}</span>}
          </button>
        );
      })}

      <Popover
        open={!!anchor}
        anchorEl={anchor?.el}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 1, width: 360, maxWidth: "calc(100vw - 32px)", p: 1.75 }, role: "dialog", "aria-label": `Associer ${anchor?.genre ?? ""} à une playlist` } }}
      >
        {anchor && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1 border-b border-[#2a303a] pb-2.5">
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Exemples · {anchor.genre}</span>
              <ExampleList tags={[anchor.genre]} />
            </div>
            <span className="text-[13px] text-dim">
              Associer <strong className="font-semibold text-ink">{anchor.genre}</strong> à…
            </span>
            <div className="tp-scroll flex max-h-72 flex-col gap-0.5 overflow-auto">
              {!playlists.length && <span className="py-3 text-[13px] text-muted">Aucune playlist : créez-en une d&apos;abord.</span>}
              {playlists.map((p) => (
                <form key={p.id} action={assign} onSubmit={close}>
                  <input type="hidden" name="genre" value={anchor.genre} />
                  <input type="hidden" name="playlistId" value={p.id} />
                  <input type="hidden" name="playlistName" value={p.name} />
                  <input type="hidden" name="priority" value={priority} />
                  <button
                    type="submit"
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2 text-left text-sm text-ink hover:bg-[#262b34]"
                  >
                    {p.sub === null ? <PlainCover size={28} /> : <Cover name={p.name} sub={p.sub} size={28} />}
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted">{p.tracks} titre{p.tracks > 1 ? "s" : ""}</span>
                  </button>
                </form>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2.5 border-t border-[#2a303a] pt-2.5">
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
              <form action={ignore.bind(null, anchor.genre)} onSubmit={close}>
                <button type="submit" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] text-dim hover:text-ink">
                  <Icon name="eyeOff" size={14} strokeWidth={2} />
                  Ignorer ce genre
                </button>
              </form>
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}
