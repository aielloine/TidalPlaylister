import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = { title: "Auto Playlister", description: "Range automatiquement vos favoris Tidal dans des playlists, selon leurs genres." };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- chargé une fois pour toute l'app */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="font-sans text-ink antialiased">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
