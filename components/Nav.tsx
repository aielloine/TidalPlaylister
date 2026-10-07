"use client";

import { AppBar, Button, Toolbar, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/playlists", label: "Playlists & mappings" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login" || path === "/setup") return null;
  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Toolbar className="gap-2">
        <Typography variant="h6" className="mr-4">
          Tidal Playlister
        </Typography>
        {links.map((l) => (
          <Button key={l.href} component={Link} href={l.href} color={path === l.href ? "primary" : "inherit"}>
            {l.label}
          </Button>
        ))}
        <span className="flex-1" />
        <Button color="inherit" onClick={() => signOut({ callbackUrl: "/login" })}>
          Déconnexion
        </Button>
      </Toolbar>
    </AppBar>
  );
}
