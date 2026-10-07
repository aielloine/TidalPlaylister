import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { prisma } from "./db";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(password, salt, 64));
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(c) {
        const user = c?.username ? await prisma.user.findUnique({ where: { username: c.username } }) : null;
        if (!user || !verifyPassword(c!.password ?? "", user.passwordHash)) return null;
        return { id: String(user.id), name: user.username };
      },
    }),
  ],
};

// Défense en profondeur pour les server actions (le proxy protège déjà les pages).
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}
