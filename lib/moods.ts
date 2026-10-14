// Playlists d'ambiance prêtes à l'emploi : plusieurs tags (Last.fm surtout, quelques genres Deezer) vers une
// même playlist. Les tags spécifiques ont la priorité de l'ambiance, les génériques une priorité de 1 pour ne
// servir que de filet. Un tag déjà mappé ailleurs n'est jamais réassigné.
export type Mood = { name: string; priority: number; tags: string[]; generic?: string[] };

export const MOODS: Mood[] = [
  {
    name: "Rap FR",
    priority: 30,
    tags: ["french rap", "rap francais", "rap français", "french hip-hop", "french hip hop", "rap fr"],
  },
  {
    name: "Électro chill",
    priority: 20,
    tags: ["chillwave", "chillout", "chill", "downtempo", "future garage", "chillstep", "french electro", "french touch", "french house", "nu disco", "deep house"],
    generic: ["electronic", "electro", "electronica"],
  },
  {
    name: "Indie / folk calme",
    priority: 20,
    tags: ["indie folk", "folk pop", "acoustic", "singer-songwriter", "mellow", "americana", "sad", "chamber pop"],
    generic: ["folk", "indie"],
  },
  {
    name: "Dance / festival",
    priority: 15,
    tags: ["edm", "progressive house", "big room", "electro house", "tropical house", "future bass", "melodic dubstep", "dubstep", "party", "festival"],
    generic: ["dance", "house"],
  },
  {
    name: "Pop / tubes",
    priority: 10,
    tags: ["dance pop", "dance-pop", "electropop", "synthpop", "eurovision", "pop rock", "catchy"],
    generic: ["pop"],
  },
];
