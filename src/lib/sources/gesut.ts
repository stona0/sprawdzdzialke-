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
 */
import { bbox, distanceToLine, pointInMultiPolygon, type MultiPolygon, type Pt } from '../geo'
import { cachedSource, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'

const KIUT = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu'
export const GESUT_WINDOW_M = 100
const COVERAGE_WINDOW_M = 1000
const MAX_PX = 2000

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

function drawnPixels(r: Raster): Pt[] {
  const pts: Pt[] = []
  for (let j = 0; j < r.height; j++) {
    for (let i = 0; i < r.width; i++) {
      if (r.data[(j * r.width + i) * 4 + 3] > 0) pts.push([r.x0 + (i + 0.5) * r.res, r.y1 - (j + 0.5) * r.res])
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

    const entries = await Promise.all((Object.keys(NETWORKS) as Network[]).map(async n => {
      const raster = await render(NETWORKS[n].layer, x0, y0, x1, y1, res)
      return [n, measure(geom, drawnPixels(raster))] as const
    }))
    const data = Object.fromEntries(entries) as GesutResult

    if (entries.every(([, d]) => d.distanceM === null)) {
      // Pusto w promieniu 100 m — sprawdzamy, czy KIUT ma tu w ogóle jakiekolwiek dane.
      const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2
      const layers = Object.values(NETWORKS).map(v => v.layer).join(',')
      const wide = await render(layers, cx - COVERAGE_WINDOW_M, cy - COVERAGE_WINDOW_M, cx + COVERAGE_WINDOW_M, cy + COVERAGE_WINDOW_M, 5)
      if (!drawnPixels(wide).length) return { status: 'not_covered', data: null }
      return { status: 'no_data', data }
    }
    return { status: 'ok', data }
  }))
}
