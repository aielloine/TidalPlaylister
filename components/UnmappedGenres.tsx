"use client";

import { useState } from "react";
import GenreMenu, { type MenuPlaylist } from "@/components/GenreMenu";
import { Icon } from "@/components/ui";

type Genre = { name: string; count: number };

// Chips des genres rencontrés et non mappés : un clic propose de les associer à une playlist ou de les ignorer.
export default function UnmappedGenres({
  genres,
  playlists,
  assign,
  ignore,
}: {
  genres: Genre[];
  playlists: MenuPlaylist[];
  assign: (f: FormData) => Promise<void>;
  ignore: (genre: string) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<{ el: HTMLElement; genre: string } | null>(null);

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
            onClick={(e) => setAnchor({ el: e.currentTarget, genre: g.name })}
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

      <GenreMenu
        key={anchor?.genre}
        anchor={anchor?.el ?? null}
        genre={anchor?.genre ?? null}
        playlists={playlists}
        assign={assign}
        ignore={ignore}
        onClose={() => setAnchor(null)}
      />
    </div>
  );
}
