/**
 * Uzbrojenie terenu z Krajowej Integracji Uzbrojenia Terenu (KIUT/GESUT, GUGiK).
 *
 * Usługa jest tylko WMS i nie udostępnia atrybutów (GetFeatureInfo: „Usługa nie
 * udostępnia danych opisowych”). Odległość liczymy więc z obrazu: renderujemy jedną
 * warstwę sieci w EPSG:2180 przy ~0,5 m/piksel z przezroczystym tłem i mierzymy
 * odległość od granicy działki do najbliższego narysowanego piksela.
 *
 * Ograniczenia (muszą trafić do raportu):
 *  - dokładność ±2 m (szerokość symbolu linii, opisy przy liniach),
 *  - kompletność zależy od powiatu; duże miasta (np. Wrocław, Kraków) nie przekazują
 *    danych do KIUT — wtedy wynik to „brak danych”, a nie „brak sieci”,
 *  - nie rozróżnia napięcia, średnicy ani tego, czy sieć jest czynna i dostępna do przyłączenia.
 *
 * Serwer bywa niekompletny: identyczne GetMap zwracają różne wersje danych (Sobótka, 8 zapytań na warstwę:
 * prąd 26 755 / 7 227 / 1 462 px, gaz 3 417 px albo pusto w 3 z 8; Długołęka: prąd pusto w ~40%).
 * Dlatego każdą warstwę pobieramy SAMPLES razy i łączymy narysowane piksele, a gdy odpowiedzi się różnią
 * (albo część nie przyszła), wynik jest `unconfirmed` i nie trafia do cache. Limit usługi: 10 zapytań na 2 s
 * (429 z Retry-After) — fetchWithRetry czeka, ile każe serwer. Zmierzone 23.10.2026 (scripts/gesut-stability.mts).
 */
import { bbox, distanceToLine, pointInMultiPolygon, type MultiPolygon, type Pt } from '../geo'
import { cachedSource, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'
import { responsesAgree } from '../kiut-raster'

const KIUT = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu'
export const GESUT_WINDOW_M = 100
const COVERAGE_WINDOW_M = 1000
const MAX_PX = 2000
/** Odpowiedzi na każdą warstwę. Więcej = mniej braków, ale 4 warstwy × SAMPLES + mapa (4) muszą zmieścić się blisko limitu 10 na 2 s. */
const SAMPLES = 2

export const NETWORKS = {
  energia: { layer: 'przewod_elektroenergetyczny', label: 'Sieć elektroenergetyczna' },
  woda: { layer: 'przewod_wodociagowy', label: 'Wodociąg' },
  kanalizacja: { layer: 'przewod_kanalizacyjny', label: 'Kanalizacja' },
  gaz: { layer: 'przewod_gazowy', label: 'Sieć gazowa' },
} as const
export type Network = keyof typeof NETWORKS

export interface NetworkDistance {
  /** Odległość od granicy działki [m]; null = brak sieci w promieniu GESUT_WINDOW_M. */
  distanceM: number | null
  /** Sieć przebiega przez działkę. */
  crosses: boolean
}

export type GesutResult = Record<Network, NetworkDistance>

interface Raster {
  data: Buffer
  width: number
  height: number
  x0: number
  y1: number
  res: number
}

async function render(layer: string, x0: number, y0: number, x1: number, y1: number, res: number): Promise<Raster> {
  const width = Math.round((x1 - x0) / res)
  const height = Math.round((y1 - y0) / res)
  // WMS 1.3.0 + EPSG:2180 → BBOX w kolejności northing,easting
  const url =
    `${KIUT}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:2180` +
    `&BBOX=${y0},${x0},${y1},${x1}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/png&TRANSPARENT=TRUE`
  const r = await fetchWithRetry(url, { timeoutMs: 20_000, retries: 1 })
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error(`KIUT: odpowiedź nie jest PNG (${buf.toString('utf8', 0, 60)})`)
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, x0, y1, res }
}

interface Sampled {
  /** Piksele narysowane w którejkolwiek odpowiedzi. */
  pixels: Pt[]
  /** Przyszły wszystkie odpowiedzi i mają tyle samo pikseli (±10%). */
  agree: boolean
}

/** To samo zapytanie SAMPLES razy naraz. Błąd tylko wtedy, gdy nie przyszła żadna odpowiedź. */
async function renderSampled(layer: string, x0: number, y0: number, x1: number, y1: number, res: number): Promise<Sampled> {
  const settled = await Promise.allSettled(Array.from({ length: SAMPLES }, () => render(layer, x0, y0, x1, y1, res)))
  const rasters = settled.flatMap(s => (s.status === 'fulfilled' ? [s.value] : []))
  if (!rasters.length) throw (settled[0] as PromiseRejectedResult).reason
  return { pixels: drawnPixels(rasters), agree: rasters.length === SAMPLES && responsesAgree(rasters.map(drawnCount)) }
}

function drawnCount(r: Raster): number {
  let n = 0
  for (let a = 3; a < r.data.length; a += 4) if (r.data[a] > 0) n++
  return n
}

/** Odpowiedzi na to samo zapytanie mają tę samą siatkę — piksel jest narysowany, jeśli którakolwiek go ma. */
function drawnPixels(rs: Raster[]): Pt[] {
  const [{ width, height, x0, y1, res }] = rs
  const pts: Pt[] = []
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const a = (j * width + i) * 4 + 3
      if (rs.some(r => r.data[a] > 0)) pts.push([x0 + (i + 0.5) * res, y1 - (j + 0.5) * res])
    }
  }
  return pts
}

export function measure(parcel: MultiPolygon, pixels: Pt[]): NetworkDistance {
  if (!pixels.length) return { distanceM: null, crosses: false }
  let best = Infinity
  let crosses = false
  for (const p of pixels) {
    if (pointInMultiPolygon(p, parcel)) {
      crosses = true
      best = 0
      break
    }
    best = Math.min(best, distanceToLine(parcel, [p]))
  }
  return { distanceM: best === Infinity ? null : Math.round(best), crosses }
}

export async function queryGesut(parcelId: string, geom: MultiPolygon): Promise<SourceResult<GesutResult>> {
  return cachedSource(`gesut:${parcelId}`, DAY, () => runSource('Uzbrojenie terenu – KIUT/GESUT (GUGiK)', async () => {
    const [minx, miny, maxx, maxy] = bbox(geom)
    const x0 = minx - GESUT_WINDOW_M, y0 = miny - GESUT_WINDOW_M
    const x1 = maxx + GESUT_WINDOW_M, y1 = maxy + GESUT_WINDOW_M
    const res = Math.max(0.5, Math.max(x1 - x0, y1 - y0) / MAX_PX)

    const samples = await Promise.all((Object.keys(NETWORKS) as Network[]).map(async n => {
      const s = await renderSampled(NETWORKS[n].layer, x0, y0, x1, y1, res)
      return [n, measure(geom, s.pixels), s.agree] as const
    }))
    const data = Object.fromEntries(samples.map(([n, d]) => [n, d])) as GesutResult
    const unconfirmed = samples.some(([, , agree]) => !agree)

    if (samples.every(([, d]) => d.distanceM === null)) {
      // Pusto w promieniu 100 m — sprawdzamy, czy KIUT ma tu w ogóle jakiekolwiek dane.
      const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
      const layers = Object.values(NETWORKS).map(v => v.layer).join(',')
      const wide = await renderSampled(layers, cx - COVERAGE_WINDOW_M, cy - COVERAGE_WINDOW_M, cx + COVERAGE_WINDOW_M, cy + COVERAGE_WINDOW_M, 5)
      if (!wide.pixels.length) return { status: 'not_covered', data: null, unconfirmed: unconfirmed || !wide.agree }
      return { status: 'no_data', data, unconfirmed: unconfirmed || !wide.agree }
    }
    return { status: 'ok', data, unconfirmed }
  }))
}
