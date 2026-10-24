import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { COMPANY } from '@/lib/company'
import { OG_IMAGE } from '@/lib/og-image'

export const metadata: Metadata = {
  title: 'Cennik',
  description:
    'Cennik SprawdzDziałkę.com: pierwszy raport za darmo, każdy kolejny 29 zł. Ten sam pełny raport, bez subskrypcji.',
  alternates: {
    canonical: 'https://sprawdzdzialke.com/pricing',
  },
  openGraph: {
    title: 'Cennik — SprawdzDziałkę.com',
    description: 'Pierwszy raport za darmo, każdy kolejny 29 zł. Ten sam pełny raport: MPZP, plan ogólny, zagrożenia, uzbrojenie, rekomendacje AI.',
    url: 'https://sprawdzdzialke.com/pricing',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cennik — SprawdzDziałkę.com',
    images: [OG_IMAGE.url],
  },
}

// Darmowy i płatny raport przechodzą ten sam potok (api/report/generate różni je
// tylko flagą paid), więc lista jest jedna. Pozycje odpowiadają sekcjom src/lib/report/html.ts.
const reportContents = [
  { title: 'Ocena możliwości zabudowy', desc: 'MPZP, plan ogólny i obszar uzupełnienia zabudowy według przepisów obowiązujących od 1.09.2026.' },
  { title: 'Dane ewidencyjne', desc: 'Obręb, gmina, powiat i powierzchnia z ULDK (GUGiK).' },
  { title: 'Miejscowy plan (MPZP)', desc: 'Czy działkę obejmuje plan, oznaczenie terenu i uchwała. Zakres danych zależy od gminy, a dla Wrocławia pochodzą one z GIS miasta.' },
  { title: 'Plan ogólny gminy', desc: 'Strefa, parametry zabudowy i obszar uzupełnienia zabudowy z Rejestru Urbanistycznego, jeśli gmina opublikowała plan.' },
  { title: 'Zagrożenie powodziowe', desc: 'Obszary zagrożenia powodziowego z map ISOK (Wody Polskie).' },
  { title: 'Ochrona przyrody', desc: 'Natura 2000, parki, rezerwaty i inne formy ochrony (GDOŚ).' },
  { title: 'Uzbrojenie terenu', desc: 'Sieci i ich odległość od działki z Krajowej Integracji Uzbrojenia Terenu, linie energetyczne z BDOT10k i mapa.' },
  { title: 'Rekomendacje i ryzyka AI', desc: 'Claude AI opisuje ryzyka i kolejne kroki wyłącznie na podstawie danych z raportu i przy każdym punkcie podaje podstawę.' },
  { title: 'Status każdego źródła', desc: 'Widać, czego nie udało się ustalić, więc brak danych nie wygląda jak brak problemu.' },
]

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-white pt-16">
        {/* Header */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <h1 className="text-4xl md:text-5xl text-gray-900 tracking-tight mb-4 font-playfair">
            Prosty cennik, <span className="font-bold">bez subskrypcji</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Płacisz tylko za raporty, których potrzebujesz. Pierwszy jest darmowy, a każdy raport ma ten sam pełny zakres.
          </p>
        </section>

        {/* Cards */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-2xl p-8 flex flex-col">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Pierwszy raport</div>
              <div className="text-4xl font-bold text-gray-900 mb-1 font-playfair">0 zł</div>
              <p className="text-gray-500 text-sm mb-8">Jeden na konto, bez podawania karty</p>
              <Link href="/register" className="mt-auto block text-center border border-gray-300 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-50 transition-colors">Zacznij za darmo</Link>
            </div>

            <div className="bg-gray-900 rounded-2xl p-8 text-white flex flex-col">
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Każdy kolejny</div>
              <div className="text-4xl font-bold mb-1 font-playfair">29 zł</div>
              <p className="text-gray-400 text-sm mb-8">za raport · jednorazowo · cena brutto z VAT</p>
              <Link href="/register" className="mt-auto text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2">
                Sprawdź swoją działkę <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Zawartość raportu */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 font-playfair">Co zawiera każdy raport</h2>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
            {reportContents.map(item => (
              <li key={item.title} className="flex gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 space-y-2 text-sm text-gray-500 border-t border-gray-100 pt-6">
            <p>Raport otwierasz w swoim koncie. Możesz go wydrukować albo zapisać jako PDF funkcją drukowania przeglądarki.</p>
            <p>
              Płatność przez Stripe: karta, BLIK, Przelewy24. Fakturę VAT wystawiamy na życzenie, napisz na{' '}
              <a href={`mailto:${COMPANY.email}`} className="text-green-700 underline underline-offset-2">{COMPANY.email}</a>{' '}
              (szczegóły na stronie <Link href="/kontakt" className="text-green-700 underline underline-offset-2">Kontakt</Link>).
            </p>
            <p>
              Raport ma charakter informacyjny i nie zastępuje wypisu i wyrysu z planu. Zasady opisuje{' '}
              <Link href="/regulamin" className="text-green-700 underline underline-offset-2">Regulamin</Link>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
