// Briques visuelles de l'identité « Auto Playlister » (sans état : utilisables côté serveur comme client).

// Arc « Crescendo » : 9 barres qui s'allongent en tournant, de l'aqua au lilas (viewBox 64, centre 32,32).
const ARC: [number, number, number, number, string][] = [
  [28.58, 41.4, 27.21, 45.16, "rgb(46,230,214)"],
  [23.57, 37.37, 18.82, 40.4, "rgb(61,221,219)"],
  [22.04, 31.13, 14.82, 30.5, "rgb(76,211,224)"],
  [24.63, 25.24, 18.08, 19.25, "rgb(91,202,229)"],
  [30.26, 22.15, 28.44, 11.81, "rgb(106,192,234)"],
  [36.62, 23.13, 42.22, 12.37, "rgb(121,183,240)"],
  [41.06, 27.77, 53.52, 21.96, "rgb(136,174,245)"],
  [41.76, 34.16, 56.77, 37.49, "rgb(151,164,250)"],
  [38.43, 39.66, 49.36, 52.68, "rgb(166,155,255)"],
];

// color : tuile sombre + dégradé ; mono : #eef1f5 sans tuile ; ink : encre sombre #071a1e sans tuile (sur dégradé).
export type LogoVariant = "color" | "mono" | "ink";
export function Logo({ size = 32, variant = "color", className = "" }: { size?: number; variant?: LogoVariant; className?: string }) {
  const flat = variant === "mono" ? "#eef1f5" : variant === "ink" ? "#071a1e" : null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`flex-none ${className}`}>
      {variant === "color" && <rect x="1" y="1" width="62" height="62" rx="18" fill="#14171c" stroke="#2a303a" strokeWidth="1.5" />}
      <g strokeWidth="4.6" strokeLinecap="round">
        {ARC.map(([x1, y1, x2, y2, c]) => (
          <line key={c} x1={x1} y1={y1} x2={x2} y2={y2} stroke={flat ?? c} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span className="font-display font-bold tracking-[-0.02em] text-ink" style={{ fontSize: size }}>
      <span className="font-[450] text-dim">Auto</span> Playlister
    </span>
  );
}

// Pochette générée (même rendu que le JPEG téléchargeable), réduite à la taille d'affichage.
export const coverSrc = (name: string, sub = "", w?: number) =>
  `/api/cover?name=${encodeURIComponent(name)}${sub ? `&sub=${encodeURIComponent(sub)}` : ""}${w ? `&w=${w}` : ""}`;

export function Cover({ name, sub = "", size = 52, className = "" }: { name: string; sub?: string; size?: number; className?: string }) {
  // 2× pour les écrans haute densité, arrondi à un palier pour partager le cache.
  const w = [64, 128, 256, 512].find((x) => x >= size * 2) ?? 1080;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image générée par l'appli, pas d'optimiseur nécessaire
    <img
      src={coverSrc(name, sub, w)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`flex-none ${className}`}
      style={{ width: size, height: size, borderRadius: Math.max(3, Math.round(size * 0.035)), boxShadow: size >= 80 ? "0 14px 30px -16px rgba(0,0,0,0.8)" : undefined }}
    />
  );
}

// Playlist non gérée par l'appli (aucun genre mappé) : pas de pochette générée, simple tuile neutre.
export function PlainCover({ size = 52 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center border border-line bg-tag text-faint"
      style={{ width: size, height: size, borderRadius: Math.max(3, Math.round(size * 0.035)) }}
    >
      <Icon name="note" size={Math.max(12, Math.round(size * 0.4))} />
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
  merge: (
    <>
      <path d="M6 4v4a6 6 0 0 0 6 6" />
      <path d="M18 4v4a6 6 0 0 1-6 6v6" />
      <path d="M9 17l3 3 3-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 20h14" />
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
