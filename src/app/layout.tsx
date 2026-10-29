import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulateur Atelier Kyka — menuiserie sur mesure",
  description: "Décrivez votre dressing, placard, cuisine ou fenêtres : nous le dessinons en 3D et vous donnons une estimation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-[#faf8f5] text-stone-900">{children}</body>
    </html>
  );
}
