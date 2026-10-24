"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

// Rangée de boutons qui déplient chacun un panneau sous la rangée (un seul ouvert à la fois).
// Les panneaux fermés restent dans la page (masqués) : formulaires utilisables sans JS, état conservé.
export type Panel = { key: string; label: string; icon: "plus" | "note" | "sparkles" | "headphones"; count?: number; content: React.ReactNode };

export default function Panels({ id, panels, extra, label }: { id: string; panels: Panel[]; extra?: React.ReactNode; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2.5">
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {panels.map((p) => {
          const on = open === p.key;
          return (
            <button
              key={p.key}
              type="button"
              aria-expanded={on}
              aria-controls={`pn-${id}-${p.key}`}
              onClick={() => setOpen(on ? null : p.key)}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${
                on ? "border-aqua/50 bg-aqua/10 text-aqua" : "border-line bg-transparent text-soft hover:border-[#3a414c] hover:text-ink"
              }`}
            >
              <Icon name={p.icon} size={15} strokeWidth={2} />
              {p.label}
              {p.count !== undefined && <span className={`font-mono text-[12px] ${on ? "text-aqua/80" : "text-faint"}`}>{p.count}</span>}
            </button>
          );
        })}
        {extra && <span className="ml-auto flex items-center">{extra}</span>}
      </div>
      {panels.map((p) => (
        <div key={p.key} id={`pn-${id}-${p.key}`} hidden={open !== p.key}>
          {p.content}
        </div>
      ))}
    </div>
  );
}
