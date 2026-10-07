import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = { title: "Tidal Playlister" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
