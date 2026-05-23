'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, CheckCircle2, AlertCircle,
  Database, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { MPZPResult } from '@/lib/anthropic'

type Step = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'

const pf: React.CSSProperties = { fontFamily: 'var(--font-playfair)' }

export default function MPZPUploader({ onSaved }: { onSaved?: () => void }) {
  const [step, setStep]         = useState<Step>('idle')
  const [progress, setProgress] = useState(0)
  const [file, setFile]         = useState<File | null>(null)
  const [gmina, setGmina]       = useState('')
  const [gminaTeryt, setGminaTeryt] = useState('')
  const [result, setResult]     = useState<MPZPResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving]     = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) { toast.error('Plik musi być w formacie PDF'); return }
    if (f.size > 30 * 1024 * 1024) { toast.error('Plik jest za duży (max 30 MB)'); return }
    setFile(f); setResult(null); setErrorMsg(''); setStep('idle')
  }, [])

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }

  async function handleParse(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !gmina.trim()) return
    setStep('uploading'); setProgress(10); setErrorMsg(''); setResult(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)
      formData.append('gmina', gmina.trim())

      setStep('parsing')
      const interval = startProgress(setProgress)
      const res = await fetch('/api/admin/parse-mpzp', { method: 'POST', body: formData })
      clearInterval(interval); setProgress(100)

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Błąd parsowania')
      if (!data.tereny?.length) throw new Error('Claude nie znalazł symboli terenów w dokumencie')

      setResult(data); setStep('done')
      toast.success(`Sparsowano ${data.tereny.length} symboli terenów`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      setErrorMsg(msg); setStep('error'); toast.error('Błąd: ' + msg)
    }
  }

  async function handleSave() {
    if (!result || !gminaTeryt.trim()) { toast.error('Podaj kod TERYT gminy'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/save-mpzp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, gmina_teryt: gminaTeryt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Błąd zapisu')
      toast.success(`Zapisano ${data.saved} symboli terenów`)
      onSaved?.(); handleReset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Błąd zapisu')
    } finally { setSaving(false) }
  }

  function handleReset() {
    setStep('idle'); setFile(null); setGmina(''); setResult(null)
    setErrorMsg(''); setProgress(0); setExpanded(null)
  }

  const isParsing = step === 'uploading' || step === 'parsing'

  return (
    <div className="space-y-5">

      {/* Karta uploadu */}
      <div className="border border-gray-100 rounded-2xl p-7 bg-white shadow-sm">
        <h2 className="text-xl text-gray-900 mb-1" style={{ ...pf, fontWeight: 400 }}>
          Import uchwały MPZP
        </h2>
        <p className="text-sm text-gray-400 mb-6" style={pf}>
          Wgraj PDF z uchwałą MPZP. Claude automatycznie wyciągnie parametry zabudowy dla wszystkich symboli terenów.
        </p>

        <form onSubmit={handleParse} className="space-y-5">

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => !file && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragging ? 'border-green-500 bg-green-50' :
              file     ? 'border-gray-200 bg-gray-50 cursor-default' :
                         'border-gray-200 hover:border-green-400 cursor-pointer'
            }`}
          >
            <input
              ref={inputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-green-600 shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-sm text-gray-800" style={pf}>{file.name}</p>
                  <p className="text-xs text-gray-400" style={pf}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); handleReset() }}
                  className="ml-2 text-gray-300 hover:text-red-400 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600" style={pf}>Przeciągnij PDF lub kliknij</p>
                <p className="text-xs text-gray-400 mt-1" style={pf}>Maksymalnie 30 MB</p>
              </div>
            )}
          </div>

          {/* Pola tekstowe */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5" style={pf}>
                Nazwa gminy
              </label>
              <input
                placeholder="np. Kraków"
                value={gmina}
                onChange={e => setGmina(e.target.value)}
                required
                disabled={isParsing}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition disabled:opacity-50"
                style={pf}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5" style={pf}>
                Kod TERYT gminy <span className="text-gray-400">(do zapisu)</span>
              </label>
              <input
                placeholder="np. 1261011"
                value={gminaTeryt}
                onChange={e => setGminaTeryt(e.target.value)}
                disabled={isParsing}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition disabled:opacity-50"
                style={pf}
              />
            </div>
          </div>

          {/* Progress bar */}
          {isParsing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-2" style={pf}>
                  <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                  {step === 'uploading' ? 'Przesyłanie…' : 'Claude analizuje uchwałę MPZP…'}
                </span>
                <span className="text-gray-400" style={pf}>{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {step === 'parsing' && (
                <p className="text-xs text-gray-400" style={pf}>
                  Parsowanie dużego PDF może potrwać 30–60 sekund.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {step === 'error' && errorMsg && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span style={pf}>{errorMsg}</span>
            </div>
          )}

          {step !== 'done' && (
            <button
              type="submit"
              disabled={!file || !gmina.trim() || isParsing}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              style={pf}
            >
              {isParsing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsowanie przez Claude…</>
                : <><Upload className="h-4 w-4" /> Parsuj uchwałę</>
              }
            </button>
          )}
        </form>
      </div>

      {/* Wyniki parsowania */}
      {step === 'done' && result && (
        <div className="border border-green-200 bg-green-50/30 rounded-2xl p-7 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h3 className="text-lg text-gray-900" style={{ ...pf, fontWeight: 600 }}>
                Wynik parsowania
              </h3>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium" style={pf}>
                {result.tereny.length} symboli terenów
              </span>
              {result.data_uchwalenia && (
                <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200" style={pf}>
                  Uchwała: {result.data_uchwalenia}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-500" style={pf}>
            Gmina: <strong className="text-gray-800">{result.gmina}</strong>
          </p>

          {/* Lista symboli */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {result.tereny.map(t => (
              <div key={t.symbol} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === t.symbol ? null : t.symbol)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-md">
                      {t.symbol}
                    </span>
                    <span className="text-gray-700 text-left" style={pf}>
                      {t.przeznaczenie_podstawowe ?? '–'}
                    </span>
                  </div>
                  {expanded === t.symbol
                    ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  }
                </button>
                {expanded === t.symbol && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100 space-y-1">
                    <PRow label="Wysokość max"            val={t.wysokosc_max_m}                                    unit="m" />
                    <PRow label="Kondygnacje max"         val={t.liczba_kondygnacji_max} />
                    <PRow label="PBC min"                 val={t.powierzchnia_biologicznie_czynna_min_procent}      unit="%" />
                    <PRow label="Zabudowa max"            val={t.powierzchnia_zabudowy_max_procent}                 unit="%" />
                    <PRow label="Typ dachu"               val={t.typ_dachu} />
                    <PRow label="Pokrycie dachu"          val={t.pokrycie_dachu} />
                    <PRow label="Min pow. działki"        val={t.min_powierzchnia_dzialki_m2}                      unit="m²" />
                    <PRow label="Min szerokość frontu"    val={t.min_szerokosc_frontu_m}                           unit="m" />
                    {t.uwagi && <PRow label="Uwagi" val={t.uwagi} />}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Zapis */}
          <div className="pt-4 border-t border-green-100">
            {!gminaTeryt.trim() && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span style={pf}>Uzupełnij kod TERYT gminy w formularzu powyżej przed zapisem.</span>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !gminaTeryt.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-green-700 text-white py-3 rounded-full text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
                style={pf}
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Zapisuję…</>
                  : <><Database className="h-4 w-4" /> Zapisz do bazy ({result.tereny.length} symboli)</>
                }
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-6 py-3 rounded-full border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                style={pf}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PRow({ label, val, unit }: { label: string; val: unknown; unit?: string }) {
  if (val === null || val === undefined) return null
  return (
    <div className="flex justify-between gap-2 text-xs py-0.5">
      <span className="text-gray-400" style={{ fontFamily: 'var(--font-playfair)' }}>{label}</span>
      <span className="font-medium text-gray-800" style={{ fontFamily: 'var(--font-playfair)' }}>
        {String(val)}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

function startProgress(set: (v: number) => void) {
  let v = 15
  return setInterval(() => {
    v = Math.min(90, v + (v < 50 ? 8 : v < 75 ? 3 : 1))
    set(v)
  }, 1500)
}
