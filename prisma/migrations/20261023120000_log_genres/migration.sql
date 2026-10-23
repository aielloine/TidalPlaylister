-- Logs : tous les genres du titre (tableau JSON), affichés et cliquables même quand il a été classé.
ALTER TABLE "LogEntry" ADD COLUMN "genres" TEXT;
