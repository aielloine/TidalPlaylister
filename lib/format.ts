// Dates « humaines » du dashboard (fuseau du serveur, comme le cron).
const HM = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export const hm = (d: Date) => HM.format(d);
export const hms = (d: Date) => d.toLocaleTimeString("fr-FR");
export const int = (n: number) => n.toLocaleString("fr-FR");

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// « Aujourd'hui », « Demain », « Hier » ou « lun. 26 oct. ».
export function dayLabel(d: Date, now = new Date()) {
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return DAY.format(d);
}

export const dayTime = (d: Date) => `${dayLabel(d)}, ${hm(d)}`;

function span(ms: number) {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return "moins d'une minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${String(min % 60).padStart(2, "0")}` : `${h} h`;
  const days = Math.round(h / 24);
  return `${days} jour${days > 1 ? "s" : ""}`;
}

export const ago = (d: Date, now = new Date()) => (now.getTime() - d.getTime() < 60_000 ? "à l'instant" : `il y a ${span(now.getTime() - d.getTime())}`);
export const until = (d: Date, now = new Date()) => `dans ${span(d.getTime() - now.getTime())}`;

export function duration(from: Date, to: Date) {
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}
