/**
 * Mapy zagrożenia i ryzyka powodziowego (MZP/MRP) — Wody Polskie / ISOK, usługa INSPIRE WMS.
 * GetFeatureInfo (JSON) w kilku punktach wewnątrz działki, jedno zapytanie na punkt.
 *  - NZ.Fluvial                               obszar zagrożenia powodzią rzeczną (Q10% / Q1% / Q0,2%)
 *  - NZ.ArtificialWaterBearingInfrastructure  zagrożenie od awarii budowli piętrzącej
 *  - NZ.RiskZone                              strefa ryzyka; scenariusz zakodowany w identyfikatorze
 *                                             (U10, U1, U02, UWZ = zniszczenie wału, UBP = budowla piętrząca)
 * Ograniczenie: MZP obejmują tylko rzeki z wyznaczonym ryzykiem powodziowym; brak
 * strefy nie oznacza, że terenu nigdy nie zalewa (podtopienia, małe cieki, opady nawalne).
 */
import { samplePoints, toWgs84, type MultiPolygon } from '../geo'
import { cacheableResult, cached, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'

const WMS = 'https://wody.isok.gov.pl/wss/INSPIRE/INSPIRE_NZ_HY_MZPMRP_WMS'
export const ISOK_MAP_URL = 'https://wody.isok.gov.pl/imap_kzgw/?gpmap=gpMZP'
const LAYERS = ['NZ.Fluvial', 'NZ.ArtificialWaterBearingInfrastructure', 'NZ.RiskZone']

export type FloodScenario = 'Q10' | 'Q1' | 'Q0.2' | 'WAL' | 'BUDOWLA'

export const SCENARIO_LABEL: Record<FloodScenario, string> = {
  Q10: 'Q10% – woda raz na 10 lat (wysokie prawdopodobieństwo)',
  Q1: 'Q1% – woda raz na 100 lat (średnie prawdopodobieństwo)',
  'Q0.2': 'Q0,2% – woda raz na 500 lat (niskie prawdopodobieństwo)',
  WAL: 'scenariusz zniszczenia wału przeciwpowodziowego',
  BUDOWLA: 'scenariusz awarii budowli piętrzącej (zapory)',
}
const ORDER: FloodScenario[] = ['Q10', 'Q1', 'Q0.2', 'WAL', 'BUDOWLA']

export interface IsokResult {
  scenarios: FloodScenario[]
  /** Obszar szczególnego zagrożenia powodzią (Q10% lub Q1%) — ograniczenia z Prawa wodnego. */
  oszp: boolean
  risk: Array<{ scenario: FloodScenario; level: string }>
  validTo: string | null
}

interface Feature {
  id?: string
  properties?: Record<string, unknown>
}

const RISK_CODE: Record<string, FloodScenario> = { U10: 'Q10', U1: 'Q1', U02: 'Q0.2', UWZ: 'WAL', UBP: 'BUDOWLA' }

export function summarizeIsok(features: Feature[]): IsokResult {
  const scen = new Set<FloodScenario>()
  const risk = new Map<string, { scenario: FloodScenario; level: string }>()
  let validTo: string | null = null
  for (const f of features) {
    const id = f.id ?? ''
    const p = f.properties ?? {}
    if (typeof p.validityperiod_end === 'string') validTo = p.validityperiod_end.slice(0, 10)
    if (id.startsWith('NZ.Fluvial.')) {
      const rp = String(p.loo_ql_returnperiod ?? '')
      if (rp === '10') scen.add('Q10')
      else if (rp === '100') scen.add('Q1')
      else if (rp === '500') scen.add('Q0.2')
    } else if (id.startsWith('NZ.ArtificialWaterBearingInfrastructure.')) {
      scen.add('BUDOWLA')
    } else if (id.startsWith('NZ.RiskZone.')) {
      const code = id.match(/\.(U(?:10|1|02|WZ|BP))-/)?.[1]
      const s = code ? RISK_CODE[code] : undefined
      if (s && typeof p.lor_qualitativevalue === 'string') {
        // Scenariusz zniszczenia wału widać w usłudze tylko poprzez strefę ryzyka.
        if (s === 'WAL') scen.add('WAL')
        risk.set(`${s}:${p.lor_qualitativevalue}`, { scenario: s, level: p.lor_qualitativevalue })
      }
    }
  }
  const scenarios = ORDER.filter(s => scen.has(s))
  return {
    scenarios,
    oszp: scenarios.includes('Q10') || scenarios.includes('Q1'),
    risk: [...risk.values()].sort((a, b) => ORDER.indexOf(a.scenario) - ORDER.indexOf(b.scenario)),
    validTo,
  }
}

async function gfi(lat: number, lng: number): Promise<Feature[]> {
  const layers = LAYERS.join(',')
  const d = 0.00005
  // WMS 1.3.0 + EPSG:4326 → kolejność osi lat,lon
  const url =
    `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${layers}&QUERY_LAYERS=${layers}&STYLES=` +
    `&CRS=EPSG:4326&BBOX=${lat - d},${lng - d},${lat + d},${lng + d}&WIDTH=11&HEIGHT=11&I=5&J=5` +
    `&INFO_FORMAT=application/json&FEATURE_COUNT=30`
  const res = await fetchWithRetry(url, { timeoutMs: 20_000, retries: 1 })
  if (!res.ok) throw new Error(`ISOK HTTP ${res.status}`)
  const text = await res.text()
  if (!text.trim().startsWith('{')) throw new Error('ISOK: odpowiedź nie jest JSON')
  return JSON.parse(text).features ?? []
}

export async function queryIsok(parcelId: string, geom: MultiPolygon): Promise<SourceResult<IsokResult>> {
  return cached(`isok:${parcelId}`, DAY, () => runSource('Zagrożenie powodziowe – ISOK / Wody Polskie', async () => {
    const pts = samplePoints(geom, 5).map(toWgs84)
    const features = (await Promise.all(pts.map(p => gfi(p.lat, p.lng)))).flat()
    const data = summarizeIsok(features)
    return { status: data.scenarios.length ? 'ok' : 'no_data', data }
  }), cacheableResult)
}
