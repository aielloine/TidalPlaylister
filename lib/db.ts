import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = (g.prisma ??= new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
}));

export const getSettings = () =>
  prisma.settings.upsert({ where: { id: 1 }, update: {}, create: {} });
