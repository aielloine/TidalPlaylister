// Catalogue de playlists prêtes à l'emploi : plusieurs tags (Last.fm surtout, quelques genres Tidal/Deezer) vers
// une même playlist. Les tags spécifiques ont la priorité de l'ambiance, les génériques une priorité de 1 pour ne
// servir que de filet. Un tag déjà mappé ailleurs n'est jamais réassigné.
// ⚠️ ordre stable : l'index sert d'identifiant aux formulaires (applyMood). Ajouter à la fin.
export type Mood = { name: string; priority: number; tags: string[]; generic?: string[]; colors: [string, string] };

export const MOODS: Mood[] = [
  {
    name: "Rap FR",
    priority: 30,
    tags: ["french rap", "rap francais", "rap français", "french hip-hop", "french hip hop", "rap fr"],
    colors: ["#ff8a5b", "#ff4f7a"],
  },
  {
    name: "Électro chill",
    priority: 20,
    tags: ["chillwave", "chillout", "chill", "downtempo", "future garage", "chillstep", "french electro", "french touch", "french house", "nu disco", "deep house"],
    generic: ["electronic", "electro", "electronica"],
    colors: ["#2ee6d6", "#4f7cff"],
  },
  {
    name: "Indie / folk calme",
    priority: 20,
    tags: ["indie folk", "folk pop", "acoustic", "singer-songwriter", "mellow", "americana", "sad", "chamber pop"],
    generic: ["folk", "indie"],
    colors: ["#e8c27a", "#7fb069"],
  },
  {
    name: "Dance / festival",
    priority: 15,
    tags: ["edm", "progressive house", "big room", "electro house", "tropical house", "future bass", "melodic dubstep", "dubstep", "party", "festival"],
    generic: ["dance", "house"],
    colors: ["#a69bff", "#ff5fd2"],
  },
  {
    name: "Pop / tubes",
    priority: 10,
    tags: ["dance pop", "dance-pop", "electropop", "synthpop", "eurovision", "pop rock", "catchy", "power pop"],
    generic: ["pop"],
    colors: ["#ffd84d", "#ff8a5b"],
  },
  {
    name: "Hip-hop US",
    priority: 20,
    tags: ["trap", "gangsta rap", "east coast rap", "west coast rap", "dirty south", "underground hip-hop", "underground hip hop", "old school", "hardcore hip hop", "boom bap", "conscious hip hop", "southern rap", "cloud rap", "soundcloud rap"],
    generic: ["hip-hop", "hip hop", "rap", "rap/hip hop", "rapper"],
    colors: ["#ffb36b", "#c2410c"],
  },
  {
    name: "Reggae / dancehall",
    priority: 20,
    tags: ["reggae", "roots reggae", "dancehall", "dub", "ska", "ragga", "dancehall/ragga", "reggae fusion", "lovers rock", "jamaica"],
    colors: ["#4ade80", "#f5b544"],
  },
  {
    name: "Rock classique",
    priority: 15,
    tags: ["classic rock", "hard rock", "southern rock", "blues rock", "psychedelic rock", "progressive rock", "60s", "70s", "british invasion", "rock and roll"],
    generic: ["rock", "blues"],
    colors: ["#ffb36b", "#e0533a"],
  },
  {
    name: "Metal",
    priority: 20,
    tags: ["heavy metal", "power metal", "black metal", "death metal", "thrash metal", "nu metal", "alternative metal", "metalcore", "viking metal", "pagan metal", "folk metal", "symphonic metal", "progressive metal", "viking rock"],
    generic: ["metal"],
    colors: ["#9aa4b2", "#3a414c"],
  },
  {
    name: "Punk / rock indé",
    priority: 15,
    tags: ["punk", "punk rock", "pop punk", "post-punk", "garage rock", "indie rock", "emo", "shoegaze", "rock indé", "alternative rock", "grunge"],
    generic: ["alternative", "alternatif"],
    colors: ["#ff5fd2", "#ff6b6b"],
  },
  {
    name: "Tekno / free party",
    priority: 25,
    tags: ["hardtek", "tekno", "tekkno", "tribe", "acid tekno", "frenchcore", "tribecore", "raggatek", "hardcore techno", "free party"],
    colors: ["#a3e635", "#0f766e"],
  },
  {
    name: "Hardstyle / hardcore",
    priority: 25,
    tags: ["hardstyle", "euphoric hardstyle", "rawstyle", "happy hardcore", "uk hardcore", "gabber", "hardcore", "j-core", "makina"],
    colors: ["#ff4f7a", "#6b4bff"],
  },
  {
    name: "Jazz, soul & funk",
    priority: 15,
    tags: ["smooth jazz", "latin jazz", "bossa nova", "neo-soul", "neo soul", "jazz funk", "nu jazz", "motown", "soul & funk", "acid jazz"],
    generic: ["jazz", "soul", "funk"],
    colors: ["#9db8ff", "#5b6cf0"],
  },
  {
    name: "R&B",
    priority: 20,
    tags: ["rnb", "r&b", "contemporary r&b", "french rnb", "rnb français", "slow jam"],
    colors: ["#c084fc", "#7c3aed"],
  },
  {
    name: "Afro",
    priority: 25,
    tags: ["afrobeats", "afrobeat", "afro trap", "afropop", "amapiano", "azonto", "coupé-décalé", "african", "nigerian", "nigeria", "ghana", "mali", "musique africaine"],
    colors: ["#f5b544", "#16a34a"],
  },
  {
    name: "Latino",
    priority: 20,
    tags: ["reggaeton", "salsa", "cumbia", "bachata", "latin", "cuban", "latin pop", "brazilian funk", "baile funk", "brazilian", "brazil", "brasil"],
    generic: ["latino"],
    colors: ["#ff8a5b", "#facc15"],
  },
  {
    name: "Chanson française",
    priority: 15,
    tags: ["chanson française", "chanson francaise", "chanson", "variété française", "variété", "french pop"],
    colors: ["#60a5fa", "#ef4444"],
  },
  {
    name: "Années 80",
    priority: 12,
    tags: ["80s", "new wave", "italo disco", "new romantic", "synth-pop"],
    colors: ["#ff5fd2", "#22d3ee"],
  },
  {
    name: "J-pop, K-pop & Asie",
    priority: 20,
    tags: ["j-pop", "jpop", "j-rock", "jrock", "k-pop", "kpop", "japanese", "anime", "denpa", "japanese hip-hop", "city pop", "musique asiatique", "touhou", "vocaloid"],
    colors: ["#fda4af", "#e11d48"],
  },
  {
    name: "Lo-fi & beats",
    priority: 20,
    tags: ["lo-fi", "lofi", "lo-fi hip hop", "chillhop", "jazzhop", "instrumental hip hop", "beats"],
    colors: ["#e8c27a", "#a16207"],
  },
  {
    name: "Classique & BO",
    priority: 15,
    tags: ["classical", "classique", "soundtrack", "score", "contemporary classical", "composer", "orchestral", "piano", "violin"],
    colors: ["#e5e7eb", "#9ca3af"],
  },
  {
    name: "Ambient / ondes calmes",
    priority: 15,
    tags: ["ambient", "dark ambient", "drone", "meditation", "sleep", "new age", "psychedelic"],
    colors: ["#5eead4", "#1e3a8a"],
  },
];

export const moodTags = (m: Mood): [string, number][] => [
  ...m.tags.map((t): [string, number] => [t, m.priority]),
  ...(m.generic ?? []).map((t): [string, number] => [t, 1]),
];
