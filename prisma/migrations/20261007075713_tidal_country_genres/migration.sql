/*
  Warnings:

  - Added the required column `countryCode` to the `TidalToken` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Genre" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TidalToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tidalUserId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "scope" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TidalToken" ("accessToken", "expiresAt", "id", "refreshToken", "scope", "tidalUserId", "updatedAt") SELECT "accessToken", "expiresAt", "id", "refreshToken", "scope", "tidalUserId", "updatedAt" FROM "TidalToken";
DROP TABLE "TidalToken";
ALTER TABLE "new_TidalToken" RENAME TO "TidalToken";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
