# Tidal Playlister

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

« Favoris analysés par passage » : les N favoris les plus récents (300 par défaut), **identique en dry run et en
réel** ; 0 = tous. Les titres déjà classés ne sont pas ré-analysés, donc « tous » reste rapide après le 1er passage.

Sur `/playlists` :
- **Idées de playlists** : après chaque synchro (dry run compris), les favoris restés non classés sont analysés et
  l'appli propose les playlists qui en rangeraient le plus — idées du catalogue (Hip-hop US, Reggae / dancehall,
  Metal, Tekno / free party…) ou playlist au nom d'un genre fréquent. Un clic (ou « Tout créer ») crée la playlist
  sur Tidal et mappe ses tags ; les titres sont rangés à la synchro suivante.
- **Playlists d'ambiance** : le catalogue complet (22 idées, `lib/moods.ts`), chacune crée la playlist et mappe d'un
  coup les tags Last.fm correspondants.
- Un clic sur un **genre détecté non mappé** permet de l'associer à une playlist ou de l'ignorer.

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

## Dev
```sh
pnpm install
pnpm prisma migrate dev   # crée ./data/tidal.db
pnpm dev
pnpm build && pnpm test   # e2e contre un faux serveur Tidal
```
