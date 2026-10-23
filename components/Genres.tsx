"use client";

import { createContext, useContext, useMemo, useState } from "react";
import GenreMenu, { type GenreMapping, type MenuPlaylist } from "@/components/GenreMenu";
import { Icon } from "@/components/ui";

// Tags de genre, partout pareils : un clic ouvre le même menu (exemples à écouter, playlist actuelle, changer de
// playlist, démapper, ignorer, filtrer les listes de titres sur ce genre). Un seul menu par page, dans GenreProvider.

type Ctx = {
  mappings: Record<string, GenreMapping>;
  pruneMismatched: boolean;
  open: (el: HTMLElement, genre: string) => void;
  current: string | null;
  filter: string | null; // genre sur lequel les listes de titres (logs, titres classés) sont filtrées
  setFilter: (genre: string | null) => void;
};
const GenreCtx = createContext<Ctx | null>(null);
export const useGenres = () => useContext(GenreCtx);

export function GenreProvider({
  mappings,
  pruneMismatched = true,
  playlists,
  loadPlaylists,
  assign,
  ignore,
  unmap,
  children,
}: {
  mappings: Record<string, GenreMapping>;
  pruneMismatched?: boolean;
  playlists?: MenuPlaylist[]; // connues de la page ; sinon chargées à la 1re ouverture du menu
  loadPlaylists?: () => Promise<MenuPlaylist[]>;
  assign: (f: FormData) => Promise<void>;
  ignore: (genre: string) => Promise<void>;
  unmap: (genre: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<{ el: HTMLElement; genre: string } | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  // Playlists chargées à la demande, rechargées si les mappings ont changé depuis (pochettes à jour).
  const mapKey = useMemo(() => JSON.stringify(mappings), [mappings]);
  const [loaded, setLoaded] = useState<{ key: string; list?: MenuPlaylist[]; error?: string } | null>(null);

  const open = (el: HTMLElement, genre: string) => {
    setMenu({ el, genre });
    if (!playlists && loadPlaylists && (loaded?.key !== mapKey || loaded.error)) {
      setLoaded({ key: mapKey });
      loadPlaylists()
        .then((list) => setLoaded({ key: mapKey, list }))
        .catch((e) => setLoaded({ key: mapKey, error: (e as Error).message }));
    }
  };
  const ctx = { mappings, pruneMismatched, open, current: menu?.genre ?? null, filter, setFilter };

  return (
    <GenreCtx.Provider value={ctx}>
      {children}
      <GenreMenu
        key={menu ? `${menu.genre}|${mappings[menu.genre]?.playlistId ?? ""}` : ""}
        anchor={menu?.el ?? null}
        genre={menu?.genre ?? null}
        mapping={menu ? mappings[menu.genre] : undefined}
        playlists={playlists ?? loaded?.list ?? null}
        playlistsError={loaded?.error}
        assign={assign}
        ignore={ignore}
        unmap={unmap}
        onClose={() => setMenu(null)}
        footer={
          menu && (
            <div className="flex flex-col gap-1.5 border-t border-[#2a303a] pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setFilter(menu.genre);
                  setMenu(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 text-xs font-semibold text-lilac-soft hover:text-ink"
              >
                <Icon name="search" size={13} strokeWidth={2.2} />
                Filtrer les titres sur ce genre
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
    </GenreCtx.Provider>
  );
}

// Un tag. via : genre qui a décidé du classement (en couleur). Pointillés ambre : non mappé.
// Hors GenreProvider : simple étiquette, non cliquable.
export function GenreTag({ genre, via, count, size = "sm" }: { genre: string; via?: boolean; count?: number; size?: "sm" | "md" }) {
  const g = useGenres();
  const m = g?.mappings[genre];
  const on = g?.current === genre;
  const box = size === "md" ? "h-9 px-3.5 text-[13.5px]" : "h-[22px] px-2 text-[12.5px]";
  const tone = on
    ? "border-aqua bg-aqua/12 text-aqua"
    : via
      ? "border-aqua/45 bg-aqua/8 text-[#7ff3e8] hover:border-aqua"
      : m
        ? "border-[#2a303a] text-soft hover:border-soft"
        : "border-dashed border-amber/55 text-[#f5c46e] hover:border-amber";
  const body = (
    <>
      {genre}
      {count !== undefined && count > 0 && <span className="font-mono text-[11.5px] text-faint">{count}</span>}
    </>
  );
  if (!g) return <span className={`inline-flex items-center gap-1.5 rounded-full border ${box} ${tone}`}>{body}</span>;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={on}
      title={m ? `${genre} → « ${m.playlistName} » · cliquer pour changer` : `${genre} : non mappé · cliquer pour l'associer`}
      onClick={(e) => g.open(e.currentTarget, genre)}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-transparent ${box} ${tone}`}
    >
      {body}
    </button>
  );
}

// Tags d'un titre, le genre décisif en tête ; au-delà de max, « +N » déplie le reste.
export function GenreTags({ genres, via, max = 6 }: { genres: string[]; via?: string | null; max?: number }) {
  const [all, setAll] = useState(false);
  const list = via ? [via, ...genres.filter((x) => x !== via)] : genres;
  const shown = all ? list : list.slice(0, max);
  return (
    <>
      {shown.map((x) => (
        <GenreTag key={x} genre={x} via={x === via} />
      ))}
      {list.length > max && (
        <button type="button" onClick={() => setAll(!all)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-faint hover:text-ink">
          {all ? "moins" : `+${list.length - max}`}
        </button>
      )}
    </>
  );
}

// Filtre « genre » actif (posé depuis le menu d'un tag), avec bouton pour le retirer.
export function GenreFilterChip() {
  const g = useGenres();
  if (!g?.filter) return null;
  return (
    <button
      type="button"
      onClick={() => g.setFilter(null)}
      aria-label={`Retirer le filtre genre ${g.filter}`}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-aqua bg-aqua/12 px-3.5 text-[13px] font-semibold text-aqua"
    >
      Genre : {g.filter}
      <Icon name="x" size={13} strokeWidth={2.4} />
    </button>
  );
}
