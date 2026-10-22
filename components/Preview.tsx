"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui";

// Extraits de 30 s (Deezer) : un seul lecteur pour toute la page (logs, exemples, popovers).
type State = { key: string; status: "loading" | "playing" | "error"; error?: string } | null;
let state: State = null;
let audio: HTMLAudioElement | null = null;
const subs = new Set<() => void>();
const set = (s: State) => {
  state = s;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));

// src : URL de l'extrait si déjà connue ; sinon trackId Tidal, résolu par /api/preview.
export async function togglePreview(key: string, src: { url?: string; trackId?: string }) {
  const a = (audio ??= new Audio());
  if (state?.key === key && state.status !== "error") {
    a.pause();
    return set(null);
  }
  a.pause();
  set({ key, status: "loading" });
  try {
    let url = src.url;
    if (!url && src.trackId) {
      const res = await fetch(`/api/preview/${encodeURIComponent(src.trackId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      url = body.url;
    }
    if (!url) throw new Error("Aucun extrait disponible");
    a.src = url;
    a.onended = () => set(null);
    await a.play();
    if (state?.key === key) set({ key, status: "playing" });
  } catch (e) {
    set({ key, status: "error", error: (e as Error).message });
  }
}

export function usePlaying() {
  const s = useSyncExternalStore(subscribe, () => state, () => null);
  useEffect(() => () => {
    if (!subs.size) audio?.pause();
  }, []);
  return s;
}

export function PlayButton({ previewKey, url, trackId }: { previewKey: string; url?: string; trackId?: string }) {
  const playing = usePlaying();
  const mine = playing?.key === previewKey ? playing : null;
  const label = mine?.status === "playing" ? "Arrêter l'extrait" : mine?.status === "error" ? `Extrait indisponible : ${mine.error}` : "Écouter un extrait (30 s)";
  return (
    <button
      type="button"
      onClick={() => togglePreview(previewKey, { url, trackId })}
      aria-label={label}
      title={label}
      className={`inline-flex size-[26px] flex-none cursor-pointer items-center justify-center rounded-full border-0 ${
        mine?.status === "playing" ? "bg-aqua text-aqua-ink" : mine?.status === "error" ? "bg-coral/15 text-[#ff8a8a]" : "bg-tag text-soft hover:bg-[#2a303a] hover:text-ink"
      }`}
    >
      {mine?.status === "loading" ? (
        <span className="tp-pulse size-2 rounded-full bg-aqua" />
      ) : mine?.status === "playing" ? (
        <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
          {[0.5, 1, 0.7].map((h, i) => (
            <span key={i} className="tp-eq block w-[2px] rounded-sm bg-aqua-ink" style={{ height: `${h * 100}%`, animationDelay: `${-i * 0.2}s` }} />
          ))}
        </span>
      ) : mine?.status === "error" ? (
        <Icon name="x" size={11} strokeWidth={2.6} />
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

type Example = { label: string; trackId?: string; preview?: { url: string; link?: string } | null; mine: boolean };

// Liste d'exemples à écouter pour des genres, chargée à la demande.
export function ExampleList({ tags }: { tags: string[] }) {
  const [data, setData] = useState<{ examples?: Example[]; error?: string } | null>(null);
  const key = tags.join("|");
  useEffect(() => {
    let live = true;
    setData(null);
    fetch(`/api/examples?${new URLSearchParams(tags.map((t) => ["tag", t]))}`)
      .then((r) => r.json())
      .then((d) => live && setData(d))
      .catch((e) => live && setData({ error: (e as Error).message }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tags comparé par valeur via key
  }, [key]);
  if (!data) return <p className="m-0 py-1.5 text-[12.5px] text-muted">Recherche d&apos;exemples…</p>;
  if (data.error) return <p className="m-0 py-1.5 text-[12.5px] text-[#ff8a8a]">Exemples indisponibles : {data.error}</p>;
  if (!data.examples?.length) return <p className="m-0 py-1.5 text-[12.5px] text-muted">Aucun exemple trouvé pour ce genre.</p>;
  return (
    <ul aria-label="Exemples à écouter" className="m-0 flex list-none flex-col gap-0.5 p-0">
      {data.examples.map((e) => (
        <li key={e.trackId ?? e.label} className="flex min-w-0 items-center gap-2 text-[12.5px]">
          <PlayButton previewKey={`ex:${e.trackId ?? e.label}`} url={e.preview?.url} trackId={e.trackId} />
          <span className="min-w-0 flex-1 truncate text-soft">{e.label}</span>
          <span className={`flex-none text-[11px] ${e.mine ? "text-amber" : "text-faint"}`}>{e.mine ? "vos titres" : "exemple"}</span>
        </li>
      ))}
    </ul>
  );
}

// Bouton « Écouter des exemples » qui déplie la liste.
export function Examples({ tags, className = "" }: { tags: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 text-xs font-semibold text-lilac-soft hover:text-ink"
      >
        <Icon name="headphones" size={14} strokeWidth={2} />
        {open ? "Masquer les exemples" : "Écouter des exemples"}
      </button>
      {open && <ExampleList tags={tags} />}
    </div>
  );
}
