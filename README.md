# Auto Playlister

Trie automatiquement les titres likés sur Tidal vers des playlists selon leur genre ou leur ambiance.

## Comment un titre est classé
1. **Genres candidats**, du plus fin au plus générique :
   - tags communautaires **Last.fm** du titre (score ≥ 20, triés par score), complétés par ceux de l'artiste si
     le titre en a moins de 3 — nécessite `LASTFM_API_KEY` ;
   - puis le premier repli exploitable : genre de la piste Tidal → genre de l'album Tidal → genres Deezer (ISRC).
     Un repli est sauté s'il a **plus de 4 genres** (compilation) ou si tous ses genres sont ignorés.
2. Les **genres ignorés** (« films/jeux vidéo », « musiques de films »… modifiables sur `/playlists`) sont écartés.
3. Parmi les genres mappés, le **plus prioritaire** gagne (à égalité : le tag Last.fm le mieux noté). Priorité
   automatique : 0 pour un genre générique (pop, electro, dance, rap/hip hop…), 10 sinon.
4. **Doublons** (même ISRC, ou même artiste + titre normalisé) : un seul exemplaire est ajouté à la playlist, tous
   sortent des favoris.

## Favoris : retirer ou conserver
Réglage « Retirer des favoris après classement » sur le dashboard :
- **activé** (défaut) : le titre est déplacé (ajouté à la playlist puis retiré des favoris) ;
- **désactivé** : le titre est copié dans la playlist et reste liké.

Dans les deux cas :
- un titre (ou un de ses doublons) **déjà présent** dans la playlist n'y est pas ré-ajouté ;
- un titre classé est mémorisé : s'il est ensuite **retiré de la playlist à la main**, il n'y revient jamais (même
  re-liké, ou si son mapping change). En mode « retirer », un titre déjà classé encore en favori en est retiré.

**Ranger à nouveau** (réglage, activé par défaut) : à chaque synchro, les titres déjà classés par l'appli sont
ré-évalués avec leurs genres mémorisés. Si un changement de mapping (genre supprimé, réassigné, ignoré…) les mène
ailleurs, ils changent de playlist ; s'ils ne correspondent plus à rien, ils sont retirés de la playlist et remis
en favori. Seules les playlists encore mappées sont concernées, et jamais un titre retiré à la main ou présent
avant l'appli. Les titres classés avant cette fonction sont ré-analysés par lots de 200 par passage ; ceux que
Tidal ne renvoie plus (retirés du catalogue, indisponibles dans le pays) restent dans leur playlist, marqués « genres
inconnus », et ne sont plus jamais déplacés.

« Favoris analysés par passage » : les N favoris les plus récents (300 par défaut), **identique en dry run et en
réel** ; 0 = tous. Les titres déjà classés ne sont pas ré-analysés, donc « tous » reste rapide après le 1er passage.

Sur `/playlists` :
- **Idées de playlists** : après chaque synchro (dry run compris), les favoris restés non classés sont analysés et
  l'appli propose les playlists qui en rangeraient le plus — idées du catalogue (Hip-hop US, Reggae / dancehall,
  Metal, Tekno / free party…) ou playlist au nom d'un genre fréquent. Un clic (ou « Tout créer ») crée la playlist
  sur Tidal et mappe ses tags ; les titres sont rangés à la synchro suivante.
- **Playlists d'ambiance** : le catalogue complet (22 idées, `lib/moods.ts`), chacune crée la playlist et mappe d'un
  coup les tags Last.fm correspondants.
- **Ajouter à…** (idées et ambiances) : met leurs tags encore libres dans une playlist existante au lieu d'en créer une.
- **Fusionner des playlists** : les titres des playlists cochées sont copiés dans la cible (sans doublon), leurs
  genres mappés et le suivi des titres déjà classés passent sur la cible ; les sources peuvent ensuite être
  supprimées sur Tidal (option, désactivée par défaut).
- **Genres détectés non mappés** (repliés derrière un bouton) : un clic sur un genre affiche des exemples à écouter,
  puis permet de l'associer à une playlist ou de l'ignorer.
- **Exemples à écouter** sur chaque idée et chaque ambiance : d'abord vos titres portant ces genres, puis des titres
  connus du genre (Last.fm `tag.getTopTracks`, sinon une playlist Deezer), avec leur extrait de 30 s.
- **Pochettes générées** : chaque playlist gérée (au moins un genre mappé) a sa pochette JPEG 1080 × 1080 : dégradé
  de sa famille de genres, arc Crescendo, badge AUTO, ses 3 genres principaux et son nom (PNG si sharp, fourni
  avec Next, est introuvable). Elle s'affiche partout dans l'appli et se **télécharge** depuis la carte de la playlist : l'API Tidal refuse l'envoi de pochettes aux
  applis tierces (`POST /artworks` → 403 « Access tier is insufficient »), il faut donc l'ajouter à la main depuis
  l'appli Tidal. Polices (Bricolage Grotesque, Geist Mono — OFL) téléchargées une fois depuis jsdelivr dans
  `data/fonts` ; à défaut, police par défaut.

Dans les logs, ▶ joue un **extrait de 30 s** (Deezer, retrouvé par ISRC) et ↗ ouvre le titre dans Tidal. Deux
onglets : **Dernière synchro** et **Titres classés** (tous les titres rangés par l'appli, avec leur playlist,
recherchables). Les titres classés d'une playlist sont aussi listés sous sa carte, sur `/playlists`.

**Tags de genre** : même composant partout (logs, titres classés, genres mappés et non mappés, idées de playlists),
`components/Genres.tsx`. Sur un titre, tous ses genres sont affichés (celui qui décide de sa playlist en tête, en
couleur ; les non mappés en pointillés). Un clic : exemples à écouter, playlist actuelle, **changer de playlist**
(ou démapper, ignorer) et « Filtrer les titres sur ce genre ». Avec « Ranger à nouveau », les titres déjà classés
suivent le nouveau mapping à la synchro suivante (indiqué « → playlist à la prochaine synchro »).

## Prérequis Tidal
1. Créer une app sur https://developer.tidal.com/dashboard
2. Scopes : `user.read collection.read collection.write playlists.read playlists.write`
3. Redirect URI : `<NEXTAUTH_URL>/api/tidal/callback` (doit correspondre exactement à l'URL d'accès à l'app)

## Déploiement (NAS)
Adapter `docker-compose.yml` (domaine, `NEXTAUTH_SECRET`, `TIDAL_CLIENT_ID`, `user` = UID:GID propriétaire de
`${TIDAL_DIR}/data`), puis :
```sh
TIDAL_DIR=/volume1/docker/tidalplaylister docker compose up -d
```
Au premier accès : création du compte admin → « Se connecter à Tidal » → mapper des genres sur `/playlists`
→ lancer un Dry Run depuis le dashboard avant d'activer le mode réel.

## Version
Affichée discrètement en bas à droite : champ `version` de `package.json`, au format `année.mois.n` où `n` est
le numéro de version dans l'année (0, 1, 2…, remis à 0 chaque 1er janvier) — ex. `2026.10.0`, puis `2026.10.1`,
`2026.11.2`, `2027.1.0`. À incrémenter dans chaque PR.

## Dev
```sh
pnpm install
pnpm prisma migrate dev   # crée ./data/tidal.db
pnpm dev
pnpm build && pnpm test   # e2e contre un faux serveur Tidal
```
