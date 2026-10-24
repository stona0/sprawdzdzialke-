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

  icons: {
    icon: "/favicon.svg",
  },

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
