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
  title: "SprawdzDziałkę.com – Analiza Planistyczna Działek",
  description:
    "Profesjonalna analiza planistyczna działek na podstawie MPZP. Sprawdź warunki zabudowy, strefy i media przed zakupem działki.",
  keywords: "analiza planistyczna, MPZP, działka, zabudowa, raport planistyczny, SprawdzDziałkę",
  metadataBase: new URL("https://sprawdzdzialke.com"),
  openGraph: {
    title: "SprawdzDziałkę.com – Analiza Planistyczna Działek",
    description: "Profesjonalna analiza planistyczna działek na podstawie MPZP. Otrzymaj raport w kilka minut.",
    url: "https://sprawdzdzialke.com",
    siteName: "SprawdzDziałkę.com",
    locale: "pl_PL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SprawdzDziałkę.com",
    description: "Sprawdź swoją działkę przed zakupem – MPZP, strefy, media.",
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
