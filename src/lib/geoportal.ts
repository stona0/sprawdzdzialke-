const ULDK_BASE = 'https://uldk.gugik.gov.pl/service.php'
const TIMEOUT_MS = 10_000

export interface ParcelData {
  parcelId: string
  numer: string
  powierzchnia: number | null
  obreb: string | null
  gmina: string
  powiat: string | null
  wojewodztwo: string | null
  wspolrzedne: { lat: number; lng: number } | null
  geomWkt: string | null  // raw WKT polygon in EPSG:2180 (for boundary drawing on map)
  found: boolean
}

// Format identyfikatora EGB: TERYT_GMINY.NUMER_OBREBU.NUMER_DZIALKI
// Przykład: 141201_1.0001.6/2  lub  0261011.0001.AR_1.6/3
// Użytkownik może skopiować go z geoportal.gov.pl (kliknij na działkę → "Identyfikator")
export function isFullEgbId(id: string): boolean {
  return id.includes('.')
}

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(id)
  }
}

// Wzór Gaussa (Shoelace) na współrzędnych EPSG:2180 (metry) → wynik w m²
function calcAreaM2(wkt: string): number | null {
  const pairs = wkt.match(/-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g)
  if (!pairs || pairs.length < 3) return null
  const pts = pairs.map(p => p.trim().split(/\s+/).map(Number) as [number, number])
  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % n]
    area += x1 * y2 - x2 * y1
  }
  return Math.round(Math.abs(area) / 2)
}

// Przybliżona konwersja centroidu z EPSG:2180 → WGS84 (dokładność ~100m, OK dla MVP)
function parseCentroid(wkt: string): { lat: number; lng: number } | null {
  const pairs = wkt.match(/-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g)
  if (!pairs || pairs.length === 0) return null

  let sumX = 0, sumY = 0
  for (const p of pairs) {
    const [x, y] = p.trim().split(/\s+/).map(Number)
    sumX += x
    sumY += y
  }
  const cx = sumX / pairs.length
  const cy = sumY / pairs.length

  // CS92 (EPSG:2180): false easting=500000, false northing=-5300000, scale=0.9993
  const lat = (cy + 5_300_000) / (111_320 * 0.9993)
  const lng = 19.0 + (cx - 500_000) / (111_320 * 0.9993 * Math.cos((lat * Math.PI) / 180))
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }
}

export async function getParcelData(parcelId: string, gmina: string): Promise<ParcelData> {
  const url =
    `${ULDK_BASE}?request=GetParcelById` +
    `&id=${encodeURIComponent(parcelId)}` +
    `&result=geom_wkt,voivodeship,county,commune,region,parcel`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      return parseULDKResponse(text, parcelId, gmina)
    } catch (e) {
      lastError = e as Error
      if (attempt < 2) await sleep(600 * (attempt + 1))
    }
  }
  throw lastError ?? new Error('Błąd połączenia z Geoportal ULDK')
}

function parseULDKResponse(text: string, parcelId: string, gmina: string): ParcelData {
  const lines = text.trim().split('\n')
  // ULDK zwraca 0-based index (0 = 1 wynik), więc sprawdzamy tylko czy jest linia z danymi
  if (!lines[1] || lines[1].trim() === '') {
    return notFound(parcelId, gmina)
  }

  // Format: SRID=2180;geom_wkt|voivodeship|county|commune|region|parcel
  const parts = lines[1].split('|')
  if (parts.length < 5) return notFound(parcelId, gmina)

  const geomWkt = parts[0]
  const [, voivodeship, county, commune, region, parcel] = parts

  return {
    parcelId,
    numer: parcel?.trim() ?? parcelId,
    powierzchnia: calcAreaM2(geomWkt),
    obreb: region?.trim() ?? null,
    gmina: commune?.trim() ?? gmina,
    powiat: county?.trim() ?? null,
    wojewodztwo: voivodeship?.trim() ?? null,
    wspolrzedne: parseCentroid(geomWkt),
    geomWkt: geomWkt ?? null,
    found: true,
  }
}

function notFound(parcelId: string, gmina: string): ParcelData {
  return {
    parcelId, numer: parcelId,
    powierzchnia: null, obreb: null,
    gmina, powiat: null, wojewodztwo: null,
    wspolrzedne: null, geomWkt: null, found: false,
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
