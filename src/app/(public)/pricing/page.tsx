import Link from 'next/link'
import { Check, X, ChevronRight } from 'lucide-react'

const starterFeatures = [
  { text: '1 raport gratis', included: true },
  { text: 'Dane podstawowe ULDK', included: true },
  { text: 'Ochrona przyrody GDOŚ', included: true },
  { text: 'Media i uzbrojenie (OSM)', included: true },
  { text: 'Strefy zalewowe ISOK', included: false },
  { text: 'Rekomendacje Claude AI', included: false },
  { text: 'Analiza ryzyk inwestycyjnych', included: false },
  { text: 'Eksport do PDF', included: false },
]

const proFeatures = [
  { text: 'Pełny raport bez ograniczeń', included: true },
  { text: 'Dane podstawowe ULDK', included: true },
  { text: 'Ochrona przyrody GDOŚ', included: true },
  { text: 'Media i uzbrojenie (OSM + SIP)', included: true },
  { text: 'Strefy zalewowe ISOK', included: true },
  { text: 'Rekomendacje Claude AI', included: true },
  { text: 'Analiza ryzyk inwestycyjnych', included: true },
  { text: 'Eksport do PDF', included: true },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-gray-900"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Sprawdź<span className="text-green-700">Działkę</span>.pl
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Zaloguj się
            </Link>
            <Link
              href="/register"
              className="bg-gray-900 text-white text-sm px-5 py-2 rounded-full hover:bg-gray-700 transition-colors"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Zacznij za darmo
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1
          className="text-4xl md:text-5xl text-gray-900 tracking-tight mb-4"
          style={{ fontFamily: 'var(--font-playfair)', fontWeight: 400 }}
        >
          Prosty cennik, <span style={{ fontWeight: 700 }}>bez subskrypcji</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto" style={{ fontFamily: 'var(--font-playfair)' }}>
          Płacisz tylko za raporty których potrzebujesz. Pierwszy raport jest darmowy.
        </p>
      </section>

      {/* Cards */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-6">

          {/* Free */}
          <div className="border border-gray-200 rounded-2xl p-8">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Starter</div>
            <div className="text-4xl font-bold text-gray-900 mb-1">0 zł</div>
            <p className="text-gray-500 text-sm mb-8">Pierwszy raport gratis</p>
            <ul className="space-y-3 mb-8">
              {starterFeatures.map(f => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm">
                  {f.included ? (
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={f.included ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center border border-gray-300 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-50 transition-colors"
            >
              Zacznij za darmo
            </Link>
          </div>

          {/* Paid */}
          <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              Popularne
            </div>
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Pro</div>
            <div className="text-4xl font-bold mb-1">29 zł</div>
            <p className="text-gray-400 text-sm mb-8">za raport · jednorazowo</p>
            <ul className="space-y-3 mb-8">
              {proFeatures.map(f => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" /> {f.text}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2"
            >
              Sprawdź swoją działkę <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Payment methods */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Płatność przez Stripe — karta, BLIK, Przelewy24. Faktura VAT na życzenie.
        </p>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-gray-400 text-sm font-semibold">
            Sprawdź<span className="text-green-500">Działkę</span>.pl
          </span>
          <div className="flex gap-6 text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-700 transition-colors">Strona główna</Link>
            <Link href="/login" className="hover:text-gray-700 transition-colors">Zaloguj się</Link>
            <Link href="/register" className="hover:text-gray-700 transition-colors">Rejestracja</Link>
          </div>
          <span className="text-xs text-gray-400">© 2026 SprawdzDziałkę.pl</span>
        </div>
      </footer>
    </div>
  )
}
