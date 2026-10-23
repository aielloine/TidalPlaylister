"use client";

import { useState } from "react";

// Onglets simples ; tous les panneaux sont rendus (les inactifs masqués) pour garder leur état.
export default function Tabs({ label, tabs }: { label: string; tabs: { key: string; title: React.ReactNode; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 self-start rounded-full border border-line bg-hollow p-1">
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
              onClick={() => setActive(t.key)}
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border-0 px-4 text-[13.5px] font-semibold ${
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
