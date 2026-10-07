# Tidal Playlister

Trie automatiquement les titres likés sur Tidal vers des playlists selon leur genre.

## Prérequis Tidal
1. Créer une app sur https://developer.tidal.com/dashboard
2. Scopes : `user.read collection.read collection.write playlists.read playlists.write`
3. Redirect URI : `<NEXTAUTH_URL>/api/tidal/callback` (doit correspondre exactement à l'URL d'accès à l'app)

## Déploiement (NAS)
```sh
cp .env.example .env   # renseigner NEXTAUTH_URL, NEXTAUTH_SECRET (openssl rand -base64 32), TIDAL_CLIENT_ID
docker compose up -d   # ./data doit être inscriptible par l'UID 1000
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
