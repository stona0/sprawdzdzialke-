'use client'

import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { MapPin, FileText, Shield, Zap, ChevronRight, Check, Menu, X } from 'lucide-react'

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
    <Head>
      <link rel="preload" href="/hero-bg.jpg" as="image" type="image/jpeg" />
    </Head>
    <div className="min-h-screen bg-white">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-transparent">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-gray-900 font-playfair">
            Sprawdź<span className="text-green-700">Działkę</span>.com
          </span>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-gray-700">
            <a href="#funkcje" className="hover:text-gray-900 transition-colors">Funkcje</a>
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">Cennik</Link>
            <Link href="/login" className="hover:text-gray-900 transition-colors">Zaloguj się</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="bg-gray-900 text-white text-sm px-5 py-2 rounded-full hover:bg-gray-700 transition-colors"
            >
              Zacznij za darmo
            </Link>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-gray-900 transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg">
            <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3">
              <a href="#funkcje" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-gray-900 py-2 text-base transition-colors">Funkcje</a>
              <Link href="/pricing" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-gray-900 py-2 text-base transition-colors">Cennik</Link>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-gray-900 py-2 text-base transition-colors">Zaloguj się</Link>
            </div>
          </div>
        )}
      </nav>

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
            Raport planistyczny w 60 sekund. MPZP, strefy Natura 2000,
            media i rekomendacje AI — wszystko w jednym miejscu.
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

        {/* Floating mockup */}
        <div className="w-full max-w-4xl px-6 relative">
          <div className="absolute bottom-0 inset-x-6 h-32 pointer-events-none z-10 rounded-b-2xl" style={{ background: 'linear-gradient(to bottom, transparent, white)' }} />
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden" style={{ maxHeight: '500px', overflow: 'hidden' }}>
            {/* Pasek przeglądarki */}
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">
                sprawdzdzialke.com/report/556-6-dlugoleka
              </div>
            </div>

            {/* Treść raportu */}
            <div className="p-5 bg-white">
              <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1 font-playfair">SprawdzDziałkę.com</p>
                  <h2 className="text-base font-semibold text-gray-900 leading-tight font-playfair">
                    Raport działki <strong>556/6</strong><br/>Długołęka
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">Wygenerowano: 17.05.2026, 12:41</p>
                </div>
                <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                  Raport planistyczny
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Dane podstawowe */}
                <div className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
                    <span className="w-5 h-5 bg-green-50 rounded-md flex items-center justify-center text-xs">📍</span>
                    <span className="font-semibold text-gray-800 font-playfair">Dane podstawowe</span>
                  </div>
                  {[['Numer działki','556/6'],['Gmina','Długołęka'],['Powiat','powiat wrocławski'],['Województwo','dolnośląskie'],['Powierzchnia','734 m²'],['Współrzędne','50.971, 17.192']].map(([k,v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Media */}
                <div className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
                    <span className="w-5 h-5 bg-green-50 rounded-md flex items-center justify-center text-xs">⚡</span>
                    <span className="font-semibold text-gray-800 font-playfair">Media i uzbrojenie</span>
                  </div>
                  {['Wodociąg','Kanalizacja','Gaz','Energia elektryczna'].map(m => (
                    <div key={m} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400">{m}</span>
                      <span className="text-green-600 font-semibold flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Tak
                      </span>
                    </div>
                  ))}
                </div>

                {/* MPZP */}
                <div className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
                    <span className="w-5 h-5 bg-green-50 rounded-md flex items-center justify-center text-xs">📋</span>
                    <span className="font-semibold text-gray-800 font-playfair">Plan zagospodarowania</span>
                  </div>
                  {[['Symbol terenu','MN – zabudowa mieszkaniowa'],['Wysokość max','9 m (2 kondygnacje)'],['Min. pow. biol. czynna','30%'],['Typ dachu','dwuspadowy, 35–45°'],['Źródło','Uchwała nr XXI/143/2023']].map(([k,v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-800 text-right max-w-[55%]">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Strefy */}
                <div className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
                    <span className="w-5 h-5 bg-green-50 rounded-md flex items-center justify-center text-xs">🛡</span>
                    <span className="font-semibold text-gray-800 font-playfair">Strefy i ograniczenia</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5 bg-green-50 rounded-lg px-2 py-1.5 leading-snug">
                      <span className="text-green-600 flex-shrink-0">✅</span>
                      <span className="text-green-800">Brak zagrożenia zalewowego (ISOK Q500)</span>
                    </div>
                    <div className="flex gap-1.5 bg-amber-50 rounded-lg px-2 py-1.5 leading-snug">
                      <span className="text-amber-500 flex-shrink-0">⚠️</span>
                      <span className="text-amber-800">Natura 2000 (OSO): Grądy Odrzańskie</span>
                    </div>
                    <div className="flex gap-1.5 bg-green-50 rounded-lg px-2 py-1.5 leading-snug">
                      <span className="text-green-600 flex-shrink-0">✅</span>
                      <span className="text-green-800">Brak strefy konserwatorskiej</span>
                    </div>
                  </div>
                </div>

                {/* Rekomendacje AI – full width */}
                <div className="col-span-2 border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-gray-100">
                    <span className="w-5 h-5 bg-green-50 rounded-md flex items-center justify-center text-xs">✨</span>
                    <span className="font-semibold text-gray-800 font-playfair">Rekomendacje AI</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4">
                    {[
                      'Działka w pełni uzbrojona — gotowa do zabudowy.',
                      'Skonsultuj ograniczenia Natura 2000 z gminą.',
                      'Brak MPZP — złóż wniosek o warunki zabudowy.',
                    ].map(r => (
                      <div key={r} className="flex gap-1.5 text-gray-600">
                        <span className="text-green-500 font-bold flex-shrink-0">→</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
            {['Geoportal.gov.pl', 'ULDK GUGiK', 'GDOŚ WFS', 'ISOK KZGW', 'OpenStreetMap'].map(src => (
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
            Wszystko co potrzebujesz<br />
            <span className="text-green-600">przed zakupem działki.</span>
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
            Jeden raport zastępuje godziny szukania w urzędach i na mapach.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <MapPin className="w-6 h-6" />, color: 'bg-green-50 text-green-600', title: 'MPZP i zabudowa', desc: 'Przeznaczenie terenu, max wysokość, PBC — prosto z aktualnej uchwały gminy.' },
            { icon: <Shield className="w-6 h-6" />, color: 'bg-blue-50 text-blue-600', title: 'Strefy i ochrona', desc: 'Natura 2000, parki krajobrazowe, strefy zalewowe ISOK — auto wykrywane.' },
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
              { step: '02', title: 'Poczekaj 60 sekund', desc: 'System automatycznie odpytuje ULDK, GDOŚ, ISOK i analizuje dane przez AI.' },
              { step: '03', title: 'Pobierz raport PDF', desc: 'Gotowy raport z rekomendacjami. Pokaż prawnikowi lub deweloperowi.' },
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
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-2xl p-8">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Starter</div>
            <div className="text-4xl font-bold text-gray-900 mb-1 font-playfair">0 zł</div>
            <p className="text-gray-500 text-sm mb-6">Pierwszy raport gratis</p>
            <ul className="space-y-3 mb-8">
              {['1 raport gratis', 'Dane podstawowe ULDK', 'Ochrona przyrody GDOŚ', 'Media i uzbrojenie'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">Zacznij za darmo</Link>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">Popularne</div>
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Pro</div>
            <div className="text-4xl font-bold mb-1 font-playfair">29 zł</div>
            <p className="text-gray-400 text-sm mb-6">za raport · bez subskrypcji</p>
            <ul className="space-y-3 mb-8">
              {['Pełny raport PDF', 'Rekomendacje Claude AI', 'Strefy zalewowe ISOK', 'Analiza ryzyk inwestycyjnych', 'Dostęp bez limitu czasowego'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-colors">Sprawdź swoją działkę →</Link>
          </div>
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

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-gray-400 text-sm font-semibold font-playfair">
            Sprawdź<span className="text-green-500">Działkę</span>.com
          </span>
          <div className="flex gap-6 text-xs text-gray-500">
            <Link href="/pricing" className="hover:text-gray-300 transition-colors">Cennik</Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">Zaloguj się</Link>
            <Link href="/register" className="hover:text-gray-300 transition-colors">Rejestracja</Link>
          </div>
          <span className="text-xs text-gray-600">© 2026 SprawdzDziałkę.com</span>
        </div>
      </footer>
    </div>
    </>
  )
}
