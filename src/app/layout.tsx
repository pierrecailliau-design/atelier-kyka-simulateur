import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Adresse publique du site : sert aux aperçus de partage (WhatsApp, iMessage, LinkedIn). À remplacer par le domaine final.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://simulateur-atelier-kyka-one.vercel.app";
const TITRE = "Simulateur Atelier Kyka — menuiserie sur mesure";
const DESCRIPTION = "Décrivez votre dressing, placard, cuisine ou fenêtres : nous le dessinons en 3D et vous donnons une estimation.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITRE,
  description: DESCRIPTION,
  applicationName: "Simulateur Atelier Kyka",
  openGraph: { type: "website", locale: "fr_FR", siteName: "Atelier Kyka", title: TITRE, description: DESCRIPTION, url: SITE },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
  // icon.svg, apple-icon.png et opengraph-image.png sont pris en compte automatiquement depuis src/app/
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-[#faf8f5] text-stone-900">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
