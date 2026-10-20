"use client";

import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Liste éditable de genres ignorés (chips) ; Entrée ou virgule pour ajouter.
export default function IgnoredGenres({ action, initial }: { action: (f: FormData) => Promise<void>; initial: string[] }) {
  const [list, setList] = useState(initial);
  const [typed, setTyped] = useState("");
  useEffect(() => setList(initial), [initial]); // resynchronisé après enregistrement ou « Ignorer ce genre »

  const add = (raw: string) => {
    const items = raw.split(",").map(norm).filter(Boolean);
    if (items.length) setList((l) => [...new Set([...l, ...items])]);
    setTyped("");
  };
  const all = [...list, ...typed.split(",").map(norm).filter(Boolean)];

  return (
    <form action={action} className="flex flex-1 flex-col gap-3.5">
      <input type="hidden" name="ignoredGenres" value={all.join(",")} />
      <label className="flex min-h-[150px] flex-1 cursor-text flex-wrap content-start gap-1.5 rounded-[14px] border border-[#2a303a] bg-hollow p-3 focus-within:border-aqua">
        <span className="sr-only">Ajouter un genre ignoré</span>
        {list.map((g) => (
          <span key={g} className="inline-flex h-8 items-center gap-0.5 rounded-full bg-tag pl-3 pr-1 text-[13px] text-soft">
            {g}
            <button
              type="button"
              aria-label={`Ne plus ignorer ${g}`}
              onClick={() => setList((l) => l.filter((x) => x !== g))}
              className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-muted hover:text-ink"
            >
              <Icon name="x" size={12} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <input
          value={typed}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setTyped(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && typed.trim()) {
              e.preventDefault();
              add(typed);
            } else if (e.key === "Backspace" && !typed && list.length) setList((l) => l.slice(0, -1));
          }}
          placeholder="Ajouter…"
          className="h-8 min-w-[120px] flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-muted">Entrée ou virgule pour ajouter</span>
        <Button type="submit" variant="contained" color="inherit" sx={{ bgcolor: "#eef1f5", color: "#0b0d10", "&:hover": { bgcolor: "#ffffff" } }}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
