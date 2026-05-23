'use client'

import { useState } from 'react'
import {
  Search, MapPin, AlertCircle, CheckCircle2,
  ExternalLink, Loader2, Info
} from 'lucide-react'
import type { ParcelData } from '@/lib/geoportal'

interface Props {
  onParcelFound: (parcel: ParcelData) => void
  hasFreeReport: boolean
}

const playfair: React.CSSProperties = { fontFamily: 'var(--font-playfair)' }

export default function ParcelSearch({ onParcelFound, hasFreeReport }: Props) {
  const [parcelId, setParcelId] = useState('')
  const [gmina, setGmina] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ParcelData | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!parcelId.trim() || !gmina.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(
        `/api/parcel?parcelId=${encodeURIComponent(parcelId.trim())}&gmina=${encodeURIComponent(gmina.trim())}`
      )
      const data = await res.json()

      if (!res.ok) { setError(data.error ?? 'Błąd serwera'); return }
      if (!data.found) {
        setError('Nie znaleziono działki. Sprawdź czy identyfikator EGB jest poprawny (np. 141201_1.0001.6/2).')
        return
      }
      setResult(data)
    } catch {
      setError('Błąd połączenia z serwerem. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setError('')
    setParcelId('')
    setGmina('')
  }

  return (
    <div className="space-y-5">

      {/* Karta wyszukiwania */}
      <div className="border border-gray-100 rounded-2xl p-7 bg-white shadow-sm">

        {/* Instrukcja */}
        <div className="flex gap-3 bg-blue-50/60 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <div style={playfair}>
            <p className="font-semibold mb-1.5">Jak znaleźć identyfikator działki?</p>
            <ol className="list-decimal ml-4 space-y-1 text-xs text-blue-700">
              <li>
                Wejdź na{' '}
                <a
                  href="https://geoportal.gov.pl/pl/map/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  geoportal.gov.pl/pl/map
                  <ExternalLink className="h-3 w-3 inline ml-0.5" />
                </a>
              </li>
              <li>Wyszukaj adres lub odszukaj działkę na mapie</li>
              <li>Kliknij na działkę → pojawi się <strong>Identyfikator działki</strong></li>
              <li>
                Skopiuj wartość, np.{' '}
                <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">141201_1.0001.6/2</code>
              </li>
            </ol>
          </div>
        </div>

        {/* Formularz */}
        <form onSubmit={handleSearch} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="parcelId"
                className="block text-sm text-gray-600 mb-1.5"
                style={playfair}
              >
                Identyfikator działki (EGB)
              </label>
              <input
                id="parcelId"
                placeholder="np. 141201_1.0001.6/2"
                value={parcelId}
                onChange={e => setParcelId(e.target.value)}
                disabled={loading || !!result}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm font-mono outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition placeholder:text-gray-300 disabled:opacity-50"
              />
            </div>
            <div>
              <label
                htmlFor="gmina"
                className="block text-sm text-gray-600 mb-1.5"
                style={playfair}
              >
                Gmina
              </label>
              <input
                id="gmina"
                placeholder="np. Kraków, Warszawa"
                value={gmina}
                onChange={e => setGmina(e.target.value)}
                disabled={loading || !!result}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition placeholder:text-gray-300 disabled:opacity-50"
                style={playfair}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span style={playfair}>{error}</span>
            </div>
          )}

          {!result ? (
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
              style={playfair}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Wyszukuję w Geoportal…</>
              ) : (
                <><Search className="h-4 w-4" /> Sprawdź działkę</>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-3 rounded-full border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              style={playfair}
            >
              Szukaj innej działki
            </button>
          )}
        </form>
      </div>

      {/* Wynik wyszukiwania */}
      {result && (
        <ParcelResultCard
          parcel={result}
          hasFreeReport={hasFreeReport}
          onGenerate={() => onParcelFound(result)}
        />
      )}
    </div>
  )
}

function ParcelResultCard({
  parcel,
  hasFreeReport,
  onGenerate,
}: {
  parcel: ParcelData
  hasFreeReport: boolean
  onGenerate: () => void
}) {
  const playfair: React.CSSProperties = { fontFamily: 'var(--font-playfair)' }

  return (
    <div className="border border-green-200 bg-green-50/50 rounded-2xl p-7 space-y-5">
      {/* Nagłówek */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p
          className="flex items-center gap-2 font-semibold text-gray-800"
          style={playfair}
        >
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Działka znaleziona w Geoportal
        </p>
        <span
          className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium"
          style={playfair}
        >
          ✓ Zweryfikowano
        </span>
      </div>

      {/* Dane działki */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          ['Numer działki', parcel.numer || parcel.parcelId],
          ['Gmina', parcel.gmina],
          parcel.obreb ? ['Obręb', parcel.obreb] : null,
          parcel.powiat ? ['Powiat', parcel.powiat] : null,
          parcel.wojewodztwo ? ['Województwo', parcel.wojewodztwo] : null,
          parcel.wspolrzedne ? ['Współrzędne', `${parcel.wspolrzedne.lat}, ${parcel.wspolrzedne.lng}`] : null,
        ].filter(Boolean).map((item) => {
          const [label, value] = item as [string, string]
          return (
            <div key={label}>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5" style={playfair}>{label}</p>
              <p className="text-sm font-medium text-gray-800" style={playfair}>{value}</p>
            </div>
          )
        })}
      </div>

      {parcel.wspolrzedne && (
        <a
          href={`https://maps.google.com/maps?q=${parcel.wspolrzedne.lat},${parcel.wspolrzedne.lng}&z=16`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
          style={playfair}
        >
          <MapPin className="h-3 w-3" />
          Pokaż na mapie Google
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* CTA */}
      <div className="pt-4 border-t border-green-200">
        {hasFreeReport ? (
          <div className="space-y-2">
            <p className="text-sm text-green-700" style={playfair}>
              ✓ Masz darmowy raport do wykorzystania
            </p>
            <button
              onClick={onGenerate}
              className="w-full bg-green-700 text-white py-3 rounded-full text-sm font-medium hover:bg-green-800 transition-colors"
              style={playfair}
            >
              Generuj darmowy raport
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500" style={playfair}>
              Raport kosztuje <span className="font-semibold text-gray-800">29 PLN</span>
            </p>
            <button
              onClick={onGenerate}
              className="w-full bg-gray-900 text-white py-3 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
              style={playfair}
            >
              Kup raport — 29 PLN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
