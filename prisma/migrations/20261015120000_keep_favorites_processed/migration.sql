-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "removeFromFavorites" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "scanLimit" INTEGER NOT NULL DEFAULT 300;

-- CreateTable
CREATE TABLE "ProcessedTrack" (
    "trackId" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
