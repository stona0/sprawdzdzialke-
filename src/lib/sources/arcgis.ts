import { area, intersectionArea, pointInMultiPolygon, type MultiPolygon, type Pt, type Ring } from '../geo'
import { fetchWithRetry } from '../http'

type Attrs = Record<string, string | number | null>

export interface ArcgisHit {
  attributes: Attrs
  /** Pole części wspólnej strefy i działki [m²]. */
  overlapM2: number
  /** Udział strefy w powierzchni działki [%]. */
  sharePct: number
}

function signedArea(r: Ring): number {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i]
    const [x2, y2] = r[(i + 1) % r.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

/** Esri: pierścienie zewnętrzne zgodnie z ruchem wskazówek zegara, dziury przeciwnie. */
function toEsriRings(mp: MultiPolygon): number[][][] {
  const out: number[][][] = []
  for (const [outer, ...holes] of mp) {
    out.push(signedArea(outer) > 0 ? [...outer].reverse() : outer)
    for (const h of holes) out.push(signedArea(h) < 0 ? [...h].reverse() : h)
  }
  return out
}

export function esriRingsToMultiPolygon(rings: number[][][]): MultiPolygon {
  const outers: MultiPolygon = []
  const holes: Ring[] = []
  for (const r of rings as Pt[][]) (signedArea(r) < 0 ? outers.push([r]) : holes.push(r))
  for (const h of holes) {
    const owner = outers.find(p => pointInMultiPolygon(h[0], [[p[0]]]))
    if (owner) owner.push(h)
  }
  return outers
}

/**
 * Zwraca obiekty warstwy ArcGIS MapServer przecinające działkę (EPSG:2180)
 * wraz z udziałem każdego w powierzchni działki. Obiekty stykające się tylko
 * krawędzią (udział < minSharePct) są pomijane.
 */
export async function queryByParcel(
  layerUrl: string,
  parcel: MultiPolygon,
  outFields: string,
  { minSharePct = 0.5, timeoutMs = 15_000 } = {},
): Promise<ArcgisHit[]> {
  const body = new URLSearchParams({
    geometry: JSON.stringify({ rings: toEsriRings(parcel), spatialReference: { wkid: 2180 } }),
    geometryType: 'esriGeometryPolygon',
    inSR: '2180',
    outSR: '2180',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'true',
    geometryPrecision: '2',
    f: 'json',
  })
  const res = await fetchWithRetry(`${layerUrl}/query`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeoutMs,
  })
  if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(`ArcGIS: ${json.error.message}`)

  const parcelArea = area(parcel)
  const hits: ArcgisHit[] = []
  for (const f of json.features ?? []) {
    const rings = f.geometry?.rings as number[][][] | undefined
    const overlap = rings ? intersectionArea(parcel, esriRingsToMultiPolygon(rings)) : 0
    const share = parcelArea > 0 ? (overlap / parcelArea) * 100 : 0
    if (share >= minSharePct) hits.push({ attributes: f.attributes, overlapM2: overlap, sharePct: share })
  }
  return hits.sort((a, b) => b.sharePct - a.sharePct)
}

export function str(v: string | number | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

export function num(v: string | number | null | undefined): number | null {
  return typeof v === 'number' ? v : null
}
