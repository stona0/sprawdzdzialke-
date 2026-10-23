/**
 * Napowietrzne linie elektroenergetyczne (SN, WN, NN) i rurociągi w pobliżu działki —
 * z własnych kafli BDOT10k (ETL: scripts/etl/bdot-power-lines.mts), bez zależności
 * od publicznego Overpass.
 *
 * Kafle leżą w publicznym buckecie Supabase Storage `power-lines` (albo pod
 * POWER_LINES_URL — także katalog lokalny, np. ./data/power-lines). Gdy manifestu nie ma
 * (dane jeszcze nie wgrane), źródło zwraca not_covered i raport korzysta z OSM.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { bbox, distanceToLine, type MultiPolygon } from '../geo'
import { cached, cachedSource, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'
import { featurePoints, tilesForBbox, type LineClass, type PowerManifest, type PowerTile, type TileFeature } from '../power-lines'

export const POWER_LINES_RADIUS_M = 300
const SOURCE = 'Linie napowietrzne i rurociągi – BDOT10k (GUGiK)'

export const LINE_LABEL: Record<LineClass, string> = {
  EHV: 'linia najwyższego napięcia (220–400 kV)',
  HV: 'linia wysokiego napięcia (110 kV)',
  MV: 'linia średniego napięcia (SN)',
}

/**
 * Orientacyjna połowa szerokości pasa technologicznego (od osi linii). Wartości typowe
 * dla polskich operatorów: 400 kV ok. 70–80 m, 220 kV ok. 50 m, 110 kV ok. 30–40 m,
 * SN ok. 10–15 m. Wiążącą szerokość podaje operator sieci.
 */
export const TYPICAL_HALF_WIDTH_M: Record<LineClass, number> = { EHV: 40, HV: 20, MV: 7 }

export interface PowerLineHit {
  klasa: LineClass
  distanceM: number
  crosses: boolean
  /** kategoria istnienia, gdy inna niż „eksploatowany” */
  status: string | null
}

export interface PipelineHit {
  rodzaj: string | null
  distanceM: number
  crosses: boolean
  status: string | null
}

export interface PowerLinesResult {
  lines: PowerLineHit[]
  pipelines: PipelineHit[]
  radiusM: number
  /** Data aktualizacji BDOT10k w powiecie działki (YYYY-MM-DD). */
  dataDate: string | null
  datasetVersion: string
}

class NotConfiguredError extends Error {}

function base(): string | null {
  const explicit = process.env.POWER_LINES_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL
  return supa ? `${supa.replace(/\/$/, '')}/storage/v1/object/public/power-lines` : null
}

const isLocal = (b: string) => b.startsWith('/') || b.startsWith('./') || b.startsWith('file://')

/** JSON z magazynu kafli; null = brak pliku. */
async function getJson<T>(rel: string): Promise<T | null> {
  const b = base()
  if (!b) throw new NotConfiguredError('brak POWER_LINES_URL i NEXT_PUBLIC_SUPABASE_URL')
  if (isLocal(b)) {
    const file = path.resolve(b.replace(/^file:\/\//, ''), rel)
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw e
    }
  }
  const res = await fetchWithRetry(`${b}/${rel}`, { timeoutMs: 10_000 })
  if (res.status === 404 || res.status === 400) return null // Storage zwraca 400 dla brakującego obiektu
  if (!res.ok) throw new Error(`Kafle BDOT10k: HTTP ${res.status} (${rel})`)
  return (await res.json()) as T
}

// Manifest i kafle tylko w pamięci procesu — do bazy trafia wynik dla działki.
const manifest = () =>
  cached('bdot-manifest', 60 * 60 * 1000, async () => {
    const m = await getJson<PowerManifest>('current.json')
    if (!m) throw new NotConfiguredError('brak current.json')
    return m
  }, { persist: false })

const tile = (m: PowerManifest, key: string) =>
  cached(`bdot-tile:${m.version}:${key}`, DAY, async () => {
    const t = await getJson<PowerTile>(`${m.version}/${key}.json`)
    // Klucz jest w manifeście, a pliku nie ma — niekompletny upload, nie „brak linii”.
    if (!t) throw new Error(`Brak kafla ${key} w wersji ${m.version}`)
    return t
  }, { persist: false })

export function measureFeatures(parcel: MultiPolygon, features: TileFeature[], radiusM = POWER_LINES_RADIUS_M) {
  const seen = new Set<string>()
  const lines: PowerLineHit[] = []
  const pipelines: PipelineHit[] = []
  for (const f of features) {
    if (seen.has(f.i)) continue
    seen.add(f.i)
    const distanceM = Math.round(distanceToLine(parcel, featurePoints(f.c)))
    if (distanceM > radiusM) continue
    const hit = { distanceM, crosses: distanceM === 0, status: f.s ?? null }
    if (f.t === 'PIPE') pipelines.push({ rodzaj: f.r ?? null, ...hit })
    else lines.push({ klasa: f.t, ...hit })
  }
  // BDOT10k zapisuje linię jako osobne odcinki między słupami — zostawiamy najbliższy
  // odcinek każdej klasy napięcia i każdego rodzaju rurociągu.
  const byDist = (a: { distanceM: number }, b: { distanceM: number }) => a.distanceM - b.distanceM
  const nearestBy = <T extends { distanceM: number }>(items: T[], key: (x: T) => string) => {
    const seenKeys = new Set<string>()
    return items.sort(byDist).filter(x => !seenKeys.has(key(x)) && !!seenKeys.add(key(x)))
  }
  return { lines: nearestBy(lines, l => l.klasa), pipelines: nearestBy(pipelines, p => p.rodzaj ?? '') }
}

export async function queryPowerLines(parcelId: string, geom: MultiPolygon): Promise<SourceResult<PowerLinesResult>> {
  let m: PowerManifest
  try {
    m = await manifest()
  } catch (e) {
    if (e instanceof NotConfiguredError) {
      // Dane jeszcze nie wgrane — nie pokazujemy źródła w raporcie (ms: 0), raport użyje OSM.
      return { source: SOURCE, status: 'not_covered', data: null, ms: 0, fetchedAt: new Date().toISOString() }
    }
    return { source: SOURCE, status: 'error', data: null, error: e instanceof Error ? e.message : String(e), ms: 0, fetchedAt: new Date().toISOString() }
  }

  // Zbiór bez powiatu działki (np. częściowy przebieg ETL) — „brak linii” byłby fałszywy.
  if (!m.powiaty[parcelId.slice(0, 4)]) {
    return { source: SOURCE, status: 'not_covered', data: null, ms: 0, fetchedAt: new Date().toISOString() }
  }

  return cachedSource(`bdot-lines:${m.version}:${parcelId}`, DAY, () => runSource<PowerLinesResult>(SOURCE, async () => {
    const [minx, miny, maxx, maxy] = bbox(geom)
    const r = POWER_LINES_RADIUS_M
    const available = new Set(m.tiles)
    const keys = tilesForBbox([minx - r, miny - r, maxx + r, maxy + r], m.tileM).filter(k => available.has(k))
    const tiles = await Promise.all(keys.map(k => tile(m, k)))
    const { lines, pipelines } = measureFeatures(geom, tiles.flatMap(t => t.f))
    const data: PowerLinesResult = {
      lines, pipelines, radiusM: r,
      dataDate: m.powiaty[parcelId.slice(0, 4)]?.data ?? null,
      datasetVersion: m.version,
    }
    return { status: lines.length || pipelines.length ? 'ok' : 'no_data', data }
  }))
}
