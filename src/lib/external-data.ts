/**
 * external-data.ts
 * Queries public external data sources for automatic report enrichment:
 *  - GDOŚ WFS  → nature protection zones
 *  - OSM Overpass → utility infrastructure near the parcel
 */

const GDOS_WFS = 'https://sdi.gdos.gov.pl/wfs'
// Overpass instances tried in order until one succeeds
const OVERPASS_INSTANCES = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

// ─── GDOŚ WFS – nature / environmental protection zones ───────────────────────

const GDOS_LAYERS: Array<{ typeName: string; label: string }> = [
  { typeName: 'GDOS:ObszarySpecjalnejOchrony',    label: 'Natura 2000 (OSO)' },
  { typeName: 'GDOS:SpecjalneObszaryOchrony',     label: 'Natura 2000 (SOO)' },
  { typeName: 'GDOS:ParkiNarodowe',               label: 'Park Narodowy' },
  { typeName: 'GDOS:Rezerwaty',                   label: 'Rezerwat Przyrody' },
  { typeName: 'GDOS:ParkiKrajobrazowe',           label: 'Park Krajobrazowy' },
  { typeName: 'GDOS:ObszaryChronionegoKrajobrazu', label: 'Obszar Chronionego Krajobrazu' },
]

export interface GdosArea {
  type: string   // e.g. 'Natura 2000'
  name: string   // official name from WFS
}

export interface GdosResult {
  areas: GdosArea[]
  queried: boolean  // false = request failed entirely
}

/**
 * Query GDOŚ WFS for nature protection areas intersecting a ~300 m buffer
 * around the given WGS-84 coordinate.
 *
 * GDOŚ default CRS is EPSG:2180; to query with WGS-84 coordinates we must:
 *  - add SRSNAME=urn:ogc:def:crs:EPSG::4326
 *  - use BBOX in lat,lng order (Y,X) with that CRS appended
 * All GDOŚ features use the "nazwa" property for the official name.
 */
export async function queryGdosNature(lat: number, lng: number): Promise<GdosResult> {
  const delta = 0.003 // ~330 m at mid-Poland latitudes
  // Y,X order required for EPSG:4326 in WFS 2.0.0
  const bboxParam =
    `${(lat - delta).toFixed(6)},${(lng - delta).toFixed(6)},` +
    `${(lat + delta).toFixed(6)},${(lng + delta).toFixed(6)},` +
    `urn:ogc:def:crs:EPSG::4326`

  const areas: GdosArea[] = []
  let anyQueried = false

  await Promise.all(
    GDOS_LAYERS.map(async ({ typeName, label }) => {
      try {
        const url =
          `${GDOS_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
          `&TYPENAMES=${encodeURIComponent(typeName)}` +
          `&SRSNAME=urn:ogc:def:crs:EPSG::4326` +
          `&BBOX=${encodeURIComponent(bboxParam)}` +
          `&outputFormat=application%2Fjson` +
          `&count=10`

        const res = await fetchTimeout(url, {}, 15_000)
        if (!res.ok) return
        anyQueried = true

        const json = await res.json()
        const features: Array<{ properties?: Record<string, string | null> }> = json.features ?? []

        for (const f of features) {
          const p = f.properties ?? {}
          const name = p['nazwa'] ?? label
          // Deduplicate by type+name
          if (!areas.some(a => a.type === label && a.name === name)) {
            areas.push({ type: label, name: String(name) })
          }
        }
      } catch {
        // per-layer timeout / error – skip silently
      }
    })
  )

  // queried=true means ≥1 WFS request returned HTTP 200 (even if empty result)
  // queried=false means all requests failed/timed out → fall back to "verify manually"
  return { areas, queried: anyQueried }
}

// ─── OSM Overpass – utility infrastructure ────────────────────────────────────

export interface OsmUtilityResult {
  wodociag: boolean | null    // null = no OSM data found (not necessarily absent)
  kanalizacja: boolean | null
  gaz: boolean | null
  energia: boolean | null
}

/**
 * Query Overpass API for utility infrastructure within ~500 m of the parcel.
 *
 * Returns true if OSM confirms presence, null if not found in OSM
 * (OSM underground infrastructure is often incomplete in Poland – we never
 * return false / "definitely not present").
 */
export async function queryOsmUtilities(lat: number, lng: number): Promise<OsmUtilityResult> {
  const r = 500  // search radius in metres

  // Query pipelines by substance and power lines
  const query = `[out:json][timeout:25];
(
  way["man_made"="pipeline"]["substance"="water"](around:${r},${lat},${lng});
  way["man_made"="pipeline"]["substance"="sewage"](around:${r},${lat},${lng});
  way["man_made"="pipeline"]["substance"="gas"](around:${r},${lat},${lng});
  way["power"="line"](around:${r},${lat},${lng});
  way["power"="cable"](around:${r},${lat},${lng});
  way["power"="minor_line"](around:${r},${lat},${lng});
  node["man_made"="water_works"](around:${r * 2},${lat},${lng});
  node["man_made"="wastewater_plant"](around:${r * 2},${lat},${lng});
);
out tags;`

  // Overpass expects application/x-www-form-urlencoded with data= parameter
  // User-Agent is required by several public instances to avoid rate limiting
  const body = `data=${encodeURIComponent(query)}`
  const overpassOpts: RequestInit = {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'SprawdzDzialke/1.0 (https://sprawdzdzialke.pl; contact@sprawdzdzialke.pl)',
    },
  }

  async function tryOverpass(url: string): Promise<Response | null> {
    try {
      const res = await fetchTimeout(url, overpassOpts, 20_000)
      if (res.ok) return res
    } catch { /* try next */ }
    return null
  }

  try {
    let res: Response | null = null
    for (const url of OVERPASS_INSTANCES) {
      res = await tryOverpass(url)
      if (res) break
    }

    if (!res) return nullUtility()

    const data = await res.json()
    const elements: Array<{ tags?: Record<string, string> }> = data.elements ?? []

    let hasWater = false
    let hasSewage = false
    let hasGas = false
    let hasPower = false

    for (const el of elements) {
      const t = el.tags ?? {}
      const substance = t['substance'] ?? ''
      const power = t['power'] ?? ''
      const manMade = t['man_made'] ?? ''

      if (manMade === 'pipeline' && substance === 'water')  hasWater = true
      if (manMade === 'pipeline' && substance === 'sewage') hasSewage = true
      if (manMade === 'pipeline' && substance === 'gas')    hasGas = true
      if (power === 'line' || power === 'cable' || power === 'minor_line') hasPower = true
      if (manMade === 'water_works')     hasWater = true
      if (manMade === 'wastewater_plant') hasSewage = true
    }

    return {
      wodociag:    hasWater   ? true : null,
      kanalizacja: hasSewage  ? true : null,
      gaz:         hasGas     ? true : null,
      energia:     hasPower   ? true : null,
    }
  } catch {
    return nullUtility()
  }
}

function nullUtility(): OsmUtilityResult {
  return { wodociag: null, kanalizacja: null, gaz: null, energia: null }
}
