"use client";

import { useState } from "react";

// Ligne compacte (tête + actions) avec un chevron qui déplie des détails en dessous, sur toute la largeur.
// Les détails fermés restent dans la page (masqués) : formulaires utilisables sans JS.
export default function ExpandRow({
  head,
  actions,
  body,
  label,
  className = "",
}: {
  head: React.ReactNode;
  actions?: React.ReactNode;
  body: React.ReactNode;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        {head}
        <div className="flex flex-none items-center gap-1">
          {actions}
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Masquer les détails" : "Détails"} : ${label}`}
            title={open ? "Masquer les détails" : "Tags, exemples et autres options"}
            onClick={() => setOpen(!open)}
            className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-full border-0 ${open ? "bg-tag text-ink" : "bg-transparent text-muted hover:bg-tag hover:text-ink"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className={open ? "rotate-180" : ""}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div hidden={!open} className="pt-3">
        {body}
      </div>
    </div>
  );
}
