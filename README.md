# Tidal Playlister

Trie automatiquement les titres likés sur Tidal vers des playlists selon leur genre.

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
