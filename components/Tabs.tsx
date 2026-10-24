"use client";

import { useEffect, useState } from "react";

// Onglets ; tous les panneaux sont rendus (les inactifs masqués) pour garder leur état et rester utilisables sans JS.
// hash : l'onglet actif est repris de l'adresse (#cle) et y est noté, pour revenir au même onglet après un rechargement.
export default function Tabs({
  label,
  tabs,
  hash = false,
}: {
  label: string;
  tabs: { key: string; title: React.ReactNode; content: React.ReactNode }[];
  hash?: boolean;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  useEffect(() => {
    if (!hash) return;
    const fromHash = () => {
      const k = window.location.hash.slice(1);
      if (tabs.some((t) => t.key === k)) setActive(k);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les clés ne changent pas
  }, [hash]);
  const select = (k: string) => {
    setActive(k);
    if (hash) history.replaceState(null, "", `#${k}`);
  };
  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        className="tp-noscrollbar flex max-w-full gap-1 self-start overflow-x-auto rounded-full border border-line bg-hollow p-1 max-sm:self-stretch"
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls={`panel-${t.key}`}
              onClick={() => select(t.key)}
              className={`inline-flex h-10 flex-none cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 px-4 text-[13.5px] font-semibold max-sm:flex-1 max-sm:px-3 ${
                on ? "bg-ink text-night" : "bg-transparent text-soft hover:text-ink"
              }`}
            >
              {t.title}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`} hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
