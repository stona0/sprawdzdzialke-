import { area, interiorPoint, parseWkt, toWgs84, type MultiPolygon } from './geo'
import { cached, DAY, fetchWithRetry } from './http'

const ULDK_BASE = 'https://uldk.gugik.gov.pl/service.php'

export interface ParcelData {
  parcelId: string
  numer: string
  powierzchnia: number | null
  obreb: string | null
  gmina: string
  /** Kod jednostki ewidencyjnej z identyfikatora, np. "026401_1". */
  teryt: string
  /** 6-cyfrowy kod TERC gminy, np. "026401". */
  terc: string
  powiat: string | null
  wojewodztwo: string | null
  /** Punkt na pewno wewnątrz działki (WGS84). */
  wspolrzedne: { lat: number; lng: number } | null
  /** Surowy WKT z ULDK w EPSG:2180. */
  geomWkt: string | null
  /** Geometria działki w EPSG:2180 (metry). */
  geom: MultiPolygon | null
  found: boolean
  /** Kiedy pobrano dane z ULDK. */
  fetchedAt?: string
  /** Kopia z trwałego cache — ULDK nie odpowiadało. */
  stale?: boolean
}

// Format identyfikatora EGB: JEDN_EWID.OBREB.NUMER, np. 141201_1.0001.6/2 lub 0261011.0001.AR_1.6/3
export function isFullEgbId(id: string): boolean {
  return id.includes('.')
}

export function terytFromParcelId(parcelId: string): string {
  const dot = parcelId.indexOf('.')
  return dot > 0 ? parcelId.slice(0, dot) : ''
}

export function tercFromParcelId(parcelId: string): string {
  return terytFromParcelId(parcelId).slice(0, 6)
}

export async function getParcelData(parcelId: string, gmina: string): Promise<ParcelData> {
  // Brak działki to odpowiedź, nie awaria — kopii używamy tylko, gdy ULDK nie odpowiada.
  return cached(`uldk:${parcelId}`, DAY, () => fetchParcel(parcelId, gmina), { shouldCache: p => p.found, staleOnThrow: p => ({ ...p, stale: true }) })
}

async function fetchParcel(parcelId: string, gmina: string): Promise<ParcelData> {
  const url =
    `${ULDK_BASE}?request=GetParcelById` +
    `&id=${encodeURIComponent(parcelId)}` +
    `&result=geom_wkt,voivodeship,county,commune,region,parcel`
  const res = await fetchWithRetry(url, { timeoutMs: 10_000, retries: 2 })
  if (!res.ok) throw new Error(`Geoportal ULDK: HTTP ${res.status}`)
  return { ...parseULDKResponse(await res.text(), parcelId, gmina), fetchedAt: new Date().toISOString() }
}

export function parseULDKResponse(text: string, parcelId: string, gmina: string): ParcelData {
  const lines = text.trim().split('\n')
  // Pierwsza linia to status (0 = OK, -1 = brak wyniku/błąd); dane są w linii 2.
  if (lines[0].trim().startsWith('-1') || !lines[1] || lines[1].trim() === '') return notFound(parcelId, gmina)

  const parts = lines[1].split('|')
  if (parts.length < 5) return notFound(parcelId, gmina)

  const [geomWkt, voivodeship, county, commune, region, parcel] = parts
  const geom = parseWkt(geomWkt)
  const inner = geom.length ? toWgs84(interiorPoint(geom)) : null

  return {
    parcelId,
    numer: parcel?.trim() || parcelId,
    powierzchnia: geom.length ? Math.round(area(geom)) : null,
    obreb: region?.trim() || null,
    gmina: commune?.trim() || gmina,
    teryt: terytFromParcelId(parcelId),
    terc: tercFromParcelId(parcelId),
    powiat: county?.trim() || null,
    wojewodztwo: voivodeship?.trim() || null,
    wspolrzedne: inner ? { lat: +inner.lat.toFixed(6), lng: +inner.lng.toFixed(6) } : null,
    geomWkt: geomWkt || null,
    geom: geom.length ? geom : null,
    found: true,
  }
}

function notFound(parcelId: string, gmina: string): ParcelData {
  return {
    parcelId, numer: parcelId,
    powierzchnia: null, obreb: null,
    gmina, teryt: terytFromParcelId(parcelId), terc: tercFromParcelId(parcelId),
    powiat: null, wojewodztwo: null,
    wspolrzedne: null, geomWkt: null, geom: null, found: false,
  }
}
