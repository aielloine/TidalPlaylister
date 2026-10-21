import { MOODS } from "./moods";

// Pochettes générées : dégradé de la famille de genres (couleurs du catalogue si le nom y figure, sinon dérivé du nom).
const PALETTE: [string, string][] = [
  ["#2ee6d6", "#4f7cff"],
  ["#ff8a5b", "#ff4f7a"],
  ["#a69bff", "#ff5fd2"],
  ["#ffd84d", "#ff8a5b"],
  ["#e8c27a", "#7fb069"],
  ["#9db8ff", "#5b6cf0"],
  ["#ffb36b", "#e0533a"],
  ["#ff5fd2", "#6b4bff"],
  ["#4ade80", "#0ea5e9"],
  ["#fda4af", "#e11d48"],
  ["#2a1650", "#c2389e"], // sombre (synthwave) : encre claire sur la pochette
];

export function coverColors(name: string): [string, string] {
  const mood = MOODS.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
  if (mood) return mood.colors;
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const coverGradient = (name: string) => {
  const [a, b] = coverColors(name);
  return `linear-gradient(150deg, ${a}, ${b})`;
};
