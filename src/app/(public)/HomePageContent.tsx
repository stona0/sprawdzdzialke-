import Link from 'next/link'
import { MapPin, FileText, Shield, Zap, ChevronRight, Check, Compass, Map as MapIcon, ShieldCheck, Sparkles, CheckCircle2, AlertTriangle, type LucideIcon } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'

export default function HomePageContent() {
  return (
    <>
      <SiteHeader overlay />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center overflow-hidden"
        style={{
          minHeight: '100svh',
          backgroundImage: 'url(/hero-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div className="w-full flex flex-col items-center pt-32 pb-10 px-6">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-gray-200/80 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Pierwszy raport całkowicie za darmo
          </div>

          {/* Nagłówek */}
          <h1 className="text-center text-5xl md:text-6xl lg:text-7xl text-gray-900 leading-[1.1] tracking-tight max-w-4xl font-playfair">
            Sprawdź działkę zanim{' '}
            <span className="font-bold">zainwestujesz.</span>
          </h1>

          <p className="mt-5 text-center text-lg md:text-xl text-gray-600 max-w-xl leading-relaxed">
            Raport planistyczny zwykle w mniej niż minutę. MPZP, plan ogólny, strefy zalewowe,
            Natura 2000, uzbrojenie i rekomendacje AI — wszystko w jednym miejscu.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/register"
              className="bg-gray-900 text-white font-semibold text-base px-8 py-3.5 rounded-full hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-lg"
            >
              Zacznij za darmo <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="bg-white/70 backdrop-blur-sm border border-gray-300 text-gray-700 font-medium text-base px-8 py-3.5 rounded-full hover:bg-white transition-colors"
            >
              Zobacz cennik
            </Link>
          </div>
        </div>

        {/* Makieta: skrót prawdziwego raportu (reports-sample/siechnice-ouz.json, 23.10.2026) w układzie z src/lib/report/html.ts */}
        <div className="w-full max-w-4xl px-4 sm:px-6 relative">
          <div className="absolute bottom-0 inset-x-4 sm:inset-x-6 h-32 pointer-events-none z-10 rounded-b-2xl" style={{ background: 'linear-gradient(to bottom, transparent, white)' }} />
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" style={{ maxHeight: '520px' }}>
            {/* Pasek przeglądarki */}
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2" aria-hidden="true">
              <div className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
              <div className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
              <div className="w-3 h-3 rounded-full bg-green-400 shrink-0" />
              <div className="flex-1 min-w-0 mx-2 sm:mx-4 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 truncate">
                sprawdzdzialke.com/report/7c1e4b9a-2d3f-4e8b-9a61-5b0f2c8d1e47
              </div>
            </div>

            {/* Treść raportu */}
            <div className="p-4 sm:p-5 bg-white text-[13px] sm:text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1 font-playfair">SprawdzDziałkę.com</p>
                  <h2 className="text-base font-semibold text-gray-900 leading-tight font-playfair">
                    Raport działki <strong>24</strong><br />Siechnice, obręb Żerniki Wrocławskie
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Wygenerowano: 23.10.2026, 14:09</p>
                </div>
                <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                  Przykładowy raport
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MockSection icon={Compass} title="Podsumowanie" full>
                  <MockStatus tone="ok">
                    <strong>Możliwa decyzja o warunkach zabudowy (działka w OUZ).</strong> W obszarze uzupełnienia zabudowy planu ogólnego leży ok. 76% działki.
                  </MockStatus>
                  <MockStatus tone="warn">Przez działkę przebiega sieć gazowa (wg KIUT) — możliwy pas ochronny lub służebność przesyłu.</MockStatus>
                </MockSection>

                <MockSection icon={MapPin} title="Dane ewidencyjne">
                  <MockRows rows={[['Numer działki', '24'], ['Obręb', 'Żerniki Wrocławskie'], ['Gmina', 'Siechnice'], ['Powiat', 'wrocławski'], ['Powierzchnia', '16 843 m²']]} />
                </MockSection>

                <MockSection icon={MapIcon} title="MPZP i plan ogólny">
                  <MockRows rows={[['MPZP', 'brak obowiązującego planu'], ['Strefa planu ogólnego', '685SJ, wielofunkcyjna z zab. jednorodzinną'], ['Maks. wysokość', '12 m'], ['Min. pow. biol. czynna', '50%'], ['Obszar uzupełnienia zabudowy', 'tak, 76% działki']]} />
                </MockSection>

                <MockSection icon={ShieldCheck} title="Zagrożenia i ochrona">
                  <MockStatus tone="ok">Poza obszarami zagrożenia powodziowego (ISOK)</MockStatus>
                  <MockStatus tone="ok">Brak form ochrony przyrody na działce (GDOŚ)</MockStatus>
                </MockSection>

                <MockSection icon={Zap} title="Uzbrojenie terenu">
                  <MockRows rows={[['Wodociąg', '0 m od granicy'], ['Kanalizacja', '1 m od granicy'], ['Energia elektryczna', '8 m od granicy'], ['Gaz', 'przebiega przez działkę']]} />
                </MockSection>

                <MockSection icon={Sparkles} title="Rekomendacje AI" full>
                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
                    {[
                      ['Zamów w urzędzie gminy wypis i wyrys z planu ogólnego i potwierdź możliwość uzyskania WZ.', 'ocena zabudowy, plan ogólny'],
                      ['Sprawdź w księdze wieczystej, czy dla sieci gazowej ustanowiono służebność przesyłu.', 'uzbrojenie'],
                      ['Zapytaj operatora sieci gazowej o pas ochronny, zanim wybierzesz miejsce budynku.', 'uzbrojenie'],
                    ].map(([text, basis]) => (
                      <li key={text} className="flex gap-1.5 text-gray-600">
                        <ChevronRight className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{text} <span className="block text-gray-400">Podstawa: {basis}</span></span>
                      </li>
                    ))}
                  </ul>
                </MockSection>
              </div>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="w-full py-10 mt-4">
          <p className="text-center text-sm font-medium uppercase tracking-widest mb-6 text-white/80">
            Dane prosto z oficjalnych źródeł
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 px-6">
            {['ULDK GUGiK', 'Krajowa Integracja MPZP', 'Rejestr Urbanistyczny', 'ISOK Wody Polskie', 'GDOŚ', 'KIUT GUGiK'].map(src => (
              <span key={src} className="text-white font-bold text-sm md:text-base tracking-tight drop-shadow">
                {src}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="funkcje" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight font-playfair">
            Wszystko, czego potrzebujesz<br />
            <span className="text-green-600">przed zakupem działki.</span>
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
            Jeden raport zastępuje godziny szukania w urzędach i na mapach.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <MapPin className="w-6 h-6" />, color: 'bg-green-50 text-green-600', title: 'MPZP i zabudowa', desc: 'Czy działkę obejmuje plan miejscowy lub plan ogólny gminy i jakie przeznaczenie terenu z niego wynika.' },
            { icon: <Shield className="w-6 h-6" />, color: 'bg-blue-50 text-blue-600', title: 'Strefy i ochrona', desc: 'Natura 2000, parki krajobrazowe i obszary zagrożenia powodzią (ISOK) sprawdzane dla granic działki.' },
            { icon: <Zap className="w-6 h-6" />, color: 'bg-amber-50 text-amber-600', title: 'Media i uzbrojenie', desc: 'Woda, kanalizacja, gaz, prąd. Dane z SIP gminy lub OpenStreetMap.' },
            { icon: <FileText className="w-6 h-6" />, color: 'bg-purple-50 text-purple-600', title: 'Rekomendacje AI', desc: 'Claude AI analizuje dane i wskazuje ryzyka inwestycyjne specyficzne dla działki.' },
          ].map(f => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2 font-playfair">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── JAK TO DZIAŁA ────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-16 font-playfair">Jak to działa?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Wklej identyfikator', desc: 'Skopiuj identyfikator EGB z Geoportal.gov.pl i wklej w formularz.' },
              { step: '02', title: 'Poczekaj chwilę', desc: 'System odpytuje rejestry publiczne (ULDK, GDOŚ, ISOK, plany gminy) i przygotowuje podsumowanie AI.' },
              { step: '03', title: 'Przeczytaj raport', desc: 'Raport otworzysz w przeglądarce — wydrukujesz go albo zapiszesz jako PDF. Pokaż go prawnikowi lub deweloperowi.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">{s.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2 font-playfair">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ───────────────────────────────────────────────────── */}
      {/* Jak /pricing: darmowy i płatny raport mają ten sam zakres (api/report/generate różni je tylko flagą paid) */}
      <section className="max-w-4xl mx-auto px-6 py-24">
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
            <p className="text-gray-400 text-sm mb-8">za raport · jednorazowo · bez subskrypcji</p>
            <Link href="/register" className="mt-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-full transition-colors">
              Sprawdź swoją działkę <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-3">Każdy raport ma ten sam pełny zakres:</p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-700">
            {['Ocena możliwości zabudowy', 'MPZP i plan ogólny', 'Zagrożenia i ochrona przyrody', 'Uzbrojenie terenu', 'Rekomendacje AI'].map(f => (
              <li key={f} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-green-600 shrink-0" /> {f}
              </li>
            ))}
          </ul>
          <Link href="/pricing" className="inline-block mt-4 text-sm text-green-700 underline underline-offset-2">Szczegóły w cenniku</Link>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gray-900 py-24 text-center">
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% 0%, #16a34a, transparent 70%)' }} />
        <h2 className="relative text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight font-playfair">
          Pierwszy raport jest darmowy.
        </h2>
        <p className="relative text-gray-400 text-lg mb-8">
          Zarejestruj się i sprawdź działkę zanim podejmiesz decyzję.
        </p>
        <Link
          href="/register"
          className="relative inline-flex items-center gap-2 bg-white text-gray-900 font-semibold text-base px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors"
        >
          Zacznij za darmo <ChevronRight className="w-4 h-4" />
        </Link>
      </section>
    </>
  )
}

// ── Elementy makiety raportu ─────────────────────────────────────────────────
function MockSection({ icon: Icon, title, full = false, children }: { icon: LucideIcon; title: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`border border-gray-100 rounded-xl p-3 ${full ? 'sm:col-span-2' : ''}`}>
      <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
        <span className="w-5 h-5 bg-green-50 text-green-700 rounded-md flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
        <span className="font-semibold text-gray-800 font-playfair">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function MockRows({ rows }: { rows: [string, string][] }) {
  return (
    <div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1 border-b border-gray-50 last:border-0">
          <span className="text-gray-400">{k}</span>
          <span className="font-medium text-gray-800 text-right">{v}</span>
        </div>
      ))}
    </div>
  )
}

function MockStatus({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div className={`flex gap-1.5 rounded-lg px-2 py-1.5 leading-snug ${tone === 'ok' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${tone === 'ok' ? 'text-green-600' : 'text-amber-600'}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
