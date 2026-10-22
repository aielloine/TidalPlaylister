// Pochettes générées (JPEG 1080 × 1080) des playlists gérées : dégradé de la famille de genres, halo, arc
// Crescendo fixe (signature), badge AUTO, 3 genres en mono et nom en Bricolage Grotesque.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { ImageResponse } from "next/og";
import { coverColors } from "./covers";

// sharp (encodage JPEG, réduction) est déjà installé avec Next, qui s'en sert pour next/image et l'embarque dans la
// sortie standalone : on le charge depuis le dossier de next plutôt que d'en faire une dépendance de plus.
type SharpImage = { resize(w: number, h: number): SharpImage; jpeg(o: { quality: number; mozjpeg?: boolean }): SharpImage; toBuffer(): Promise<Buffer> };
const gs = globalThis as unknown as { sharp?: (input: Buffer) => SharpImage };
const sharp = (input: Buffer) => (gs.sharp ??= createRequire(join(process.cwd(), "node_modules", "next", "package.json"))("sharp"))(input);

export const COVER_SIZE = 1080;

// Polices téléchargées une fois (jsdelivr, licence OFL) puis gardées à côté de la base. Si le téléchargement
// échoue, next/og utilise sa police par défaut : la pochette reste générée.
const FONT_CDN = process.env.COVER_FONT_CDN ?? "https://cdn.jsdelivr.net/npm";
type FontName = "Bricolage" | "GeistMono";
const FONTS: { name: FontName; weight: 500 | 600 | 800; pkg: string; file: string }[] = [
  { name: "Bricolage", weight: 800, pkg: "@fontsource/bricolage-grotesque@5.3.0", file: "bricolage-grotesque-latin-800-normal.woff" },
  { name: "GeistMono", weight: 500, pkg: "@fontsource/geist-mono@5.3.0", file: "geist-mono-latin-500-normal.woff" },
  { name: "GeistMono", weight: 600, pkg: "@fontsource/geist-mono@5.3.0", file: "geist-mono-latin-600-normal.woff" },
];
type Font = { name: FontName; weight: 500 | 600 | 800; data: ArrayBuffer };
const g = globalThis as unknown as { coverFonts?: Promise<Font[]> };

const fontDir = () => join(dirname((process.env.DATABASE_URL ?? "file:./data/tidal.db").replace(/^file:/, "")), "fonts");

async function loadFont(f: (typeof FONTS)[number]) {
  const path = join(fontDir(), f.file);
  try {
    const buf = await readFile(path);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {}
  if (!FONT_CDN) return null;
  try {
    const res = await fetch(`${FONT_CDN}/${f.pkg}/files/${f.file}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    await mkdir(fontDir(), { recursive: true }).catch(() => {});
    await writeFile(path, Buffer.from(data)).catch(() => {});
    return data;
  } catch (e) {
    console.warn(`[cover] police ${f.file} indisponible (${(e as Error).message}) : police par défaut`);
    return null;
  }
}

function fonts() {
  g.coverFonts ??= Promise.all(FONTS.map(async (f) => ({ name: f.name, weight: f.weight, data: await loadFont(f) }))).then((list) => {
    const ok = list.filter((f): f is Font => !!f.data);
    if (ok.length < FONTS.length) g.coverFonts = undefined; // réessayé à la prochaine pochette
    return ok;
  });
  return g.coverFonts;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g2, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g2 + 0.0722 * b;
}

// Sous-titre : les 3 genres les plus prioritaires, dans l'ordre où ils ont été mappés (= ordre du catalogue).
export const coverSub = (mappings: { genre: string; priority: number; id: number }[]) =>
  [...mappings]
    .sort((a, b) => b.priority - a.priority || a.id - b.id)
    .slice(0, 3)
    .map((m) => m.genre)
    .join(" · ");

// Arc Crescendo : 13 barres à angle fixe (263° + 25°·i depuis le haut, sens horaire), longueur 0,03 S → 0,21 S,
// opacité 0,55 → 0,95, autour du centre (0,80 S ; 0,24 S) à partir d'un rayon intérieur de 0,13 S.
function arcLines(S: number) {
  const cx = S * 0.8, cy = S * 0.24, rr = S * 0.13, w = S * 0.034;
  return Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const l = S * (0.03 + 0.18 * t);
    const a = ((263 + 25 * i) * Math.PI) / 180;
    const [dx, dy] = [Math.sin(a), -Math.cos(a)];
    // Les bouts arrondis débordent de w/2 : on raccourcit le trait pour garder la longueur totale l.
    const r0 = rr + Math.min(w, l) / 2, r1 = rr + l - Math.min(w, l) / 2;
    return { x1: cx + dx * r0, y1: cy + dy * r0, x2: cx + dx * r1, y2: cy + dy * r1, o: 0.55 + 0.4 * t, w };
  });
}

// Mini-logo du badge (viewBox 64).
const MINI: [number, number, number, number][] = [
  [28.58, 41.4, 27.21, 45.16],
  [23.57, 37.37, 18.82, 40.4],
  [22.04, 31.13, 14.82, 30.5],
  [24.63, 25.24, 18.08, 19.25],
  [30.26, 22.15, 28.44, 11.81],
  [36.62, 23.13, 42.22, 12.37],
  [41.06, 27.77, 53.52, 21.96],
  [41.76, 34.16, 56.77, 37.49],
  [38.43, 39.66, 49.36, 52.68],
];

const r1 = (n: number) => Math.round(n * 10) / 10;

// subtitle : quelques genres de la playlist (ex. « french house · nu disco · chillwave »).
async function renderPng(name: string, subtitle: string): Promise<Buffer> {
  const [a, b] = coverColors(name);
  const dark = luminance(a) < 0.1; // dégradé sombre (ex. synthwave) : encre claire, badge inversé
  const ink = dark ? "#fdf0ff" : "#0b0d10";
  const fontList = await fonts();
  // Police absente (téléchargement impossible) : propriété omise, une valeur undefined fait planter le rendu.
  const font = (n: FontName) => (fontList.some((f) => f.name === n) ? { fontFamily: n } : {});
  const S = COVER_SIZE;
  const pad = Math.round(S * 0.07);
  const ic = Math.round(S * 0.05);

  const img = new ImageResponse(
    (
      <div
        style={{
          width: S,
          height: S,
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundImage: `radial-gradient(${Math.round(S * 0.9)}px ${Math.round(S * 0.7)}px at 85% 15%, rgba(255,255,255,${dark ? 0.1 : 0.28}), transparent 60%), linear-gradient(150deg, ${a}, ${b})`,
        }}
      >
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: "absolute", left: 0, top: 0 }}>
          {arcLines(S).map((l, i) => (
            <line key={i} x1={r1(l.x1)} y1={r1(l.y1)} x2={r1(l.x2)} y2={r1(l.y2)} stroke={ink} strokeOpacity={l.o.toFixed(2)} strokeWidth={r1(l.w)} strokeLinecap="round" />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            display: "flex",
            alignItems: "center",
            gap: Math.round(S * 0.015),
            height: Math.round(S * 0.085),
            padding: `0 ${Math.round(S * 0.03)}px`,
            borderRadius: 999,
            background: dark ? "rgba(253,240,255,0.92)" : "rgba(11,13,16,0.86)",
            color: a,
            ...font("GeistMono"),
            fontWeight: 600,
            fontSize: r1(S * 0.036),
            letterSpacing: "0.1em",
          }}
        >
          <svg width={ic} height={ic} viewBox="0 0 64 64">
            {MINI.map(([x1, y1, x2, y2]) => (
              <line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a} strokeWidth={6} strokeLinecap="round" />
            ))}
          </svg>
          AUTO
        </div>
        <div style={{ position: "absolute", left: pad, right: pad, bottom: pad, display: "flex", flexDirection: "column", gap: Math.round(S * 0.02), color: ink }}>
          {subtitle && (
            <div
              style={{
                display: "block",
                ...font("GeistMono"),
                fontWeight: 500,
                fontSize: r1(S * 0.036),
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                opacity: 0.78,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          )}
          <div
            style={{
              display: "block",
              ...font("Bricolage"),
              fontWeight: 800,
              fontSize: r1(S * 0.115),
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              lineClamp: 2,
              overflow: "hidden",
            }}
          >
            {name}
          </div>
        </div>
      </div>
    ),
    {
      width: S,
      height: S,
      // Liste vide = aucune police : on laisse alors next/og utiliser sa police intégrée (Noto Sans).
      ...(fontList.length ? { fonts: fontList.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: "normal" as const })) } : {}),
    },
  );
  return Buffer.from(await img.arrayBuffer());
}

// JPEG pleine taille (téléchargement) ou réduit à `width` px (affichage dans l'appli).
export async function renderCover(name: string, subtitle = "", width = COVER_SIZE): Promise<Buffer> {
  const png = await renderPng(name, subtitle);
  const img = sharp(png);
  if (width < COVER_SIZE) img.resize(width, width);
  return img.jpeg({ quality: width < COVER_SIZE ? 82 : 90, mozjpeg: true }).toBuffer();
}
