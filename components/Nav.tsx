"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, Logo, Wordmark } from "@/components/ui";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/playlists", label: "Playlists & mappings" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login" || path === "/setup") return null;
  return (
    <header className="border-b border-[#1b1f26] bg-night/70">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-3 px-[clamp(16px,3vw,32px)] py-3">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-ink no-underline">
          <Logo />
          <Wordmark />
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-wrap gap-1">
          {links.map((l) => {
            const on = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm no-underline ${
                  on ? "bg-aqua/12 font-semibold text-aqua" : "font-medium text-soft hover:bg-white/5"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-transparent px-3.5 text-sm font-medium text-soft hover:bg-white/5"
        >
          <Icon name="logout" size={16} />
          Déconnexion
        </button>
      </div>
    </header>
  );
}
