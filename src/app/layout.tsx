import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WebApplicationJsonLd, OrganizationJsonLd } from "@/components/seo/JsonLd";

// latin-ext: polskie znaki (ą, ę, ł, ż…) z tego samego kroju, nie z zapasowego
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

// identyfikatory działek (font-mono)
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Font zmienny (400–900): obejmuje też font-semibold używane w nagłówkach
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sprawdzdzialke.com"),

  title: {
    default: "SprawdzDziałkę.com — Sprawdź działkę online przed zakupem",
    template: "%s | SprawdzDziałkę.com",
  },
  description:
    "Sprawdź MPZP, plan ogólny, media, ochronę przyrody i ryzyko zalewowe działki. Raport planistyczny z rejestrów publicznych, zwykle w mniej niż minutę. Pierwszy raport za darmo.",
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

  alternates: {
    canonical: "https://sprawdzdzialke.com",
  },

  openGraph: {
    title: "SprawdzDziałkę.com — Sprawdź działkę budowlaną online przed zakupem",
    description:
      "Raport planistyczny zwykle w mniej niż minutę. MPZP, plan ogólny, strefy zalewowe, Natura 2000, media i rekomendacje AI — wszystko w jednym miejscu.",
    url: "https://sprawdzdzialke.com",
    siteName: "SprawdzDziałkę.com",
    locale: "pl_PL",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "SprawdzDziałkę.com — Sprawdź działkę przed zakupem",
    description:
      "Sprawdź swoją działkę przed zakupem — MPZP, strefy, media, rekomendacje AI.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}>
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
