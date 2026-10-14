-- AlterTable
ALTER TABLE "Mapping" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN "ignoredGenres" TEXT NOT NULL DEFAULT 'films/jeux vidéo,musiques de films,seen live,favorites,favourites';

-- Mappings existants : le spécifique passe avant le générique (cf. defaultPriority dans lib/genres.ts).
UPDATE "Mapping" SET "priority" = 10 WHERE "genre" NOT IN (
  'pop', 'rock', 'electro', 'electronic', 'electronica', 'dance', 'rap/hip hop', 'hip-hop', 'hip hop', 'rap',
  'alternative', 'alternatif', 'indie', 'r&b', 'soul & funk', 'jazz', 'classique', 'classical', 'metal', 'folk',
  'country', 'reggae', 'latino', 'world', 'variété', 'variété française', 'chanson française', 'musique africaine'
);
