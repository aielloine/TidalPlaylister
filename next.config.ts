import type { NextConfig } from "next";
import pkg from "./package.json";

// Version affichée en bas à droite : « version » de package.json (année.mois.n° de version de l'année).
export default { output: "standalone", env: { NEXT_PUBLIC_APP_VERSION: pkg.version } } satisfies NextConfig;
