import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WebApplicationJsonLd, OrganizationJsonLd } from "@/components/seo/JsonLd";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin-ext"],
  weight: ["400", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sprawdzdzialke.com"),

  title: {
    default: "SprawdzDziałkę.com — Sprawdź działkę budowlaną online w 60 sekund",
    template: "%s | SprawdzDziałkę.com",
  },
  description:
    "Sprawdź MPZP, media, ochronę przyrody i ryzyko zalewowe działki. AI-generowany raport planistyczny w minutę. Pierwszy raport za darmo.",
  keywords: [
    "sprawdź działkę",
    "analiza działki",
    "MPZP",
    "plan zagospodarowania przestrzennego",
    "działka budowlana",
    "raport planistyczny",
    "SprawdzDziałkę",
    "sprawdzenie działki przed zakupem",
    "media na działce",
    "Natura 2000",
    "strefa zalewowa",
    "warunki zabudowy",
  ],

  icons: {
    icon: "/favicon.svg",
  },

  alternates: {
    canonical: "https://sprawdzdzialke.com",
  },

  openGraph: {
    title: "SprawdzDziałkę.com — Sprawdź działkę budowlaną online w 60 sekund",
    description:
      "Raport planistyczny w 60 sekund. MPZP, strefy Natura 2000, media i rekomendacje AI — wszystko w jednym miejscu.",
    url: "https://sprawdzdzialke.com",
    siteName: "SprawdzDziałkę.com",
    locale: "pl_PL",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SprawdzDziałkę.com — raport planistyczny działki" }],
  },

  twitter: {
    card: "summary_large_image",
    title: "SprawdzDziałkę.com — Sprawdź działkę w 60 sekund",
    description:
      "Sprawdź swoją działkę przed zakupem — MPZP, strefy, media, rekomendacje AI.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  verification: {
    // TODO: Dodaj po rejestracji w Google Search Console:
    // google: "TWÓJ_KOD_WERYFIKACYJNY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Structured data — JSON-LD (global, renderowane raz) */}
        <WebApplicationJsonLd />
        <OrganizationJsonLd />

        {children}
        <Toaster />
      </body>
    </html>
  );
}
