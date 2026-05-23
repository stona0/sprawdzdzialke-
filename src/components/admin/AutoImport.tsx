'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Terminal } from 'lucide-react'

const pf: React.CSSProperties = { fontFamily: 'var(--font-playfair)' }

// Lista gmin (zsynchronizowana z gminy.ts)
const GMINY = [
  { nazwa: 'Wrocław',             powiat: 'Wrocław',      teryt: '0264000' },
  { nazwa: 'Czernica',            powiat: 'wrocławski',   teryt: '0204022' },
  { nazwa: 'Długołęka',           powiat: 'wrocławski',   teryt: '0204032' },
  { nazwa: 'Jordanów Śląski',     powiat: 'wrocławski',   teryt: '0204042' },
  { nazwa: 'Kąty Wrocławskie',    powiat: 'wrocławski',   teryt: '0204053' },
  { nazwa: 'Kobierzyce',          powiat: 'wrocławski',   teryt: '0204062' },
  { nazwa: 'Mietków',             powiat: 'wrocławski',   teryt: '0204072' },
  { nazwa: 'Miękinia',            powiat: 'wrocławski',   teryt: '0204082' },
  { nazwa: 'Siechnice',           powiat: 'wrocławski',   teryt: '0204093' },
  { nazwa: 'Sobótka',             powiat: 'wrocławski',   teryt: '0204103' },
  { nazwa: 'Żórawina',            powiat: 'wrocławski',   teryt: '0204112' },
  { nazwa: 'Oława',               powiat: 'oławski',      teryt: '0213043' },
  { nazwa: 'Domaniów',            powiat: 'oławski',      teryt: '0213022' },
  { nazwa: 'Jelcz-Laskowice',     powiat: 'oławski',      teryt: '0213013' },
  { nazwa: 'Środa Śląska',        powiat: 'średzki',      teryt: '0221043' },
  { nazwa: 'Malczyce',            powiat: 'średzki',      teryt: '0221022' },
  { nazwa: 'Kostomłoty',          powiat: 'średzki',      teryt: '0221032' },
  { nazwa: 'Trzebnica',           powiat: 'trzebnicki',   teryt: '0224043' },
  { nazwa: 'Oborniki Śląskie',    powiat: 'trzebnicki',   teryt: '0224032' },
  { nazwa: 'Prusice',             powiat: 'trzebnicki',   teryt: '0224042' },
  { nazwa: 'Wisznia Mała',        powiat: 'trzebnicki',   teryt: '0224052' },
  { nazwa: 'Zawonia',             powiat: 'trzebnicki',   teryt: '0224062' },
  { nazwa: 'Oleśnica',            powiat: 'oleśnicki',    teryt: '0214043' },
  { nazwa: 'Dobroszyce',          powiat: 'oleśnicki',    teryt: '0214022' },
]

interface GminaStatus {
  teryt: string
  symbole: number
  last_updated: string | null
}

export default function AutoImport() {
  const [statuses, setStatuses] = useState<GminaStatus[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchStatuses() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mpzp-status')
      if (res.ok) setStatuses(await res.json())
    } catch { /* ignoruj */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchStatuses() }, [])

  const withData   = statuses.filter(s => s.symbole > 0)
  const totalSymbols = statuses.reduce((s, r) => s + r.symbole, 0)

  return (
    <div className="space-y-6">

      {/* Instrukcja uruchomienia */}
      <div className="border border-gray-100 rounded-2xl p-7 bg-white shadow-sm">
        <h2 className="text-xl text-gray-900 mb-1" style={{ ...pf, fontWeight: 400 }}>
          Auto-import MPZP — okolice Wrocławia
        </h2>
        <p className="text-sm text-gray-400 mb-6" style={pf}>
          Playwright automatycznie przeszukuje BIPy gmin, pobiera uchwały MPZP i parsuje je przez Claude.
        </p>

        {/* Kroki */}
        <div className="space-y-3 mb-6">
          {[
            {
              n: '1',
              title: 'Skopiuj cookie sesji',
              desc: 'DevTools (F12) → Application → Cookies → skopiuj wartość cookie sb-*-auth-token',
            },
            {
              n: '2',
              title: 'Uruchom scraper',
              desc: 'W katalogu projektu uruchom terminal i wklej komendę poniżej',
            },
            {
              n: '3',
              title: 'Obserwuj postęp',
              desc: 'Scraper loguje każdą gminę. Po zakończeniu odśwież tę stronę.',
            },
          ].map(s => (
            <div key={s.n} className="flex gap-3">
              <span className="w-6 h-6 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={pf}>
                {s.n}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800" style={pf}>{s.title}</p>
                <p className="text-xs text-gray-400 mt-0.5" style={pf}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Komenda terminala */}
        <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <Terminal className="h-3 w-3" />
            <span>Terminal (w katalogu projektu)</span>
          </div>
          <p className="text-green-400">
            SCRAPER_SESSION=<span className="text-yellow-300">&quot;twoje-cookie-tutaj&quot;</span>{' '}
            <span className="text-white">npm run scrape-mpzp</span>
          </p>
          <p className="text-gray-600 text-xs mt-3">
            # Dla jednej gminy:<br/>
            SCRAPER_SESSION=&quot;...&quot; GMINA=&quot;Długołęka&quot; npm run scrape-mpzp:gmina
          </p>
        </div>

        {/* Szacowany czas */}
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span style={pf}>
            Szacowany czas: ~<strong>25 gmin × 60 sek = ok. 25 minut</strong>.
            Zostaw terminal otwarty. Scraper robi przerwy 2s między gminami.
          </span>
        </div>
      </div>

      {/* Status gmin */}
      <div className="border border-gray-100 rounded-2xl p-7 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg text-gray-900" style={{ ...pf, fontWeight: 600 }}>
              Status importu
            </h3>
            <p className="text-sm text-gray-400 mt-0.5" style={pf}>
              {withData.length}/{GMINY.length} gmin zasilonych · {totalSymbols} symboli łącznie
            </p>
          </div>
          <button
            onClick={fetchStatuses}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            style={pf}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>

        {/* Pasek postępu */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5" style={pf}>
            <span>Postęp importu</span>
            <span>{withData.length}/{GMINY.length}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${(withData.length / GMINY.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Tabela gmin */}
        <div className="space-y-1.5">
          {/* Nagłówek */}
          <div className="grid grid-cols-12 text-xs text-gray-400 px-3 pb-1" style={pf}>
            <span className="col-span-5">Gmina</span>
            <span className="col-span-3">Powiat</span>
            <span className="col-span-2 text-center">Symbole</span>
            <span className="col-span-2 text-center">Status</span>
          </div>

          {GMINY.map(g => {
            const status = statuses.find(s => s.teryt === g.teryt)
            const hasData = (status?.symbole ?? 0) > 0
            return (
              <div
                key={g.teryt}
                className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl text-sm ${
                  hasData ? 'bg-green-50/50' : 'bg-gray-50/50'
                }`}
              >
                <span className="col-span-5 font-medium text-gray-800" style={pf}>{g.nazwa}</span>
                <span className="col-span-3 text-gray-400 text-xs" style={pf}>{g.powiat}</span>
                <span className="col-span-2 text-center font-semibold text-gray-700" style={pf}>
                  {hasData ? status!.symbole : '—'}
                </span>
                <div className="col-span-2 flex justify-center">
                  {hasData ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-300" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
