import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
  title: "SprawdzDziałkę.pl – Analiza Planistyczna Działek",
  description:
    "Profesjonalna analiza planistyczna działek na podstawie MPZP. Sprawdź warunki zabudowy, strefy i media przed zakupem działki.",
  keywords: "analiza planistyczna, MPZP, działka, zabudowa, raport planistyczny, SprawdzDziałkę",
  metadataBase: new URL("https://sprawdzdzialke.pl"),
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "SprawdzDziałkę.pl – Analiza Planistyczna Działek",
    description: "Raport planistyczny w 60 sekund. MPZP, strefy Natura 2000, media i rekomendacje AI.",
    url: "https://sprawdzdzialke.pl",
    siteName: "SprawdzDziałkę.pl",
    locale: "pl_PL",
    type: "website",
    // Dodaj og-image.png do /public po wygenerowaniu (1200x630px)
    // images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SprawdzDziałkę.pl",
    description: "Sprawdź swoją działkę przed zakupem – MPZP, strefy, media.",
    // images: ["/og-image.png"],
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
