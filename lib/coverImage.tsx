// Pochettes générées (PNG 1080 × 1080) pour les playlists : dégradé propre à chaque type de playlist, sillons de
// vinyle, nom en Bricolage Grotesque, et bandeau « Tidal Playlister » pour reconnaître d'un coup d'œil les
// playlists gérées par l'appli.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ImageResponse } from "next/og";
import { coverColors } from "./covers";

export const COVER_SIZE = 1080;

// Polices téléchargées une fois (jsdelivr, licence OFL) puis gardées à côté de la base. Si le téléchargement
// échoue, next/og utilise sa police par défaut : la pochette reste générée.
const FONT_CDN = process.env.COVER_FONT_CDN ?? "https://cdn.jsdelivr.net/npm";
const FONTS = [
  { name: "Bricolage", weight: 800 as const, pkg: "@fontsource/bricolage-grotesque@5.3.0", file: "bricolage-grotesque-latin-800-normal.woff" },
  { name: "Geist", weight: 600 as const, pkg: "@fontsource/geist-sans@5.3.0", file: "geist-sans-latin-600-normal.woff" },
];
const g = globalThis as unknown as { coverFonts?: Promise<{ name: string; data: ArrayBuffer; weight: 800 | 600 }[]> };

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
    const ok = list.filter((f): f is { name: string; weight: 800 | 600; data: ArrayBuffer } => !!f.data);
    if (ok.length < FONTS.length) g.coverFonts = undefined; // réessayé à la prochaine pochette
    return ok;
  });
  return g.coverFonts;
}

// Texte sombre sur dégradé clair, blanc sur dégradé sombre.
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

const titleSize = (name: string) => (name.length <= 8 ? 168 : name.length <= 14 ? 136 : name.length <= 22 ? 112 : 92);

// subtitle : quelques genres de la playlist (ex. « french house · nu disco · chillwave »).
export async function renderCover(name: string, subtitle = ""): Promise<Buffer> {
  const [a, b] = coverColors(name);
  const dark = (luminance(a) + luminance(b)) / 2 > 0.33;
  const ink = dark ? "#0b0d10" : "#ffffff";
  const soft = dark ? "rgba(11,13,16,0.62)" : "rgba(255,255,255,0.78)";
  const ring = dark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.18)";
  const fontList = await fonts();
  // Police absente (téléchargement impossible) : propriété omise, une valeur undefined fait planter le rendu.
  const font = (n: string) => (fontList.some((f) => f.name === n) ? { fontFamily: n } : {});
  const S = COVER_SIZE;

  const img = new ImageResponse(
    (
      <div style={{ width: S, height: S, display: "flex", position: "relative", overflow: "hidden", background: `linear-gradient(140deg, ${a}, ${b})` }}>
        {/* sillons de vinyle */}
        {[1300, 1060, 820, 580].map((d) => (
          <div
            key={d}
            style={{ position: "absolute", width: d, height: d, right: -d / 2 + 120, bottom: -d / 2 + 120, borderRadius: d, border: `3px solid ${ring}` }}
          />
        ))}
        <div style={{ position: "absolute", left: 88, top: 88, right: 88, bottom: 88, display: "flex", flexDirection: "column" }}>
          {/* égaliseur rangé par taille : le logo de l'appli */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 22, height: 220 }}>
            {[0.36, 0.55, 0.77, 1].map((h) => (
              <div key={h} style={{ width: 52, height: 220 * h, borderRadius: 26, background: dark ? "rgba(11,13,16,0.72)" : "rgba(255,255,255,0.9)" }} />
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              ...font("Bricolage"),
              fontWeight: 800,
              fontSize: titleSize(name),
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: ink,
            }}
          >
            {name}
          </div>
          {subtitle && (
            <div style={{ display: "flex", marginTop: 26, ...font("Geist"), fontWeight: 600, fontSize: 40, color: soft }}>{subtitle}</div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 56,
              paddingTop: 30,
              borderTop: `3px solid ${soft}`,
              ...font("Geist"),
              fontWeight: 600,
              fontSize: 34,
              letterSpacing: "0.14em",
              color: soft,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 34 }}>
              {[0.36, 0.55, 0.77, 1].map((h) => (
                <div key={h} style={{ width: 8, height: 34 * h, borderRadius: 4, background: soft }} />
              ))}
            </div>
            TIDAL PLAYLISTER
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
