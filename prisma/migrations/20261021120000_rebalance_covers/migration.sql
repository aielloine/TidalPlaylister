-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "pruneMismatched" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProcessedTrack" ADD COLUMN "label" TEXT;
ALTER TABLE "ProcessedTrack" ADD COLUMN "genres" TEXT;
ALTER TABLE "ProcessedTrack" ADD COLUMN "byApp" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PlaylistCover" (
    "playlistId" TEXT NOT NULL PRIMARY KEY,
    "artworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
