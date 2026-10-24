/**
 * Linie elektroenergetyczne i rurociągi z BDOT10k (GUGiK) — format danych przygotowanych
 * przez ETL (scripts/etl/bdot-power-lines.mts) i czytanych przy generowaniu raportu.
 *
 * BDOT10k (klasy OT_SULN_L, OT_SUPR_L) obejmuje napowietrzne linie średniego, wysokiego
 * i najwyższego napięcia oraz rurociągi; NIE zawiera linii niskiego napięcia ani kabli
 * podziemnych. Współrzędne w EPSG:2180, kolejność (x = wschód, y = północ), jak w ULDK.
 * Dane są dzielone na kafle TILE_M × TILE_M, żeby raport pobierał tylko okolicę działki.
 */
import type { Pt } from './geo'

export const TILE_M = 10_000
export const FORMAT_VERSION = 1

/** EHV = najwyższe (220–400 kV), HV = wysokie (110 kV), MV = średnie (SN, zwykle 15–30 kV). */
export type LineClass = 'EHV' | 'HV' | 'MV'

export interface TileFeature {
  /** lokalnyId z BDOT10k */
  i: string
  /** klasa linii albo 'PIPE' dla rurociągu */
  t: LineClass | 'PIPE'
  /** rodzaj rurociągu (np. „gazowy”) */
  r?: string
  /** kategoria istnienia, gdy inna niż „eksploatowany” (np. „nieczynny”, „w budowie”) */
  s?: string
  /** kod TERYT powiatu — klucz do daty aktualizacji danych w manifeście */
  p: string
  /** współrzędne [x0, y0, x1, y1, …] zaokrąglone do 0,1 m */
  c: number[]
}

export interface PowerTile {
  v: number
  f: TileFeature[]
}

export interface PowerManifest {
  v: number
  /** Folder wersji danych w magazynie (np. „20261023”). */
  version: string
  generatedAt: string
  tileM: number
  /** Klucze niepustych kafli — brak klucza = w kaflu nie ma linii ani rurociągów. */
  tiles: string[]
  powiaty: Record<string, { nazwa: string; data: string }>
}

const LINE_CLASS: Record<string, LineClass> = {
  'linia elektroenergetyczna najwyższego napięcia': 'EHV',
  'linia elektroenergetyczna wysokiego napięcia': 'HV',
  'linia elektroenergetyczna średniego napięcia': 'MV',
}

const ACTIVE = 'eksploatowany'

const text = (xml: string, tag: string) => xml.match(new RegExp(`<ot:${tag}>([^<]*)</ot:${tag}>`))?.[1]?.trim() ?? null

function coords(xml: string): number[] {
  const out: number[] = []
  for (const m of xml.matchAll(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)) {
    const nums = m[1].trim().split(/\s+/).map(Number)
    for (let k = 0; k + 1 < nums.length; k += 2) {
      const x = Math.round(nums[k] * 10) / 10, y = Math.round(nums[k + 1] * 10) / 10
      // kolejne segmenty krzywej zaczynają się w punkcie, w którym skończył się poprzedni
      if (out.length && out[out.length - 2] === x && out[out.length - 1] === y) continue
      out.push(x, y)
    }
  }
  return out
}

/**
 * Obiekty z pliku klasy OT_SULN_L (linie) albo OT_SUPR_L (rurociągi) z paczki powiatowej.
 * Linie spoza trzech klas napięcia są pomijane i liczone w `skipped`.
 */
export function parseBdotXml(xml: string, cls: 'SULN' | 'SUPR', powiat: string): { features: TileFeature[]; skipped: number } {
  const re = cls === 'SULN' ? /<ot:OT_SULN_L\b[\s\S]*?<\/ot:OT_SULN_L>/g : /<ot:OT_SUPR_L\b[\s\S]*?<\/ot:OT_SUPR_L>/g
  const features: TileFeature[] = []
  let skipped = 0
  for (const [f] of xml.matchAll(re)) {
    const id = text(f, 'lokalnyId')
    const rodzaj = text(f, 'rodzaj')
    const c = coords(f)
    const t = cls === 'SULN' ? LINE_CLASS[rodzaj ?? ''] : 'PIPE'
    if (!id || !t || c.length < 4) {
      skipped++
      continue
    }
    const kat = text(f, 'kategoriaIstnienia')
    features.push({
      i: id, t, p: powiat, c,
      ...(cls === 'SUPR' && rodzaj ? { r: rodzaj } : {}),
      ...(kat && kat !== ACTIVE ? { s: kat } : {}),
    })
  }
  return { features, skipped }
}

export const tileKey = (tx: number, ty: number) => `${tx}_${ty}`

/** Klucze kafli pokrywających prostokąt [minx, miny, maxx, maxy]. */
export function tilesForBbox([minx, miny, maxx, maxy]: [number, number, number, number], tileM = TILE_M): string[] {
  const keys: string[] = []
  for (let tx = Math.floor(minx / tileM); tx <= Math.floor(maxx / tileM); tx++) {
    for (let ty = Math.floor(miny / tileM); ty <= Math.floor(maxy / tileM); ty++) keys.push(tileKey(tx, ty))
  }
  return keys
}

export function featureBbox(c: number[]): [number, number, number, number] {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (let k = 0; k + 1 < c.length; k += 2) {
    if (c[k] < minx) minx = c[k]
    if (c[k] > maxx) maxx = c[k]
    if (c[k + 1] < miny) miny = c[k + 1]
    if (c[k + 1] > maxy) maxy = c[k + 1]
  }
  return [minx, miny, maxx, maxy]
}

export function featurePoints(c: number[]): Pt[] {
  const pts: Pt[] = []
  for (let k = 0; k + 1 < c.length; k += 2) pts.push([c[k], c[k + 1]])
  return pts
}

/** Rozkłada obiekty na kafle (obiekt trafia do każdego kafla, który przecina jego prostokąt). */
export function addToTiles(tiles: Map<string, TileFeature[]>, features: TileFeature[], tileM = TILE_M) {
  for (const f of features) {
    for (const key of tilesForBbox(featureBbox(f.c), tileM)) {
      const list = tiles.get(key)
      if (list) list.push(f)
      else tiles.set(key, [f])
    }
  }
}
