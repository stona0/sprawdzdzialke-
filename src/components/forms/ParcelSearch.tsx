'use client'

import { useState } from 'react'
import {
  Search, MapPin, AlertCircle, CheckCircle2,
  ExternalLink, Loader2, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ParcelData } from '@/lib/geoportal'
import { REPORT_PRICE_LABEL } from '@/lib/pricing'

interface Props {
  onParcelFound: (parcel: ParcelData) => void
  hasFreeReport: boolean
}

/**
 * Parsuje kod TERYT gminy z identyfikatora EGB.
 * Przykłady:
 *   "141201_1.0001.6/2"   → "141201_1"
 *   "0261011.0001.AR_1.6" → "0261011"
 * Zwraca pusty string jeśli nie da się sparsować.
 */
function parseTerytFromId(id: string): string {
  const trimmed = id.trim()
  const dotIndex = trimmed.indexOf('.')
  if (dotIndex === -1) return ''
  return trimmed.substring(0, dotIndex)
}

export default function ParcelSearch({ onParcelFound, hasFreeReport }: Props) {
  const [parcelId, setParcelId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ParcelData | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmedId = parcelId.trim()
    if (!trimmedId) return

    if (!trimmedId.includes('.')) {
      setError('Podaj pełny identyfikator EGB z Geoportal (np. 141201_1.0001.6/2). Musi zawierać kropki.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const teryt = parseTerytFromId(trimmedId)
      const res = await fetch(
        `/api/parcel?parcelId=${encodeURIComponent(trimmedId)}${teryt ? `&teryt=${encodeURIComponent(teryt)}` : ''}`
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
  }

  return (
    <div className="space-y-5">

      {/* Karta wyszukiwania */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">

        {/* Instrukcja */}
        <div className="mb-6 flex gap-3 rounded-xl border bg-muted p-4 text-sm text-gray-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="mb-1.5 font-semibold">Jak znaleźć identyfikator działki?</p>
            <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
              <li>
                Wejdź na{' '}
                <a href="https://geoportal.gov.pl/pl/map/" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-medium text-primary underline underline-offset-2">
                  geoportal.gov.pl/pl/map <ExternalLink className="ml-0.5 inline h-3 w-3" aria-hidden />
                </a>
              </li>
              <li>Wyszukaj adres lub odszukaj działkę na mapie</li>
              <li>Kliknij na działkę → pojawi się <strong className="text-gray-900">Identyfikator działki</strong></li>
              <li>Skopiuj wartość, np. <code className="inline-block whitespace-nowrap rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-900">141201_1.0001.6/2</code></li>
            </ol>
          </div>
        </div>

        {/* Formularz — JEDNO POLE */}
        <form onSubmit={handleSearch} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="parcelId">Identyfikator działki (EGB)</Label>
            <Input
              id="parcelId"
              placeholder="np. 141201_1.0001.6/2"
              value={parcelId}
              onChange={e => setParcelId(e.target.value)}
              disabled={loading || !!result}
              required
              autoComplete="off"
              spellCheck={false}
              aria-describedby="parcelId-hint"
              aria-invalid={error ? true : undefined}
              className="h-11 rounded-xl font-mono"
            />
            <p id="parcelId-hint" className="text-xs text-muted-foreground">
              Gmina zostanie rozpoznana automatycznie z kodu TERYT
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <Button type="submit" size="lg" variant="dark" disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="animate-spin" /> Wyszukuję w Geoportal…</>
              ) : (
                <><Search /> Sprawdź działkę</>
              )}
            </Button>
          ) : (
            <Button type="button" size="lg" variant="outline" onClick={handleReset} className="w-full">
              Szukaj innej działki
            </Button>
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
  const facts = [
    ['Numer działki', parcel.numer || parcel.parcelId],
    ['Gmina', parcel.gmina],
    parcel.obreb ? ['Obręb', parcel.obreb] : null,
    parcel.powiat ? ['Powiat', parcel.powiat] : null,
    parcel.wojewodztwo ? ['Województwo', parcel.wojewodztwo] : null,
    parcel.wspolrzedne ? ['Współrzędne', `${parcel.wspolrzedne.lat}, ${parcel.wspolrzedne.lng}`] : null,
  ].filter((f): f is [string, string] => f !== null)

  return (
    <section aria-labelledby="wynik-dzialki" className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
      {/* Nagłówek */}
      <div>
        <h2 id="wynik-dzialki" className="flex items-center gap-2 font-semibold text-gray-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          Działka znaleziona w Geoportal
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Dane z ewidencji gruntów (ULDK GUGiK)</p>
      </div>

      {/* Dane działki */}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      {parcel.wspolrzedne && (
        <a
          href={`https://maps.google.com/maps?q=${parcel.wspolrzedne.lat},${parcel.wspolrzedne.lng}&z=16`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Pokaż na mapie Google
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}

      {/* CTA */}
      <div className="space-y-3 border-t pt-5">
        {hasFreeReport ? (
          <>
            <p className="text-sm text-muted-foreground">Masz darmowy raport do wykorzystania.</p>
            <Button size="lg" onClick={onGenerate} className="w-full">
              Generuj darmowy raport
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Raport kosztuje <span className="font-semibold text-gray-900">{REPORT_PRICE_LABEL}</span>
            </p>
            <Button size="lg" onClick={onGenerate} className="w-full">
              Kup raport — {REPORT_PRICE_LABEL}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
