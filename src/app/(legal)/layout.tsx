import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// Nagłówek tymczasowy: po scaleniu gałęzi ui/redesign strony prawne przejdą
// na wspólne SiteHeader/SiteFooter (src/components/layout), a linki do nich
// trafią do SiteFooter. Własnej stopki tu celowo nie ma.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-gray-900 font-playfair">
            Sprawdź<span className="text-green-700">Działkę</span>.com
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Strona główna
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
