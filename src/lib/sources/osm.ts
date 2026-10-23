/**
 * OpenStreetMap (Overpass) — linie elektroenergetyczne i rurociągi w pobliżu działki,
 * z odległością od granicy działki. OSM dobrze pokrywa napowietrzne linie WN/SN,
 * słabo sieci podziemne (wodociąg, kanalizacja, gaz w ulicach) — brak obiektu w OSM
 * NIE oznacza braku sieci.
 */
import { bbox, distanceToLine, fromWgs84, toWgs84, type MultiPolygon, type Pt } from '../geo'
import { cachedSource, DAY, runSource, USER_AGENT, type SourceResult } from '../http'

// overpass.osm.ch obsługuje tylko Szwajcarię (zwraca 200 i zero obiektów dla Polski),
// a overpass.kumi.systems regularnie nie odpowiada — oba usunięte.
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

export const OSM_RADIUS_M = 300

export interface OsmLine {
  kind: 'linia napowietrzna' | 'linia SN/nn' | 'kabel' | 'rurociąg'
  substance: string | null
  voltage: string | null
  operator: string | null
  distanceM: number
}

export interface OsmUtilities {
  power: OsmLine[]
  pipelines: OsmLine[]
  radiusM: number
}

interface OverpassWay {
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

async function overpass(query: string): Promise<OverpassWay[]> {
  const body = `data=${encodeURIComponent(query)}`
  const attempt = async (url: string) => {
    const res = await fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Overpass ${new URL(url).host}: HTTP ${res.status}`)
    const json = await res.json()
    if (json.remark && /runtime error|timed out/i.test(json.remark)) throw new Error(`Overpass: ${json.remark}`)
    return (json.elements ?? []) as OverpassWay[]
  }
  try {
    return await Promise.any(OVERPASS.map(attempt))
  } catch (e) {
    const errs = e instanceof AggregateError ? e.errors.map(x => (x as Error).message).join('; ') : String(e)
    throw new Error(`Wszystkie instancje Overpass zawiodły: ${errs}`)
  }
}

const SUBSTANCE_PL: Record<string, string> = {
  water: 'woda', sewage: 'ścieki', gas: 'gaz', heat: 'ciepło', oil: 'ropa', fuel: 'paliwo',
}

export function classifyWays(ways: OverpassWay[], parcel: MultiPolygon): OsmUtilities {
  const power: OsmLine[] = []
  const pipelines: OsmLine[] = []
  for (const w of ways) {
    const t = w.tags ?? {}
    const line: Pt[] = (w.geometry ?? []).map(p => fromWgs84({ lat: p.lat, lng: p.lon }))
    if (!line.length) continue
    const distanceM = Math.round(distanceToLine(parcel, line))
    if (distanceM > OSM_RADIUS_M) continue
    if (t.power) {
      power.push({
        kind: t.power === 'line' ? 'linia napowietrzna' : t.power === 'minor_line' ? 'linia SN/nn' : 'kabel',
        substance: null,
        voltage: t.voltage ?? null,
        operator: t.operator ?? null,
        distanceM,
      })
    } else if (t.man_made === 'pipeline') {
      pipelines.push({
        kind: 'rurociąg',
        substance: t.substance ? SUBSTANCE_PL[t.substance] ?? t.substance : null,
        voltage: null,
        operator: t.operator ?? null,
        distanceM,
      })
    }
  }
  const byDist = (a: OsmLine, b: OsmLine) => a.distanceM - b.distanceM
  return { power: power.sort(byDist), pipelines: pipelines.sort(byDist), radiusM: OSM_RADIUS_M }
}

export async function queryOsmUtilities(parcelId: string, geom: MultiPolygon): Promise<SourceResult<OsmUtilities>> {
  return cachedSource(`osm:${parcelId}`, DAY, () => runSource('Linie i rurociągi – OpenStreetMap', async () => {
    const [minx, miny, maxx, maxy] = bbox(geom)
    const sw = toWgs84([minx - OSM_RADIUS_M, miny - OSM_RADIUS_M])
    const ne = toWgs84([maxx + OSM_RADIUS_M, maxy + OSM_RADIUS_M])
    const b = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`
    const q = `[out:json][timeout:20];(
way["power"~"^(line|minor_line|cable)$"](${b});
way["man_made"="pipeline"](${b});
);out tags geom;`
    const data = classifyWays(await overpass(q), geom)
    return { status: data.power.length || data.pipelines.length ? 'ok' : 'no_data', data }
  }))
}
