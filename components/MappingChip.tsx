"use client";

import { useState } from "react";
import { useGenres } from "@/components/Genres";
import { Icon } from "@/components/ui";

// Genre mappé : pastille de priorité cliquable (Entrée pour enregistrer, Échap pour annuler), nom cliquable (menu
// commun des genres : exemples, changer de playlist…) + suppression.
export default function MappingChip({
  genre,
  priority,
  setPriority,
  remove,
}: {
  genre: string;
  priority: number;
  setPriority: (f: FormData) => Promise<void>;
  remove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const g = useGenres();
  const strong = priority >= 10;
  return (
    <li
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border pl-1 pr-0.5 text-[13px] font-medium ${
        strong ? "border-aqua/32 bg-aqua/9 text-[#dffbf8]" : "border-[#2a303a] bg-[#1a1e25] text-soft"
      }`}
    >
      {editing ? (
        <form action={setPriority} onSubmit={() => setEditing(false)}>
          <input
            name="priority"
            aria-label={`Priorité de ${genre}`}
            defaultValue={priority}
            inputMode="numeric"
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => (e.target.value === String(priority) ? setEditing(false) : e.target.form?.requestSubmit())}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            className="h-6 w-10 rounded-full border-0 bg-night px-1 text-center font-mono text-xs text-ink outline-2 outline-aqua"
          />
        </form>
      ) : (
        <button
          type="button"
          title="Modifier la priorité"
          aria-label={`Priorité ${priority}, modifier`}
          onClick={() => setEditing(true)}
          className={`inline-flex h-[22px] min-w-[26px] cursor-pointer items-center justify-center rounded-full border-0 bg-night px-1.5 font-mono text-[11.5px] font-semibold ${
            strong ? "text-aqua" : "text-muted"
          }`}
        >
          {priority}
        </button>
      )}
      {g ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={g.current === genre}
          title="Exemples, changer de playlist…"
          onClick={(e) => g.open(e.currentTarget, genre)}
          className="cursor-pointer border-0 bg-transparent p-0 text-inherit hover:underline hover:underline-offset-4"
        >
          {genre}
        </button>
      ) : (
        genre
      )}
      <form action={remove}>
        <button
          type="submit"
          aria-label={`Retirer ${genre}`}
          className={`inline-flex size-[26px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:text-ink ${strong ? "text-[#8fd9d1]" : "text-muted"}`}
        >
          <Icon name="x" size={12} strokeWidth={2.4} />
        </button>
      </form>
    </li>
  );
}
