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

Sur `/playlists`, des **playlists d'ambiance** prêtes à l'emploi (Rap FR, Électro chill, Indie / folk calme,
Dance / festival, Pop / tubes) créent la playlist et mappent d'un coup les tags Last.fm correspondants.

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
