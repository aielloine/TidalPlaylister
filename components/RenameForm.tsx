"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

// Nom renommable en place : le crayon remplace le nom par un champ (Entrée pour enregistrer, Échap pour annuler,
// quitter le champ enregistre s'il a changé). Le formulaire est toujours rendu : envoyable sans JS avec un champ name.
export default function RenameForm({
  name,
  action,
  label,
  hint,
  as: Tag = "span",
  className = "",
}: {
  name: string;
  action: (f: FormData) => Promise<void>;
  label: string; // ex. « Renommer Rock »
  hint?: string;
  as?: "span" | "h3";
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <form action={action} aria-label={label} onSubmit={() => setEditing(false)} className="flex min-w-0 max-w-full items-center gap-1">
      {editing ? (
        <input
          name="name"
          defaultValue={name}
          maxLength={100}
          aria-label={`Nouveau nom (${name})`}
          title={hint}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => (e.target.value.trim() === name ? setEditing(false) : e.target.form?.requestSubmit())}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className={`h-9 min-w-0 w-[min(320px,100%)] rounded-xl border border-aqua bg-hollow px-2.5 text-[15px] font-semibold text-ink outline-none ${className}`}
        />
      ) : (
        <>
          <Tag className={`m-0 min-w-0 ${className}`}>{name}</Tag>
          <button
            type="button"
            title={hint ? `${label} — ${hint}` : label}
            aria-label={label}
            onClick={() => setEditing(true)}
            className="inline-flex size-7 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-faint hover:bg-tag hover:text-ink"
          >
            <Icon name="pencil" size={14} strokeWidth={2} />
          </button>
        </>
      )}
    </form>
  );
}
