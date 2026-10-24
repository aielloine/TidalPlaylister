"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, Logo, Wordmark } from "@/components/ui";

const links = [
  { href: "/", label: "Dashboard", short: "Dashboard" },
  { href: "/playlists", label: "Playlists & mappings", short: "Playlists" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login" || path === "/setup") return null;
  return (
    <header className="border-b border-[#1b1f26] bg-night/70">
      <div className="mx-auto flex max-w-[1280px] items-center gap-x-7 px-[clamp(12px,3vw,32px)] py-2.5 max-sm:gap-x-2">
        <Link href="/" aria-label="Auto Playlister, accueil" className="flex min-h-11 flex-none items-center gap-2.5 text-ink no-underline">
          <Logo />
          <span className="max-md:hidden">
            <Wordmark />
          </span>
        </Link>
        <nav aria-label="Navigation principale" className="flex min-w-0 gap-1">
          {links.map((l) => {
            const on = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm no-underline max-sm:px-3 ${
                  on ? "bg-aqua/12 font-semibold text-aqua" : "font-medium text-soft hover:bg-white/5"
                }`}
              >
                <span className="max-sm:hidden">{l.label}</span>
                <span className="sm:hidden">{l.short}</span>
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Déconnexion"
          title="Déconnexion"
          className="ml-auto inline-flex min-h-10 flex-none cursor-pointer items-center gap-2 rounded-full border border-line bg-transparent px-3.5 text-sm font-medium text-soft hover:bg-white/5 max-sm:size-10 max-sm:justify-center max-sm:px-0"
        >
          <Icon name="logout" size={16} />
          <span className="max-sm:hidden">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
