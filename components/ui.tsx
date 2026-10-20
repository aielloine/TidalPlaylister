// Briques visuelles de l'identité « l'onde triée » (sans état : utilisables côté serveur comme client).
import { coverGradient } from "@/lib/covers";

export function Logo({ size = 32, id = "tp-logo" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="7" y1="24" x2="25" y2="8">
          <stop offset="0" stopColor="#2ee6d6" />
          <stop offset="1" stopColor="#a69bff" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#14171c" stroke="#2a303a" />
      <rect x="7" y="18" width="3" height="6" rx="1.5" fill={`url(#${id})`} />
      <rect x="12" y="15" width="3" height="9" rx="1.5" fill={`url(#${id})`} />
      <rect x="17" y="11.5" width="3" height="12.5" rx="1.5" fill={`url(#${id})`} />
      <rect x="22" y="8" width="3" height="16" rx="1.5" fill={`url(#${id})`} />
    </svg>
  );
}

export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span className="font-display font-semibold tracking-tight" style={{ fontSize: size }}>
      Tidal Playlister
    </span>
  );
}

// Sillons de vinyle par-dessus le dégradé.
const RINGS =
  "radial-gradient(circle at 105% 105%, transparent 0 34%, rgba(255,255,255,0.22) 34.5% 35.5%, transparent 36% 50%, rgba(255,255,255,0.16) 50.5% 51.5%, transparent 52%)";

// Pochette générée : dégradé dérivé du nom + 4 barres d'égaliseur rangées par taille.
export function Cover({ name, size = 52, rings = false }: { name: string; size?: number; rings?: boolean }) {
  const bar = Math.max(3, Math.round(size / 20));
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-end box-border"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.18),
        background: rings ? `${RINGS}, ${coverGradient(name)}` : coverGradient(name),
        gap: Math.max(2, Math.round(size / 28)),
        padding: Math.round(size * 0.15),
        boxShadow: size >= 80 ? "0 14px 30px -16px rgba(0,0,0,0.8)" : undefined,
      }}
    >
      {[0.09, 0.14, 0.19, 0.24].map((h) => (
        <span key={h} style={{ width: bar, height: Math.round(size * h), borderRadius: 2, background: "rgba(11,13,16,0.5)" }} />
      ))}
    </span>
  );
}

// Surtitre en capitales espacées.
export const Overline = ({ children, as: Tag = "span" }: { children: React.ReactNode; as?: "span" | "h2" }) => (
  <Tag className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</Tag>
);

export const SectionTitle = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2 id={id} className="m-0 font-display text-[21px] font-semibold tracking-tight">
    {children}
  </h2>
);

const PILL = {
  ok: "bg-ok/12 text-[#6ee7a0]",
  aqua: "bg-aqua/12 text-aqua",
  lilac: "bg-lilac/14 text-lilac-soft",
  amber: "bg-amber/13 text-amber",
  coral: "bg-coral/15 text-[#ff8a8a]",
  neutral: "bg-tag text-soft font-medium",
} as const;
export type PillTone = keyof typeof PILL;

// Chip d'état (succès, réel, dry run…) ; dot = pastille, pulse = animée.
export function Pill({ tone = "neutral", dot, pulse, children }: { tone?: PillTone; dot?: string; pulse?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold ${PILL[tone]}`}>
      {dot && <span className={`size-[7px] rounded-full ${pulse ? "tp-pulse" : ""}`} style={{ background: dot }} />}
      {children}
    </span>
  );
}

export const Mono = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`font-mono ${className}`}>{children}</span>
);

export const CronChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex h-[26px] items-center rounded-lg border border-line bg-hollow px-2.5 font-mono text-[12.5px] text-soft">{children}</span>
);

// Icônes au trait (24 × 24), couleur héritée.
const ICONS = {
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H10" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sort: (
    <>
      <path d="M4 6h10" />
      <path d="M4 12h10" />
      <path d="M4 18h6" />
      <path d="M18 8v12" />
      <path d="M15 17l3 3 3-3" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="5" height="7" rx="2" />
      <rect x="16" y="14" width="5" height="7" rx="2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10 10 0 0 1 22 12a17 17 0 0 1-3 3.6" />
      <path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
} as const;

export function Icon({ name, size = 18, className = "", strokeWidth = 1.8 }: { name: keyof typeof ICONS; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      {ICONS[name]}
    </svg>
  );
}

export const PlayIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
  </svg>
);
