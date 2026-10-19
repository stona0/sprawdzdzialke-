import { getParcelData, type ParcelData } from '../geoportal'
import type { SourceResult, SourceStatus } from '../http'
import { queryGdos, type GdosResult } from '../sources/gdos'
import { queryGesut, NETWORKS, type GesutResult, type Network } from '../sources/gesut'
import { queryIsok, SCENARIO_LABEL, type IsokResult } from '../sources/isok'
import { queryKimpzp, type KimpzpPlan } from '../sources/kimpzp'
import { queryOsmUtilities, type OsmUtilities } from '../sources/osm'
import { IN_FORCE_STATUS, queryRejestrPog, type RuPog } from '../sources/rejestr-urbanistyczny'
import { isWroclawTerc, queryWroclawMpzp, type WroclawMpzp } from '../wroclaw-mpzp'
import { queryWroclawPog, type Pog } from '../wroclaw-pog'
import { assessBuildability, type Assessment } from './assessment'

export interface SipRow {
  wodociag?: string | null
  kanalizacja?: string | null
  gaz?: string | null
  energia?: string | null
  uwagi?: string | null
}

export interface SourceSummary {
  source: string
  status: SourceStatus
  error?: string
  ms: number
  fetchedAt: string
}

export interface Finding {
  level: 'ryzyko' | 'uwaga' | 'ok'
  text: string
  /** Klucz faktu, z którego wynika (do weryfikacji rekomendacji AI). */
  basis: string
}

export interface ReportData {
  version: 2
  parcelId: string
  generatedAt: string
  parcel: Omit<ParcelData, 'geom' | 'geomWkt'> & { geomWkt: string | null }
  mpzp: {
    covered: boolean | null
    wroclaw: WroclawMpzp | null
    kimpzp: KimpzpPlan[] | null
    status: SourceStatus
  }
  pog: { wroclaw: Pog | null; ru: RuPog | null; inForce: boolean | null; source: string | null }
  assessment: Assessment
  flood: IsokResult | null
  nature: GdosResult | null
  gesut: GesutResult | null
  gesutStatus: SourceStatus
  osm: OsmUtilities | null
  sip: SipRow | null
  utilityMapUrl: string | null
  findings: Finding[]
  sources: SourceSummary[]
}

export interface CollectDeps {
  /** Ręcznie wpisane dane o mediach dla gminy (tabela sip_layers). */
  sipLookup?: (gmina: string) => Promise<SipRow | null>
  utilityMap?: (lat: number, lng: number, geomWkt: string | null) => Promise<string | null>
  now?: () => Date
}

function summary(r: SourceResult<unknown>): SourceSummary {
  return { source: r.source, status: r.status, error: r.error, ms: r.ms, fetchedAt: r.fetchedAt }
}

const skipped = <T>(source: string): SourceResult<T> => ({
  source, status: 'not_covered', data: null, ms: 0, fetchedAt: new Date().toISOString(),
})

export class ParcelNotFoundError extends Error {
  constructor(parcelId: string) {
    super(`Nie znaleziono działki ${parcelId} w ULDK (GUGiK)`)
  }
}

export async function collectReportData(parcelId: string, gmina: string, deps: CollectDeps = {}): Promise<ReportData> {
  const now = deps.now?.() ?? new Date()
  const parcel = await getParcelData(parcelId, gmina)
  if (!parcel.found || !parcel.geom) throw new ParcelNotFoundError(parcelId)
  const geom = parcel.geom
  const wroclaw = isWroclawTerc(parcel.terc)

  const timed = <T>(p: Promise<T>, ms: number, fallback: T) =>
    Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), ms))])

  const [wMpzp, wPog, kimpzp, ru, isok, gdos, gesut, osm, sip, utilityMapUrl] = await Promise.all([
    wroclaw ? queryWroclawMpzp(parcelId, geom) : Promise.resolve(skipped<WroclawMpzp>('MPZP – GIS UM Wrocławia')),
    wroclaw ? queryWroclawPog(parcelId, geom) : Promise.resolve(skipped<Pog>('Plan ogólny – GIS UM Wrocławia')),
    wroclaw ? Promise.resolve(skipped<KimpzpPlan[]>('MPZP – Krajowa Integracja MPZP (GUGiK)')) : queryKimpzp(parcelId, geom),
    queryRejestrPog(parcel.terc, parcel.gmina),
    queryIsok(parcelId, geom),
    queryGdos(parcelId, geom),
    queryGesut(parcelId, geom),
    queryOsmUtilities(parcelId, geom),
    deps.sipLookup ? deps.sipLookup(parcel.gmina).catch(() => null) : Promise.resolve(null),
    deps.utilityMap && parcel.wspolrzedne
      ? timed(deps.utilityMap(parcel.wspolrzedne.lat, parcel.wspolrzedne.lng, parcel.geomWkt).catch(() => null), 30_000, null)
      : Promise.resolve(null),
  ])

  // ── MPZP ─────────────────────────────────────────────────────────────────
  const mpzpSrc = wroclaw ? wMpzp : kimpzp
  const mpzpCovered =
    mpzpSrc.status === 'ok' ? true
      : mpzpSrc.status === 'no_data' ? false
        : null

  // ── Plan ogólny ──────────────────────────────────────────────────────────
  let pogInForce: boolean | null = null
  let pogSource: string | null = null
  let pogStatusText: string | null = null
  if (wPog.status === 'ok') {
    pogInForce = true
    pogSource = 'GIS Urzędu Miejskiego Wrocławia'
  } else if (ru.status === 'ok' || ru.status === 'no_data') {
    pogInForce = ru.data?.inForce ?? false
    pogSource = 'Rejestru Urbanistycznego'
    pogStatusText = ru.data?.entry?.status ?? 'brak wpisu w rejestrze'
  }
  const inOuz = wPog.status === 'ok' ? !!wPog.data?.obszar_uzupelnienia_zabudowy : null

  const assessment = assessBuildability({
    mpzpCovered,
    pogInForce,
    pogSource,
    pogStatusText,
    inOuz,
    ouzSharePct: wPog.data?.ouzSharePct ?? null,
    asOf: now.toISOString().slice(0, 10),
  })

  const findings = buildFindings({
    wMpzp: wMpzp.data, isok: isok.data, gdos: gdos.data, gesut: gesut.data, osm: osm.data, ru: ru.data, wPog: wPog.data,
  })

  const { geom: _g, ...parcelPublic } = parcel
  void _g

  return {
    version: 2,
    parcelId,
    generatedAt: now.toISOString(),
    parcel: parcelPublic,
    mpzp: { covered: mpzpCovered, wroclaw: wMpzp.data, kimpzp: kimpzp.data, status: mpzpSrc.status },
    pog: { wroclaw: wPog.data, ru: ru.data, inForce: pogInForce, source: pogSource },
    assessment,
    flood: isok.data,
    nature: gdos.data,
    gesut: gesut.data,
    gesutStatus: gesut.status,
    osm: osm.data,
    sip,
    utilityMapUrl,
    findings,
    sources: [wMpzp, wPog, kimpzp, ru, isok, gdos, gesut, osm]
      .filter(s => !(s.status === 'not_covered' && s.ms === 0))
      .map(summary),
  }
}

export function buildFindings(d: {
  wMpzp: WroclawMpzp | null
  isok: IsokResult | null
  gdos: GdosResult | null
  gesut: GesutResult | null
  osm: OsmUtilities | null
  ru: RuPog | null
  wPog: Pog | null
}): Finding[] {
  const f: Finding[] = []
  if (d.isok?.oszp) {
    f.push({
      level: 'ryzyko',
      basis: 'powodz',
      text:
        `Działka leży w obszarze szczególnego zagrożenia powodzią (${d.isok.scenarios.filter(s => s === 'Q10' || s === 'Q1').map(s => SCENARIO_LABEL[s].split(' –')[0]).join(', ')}). ` +
        'Obowiązują ograniczenia z ustawy Prawo wodne; zabudowa wymaga uzgodnień z PGW Wody Polskie, a ubezpieczenie może być droższe.',
    })
  } else if (d.isok?.scenarios.length) {
    f.push({
      level: 'uwaga',
      basis: 'powodz',
      text: `Działka w zasięgu scenariusza: ${d.isok.scenarios.map(s => SCENARIO_LABEL[s]).join('; ')}.`,
    })
  }
  if (d.gdos?.onParcel.length) {
    f.push({
      level: 'ryzyko',
      basis: 'przyroda',
      text: `Działka leży w obszarze chronionym: ${d.gdos.onParcel.map(a => `${a.type} „${a.name}”`).join('; ')}. Inwestycja może wymagać oceny oddziaływania na środowisko i uzgodnień z RDOŚ.`,
    })
  } else if (d.gdos?.nearby.length) {
    f.push({
      level: 'uwaga',
      basis: 'przyroda',
      text: `W odległości do 300 m: ${d.gdos.nearby.map(a => `${a.type} „${a.name}”`).join('; ')}.`,
    })
  }
  if (d.wMpzp?.heritage.length) {
    f.push({ level: 'uwaga', basis: 'mpzp', text: `Działka w strefie ochrony: ${d.wMpzp.heritage.join('; ')} — projekt może wymagać uzgodnień konserwatorskich.` })
  }
  if (d.wMpzp?.archeologia) {
    f.push({ level: 'uwaga', basis: 'mpzp', text: 'Na działce występuje stanowisko archeologiczne — roboty ziemne mogą wymagać badań archeologicznych.' })
  }
  if (d.wMpzp?.plansPending.length) {
    f.push({
      level: 'uwaga',
      basis: 'mpzp',
      text: `Dla terenu trwają prace planistyczne: ${d.wMpzp.plansPending.map(p => `${p.tytul ?? p.nr} (${p.stan})`).join('; ')}. Ustalenia mogą się zmienić.`,
    })
  }
  const crosses = d.gesut
    ? (Object.keys(d.gesut) as Network[]).filter(n => d.gesut![n].crosses).map(n => NETWORKS[n].label.toLowerCase())
    : []
  if (crosses.length) {
    f.push({
      level: 'uwaga',
      basis: 'uzbrojenie',
      text: `Przez działkę przebiega: ${crosses.join(', ')} (wg KIUT). Może to oznaczać pas ochronny lub służebność przesyłu ograniczające zabudowę.`,
    })
  }
  const hv = d.osm?.power.find(p => p.kind === 'linia napowietrzna' && p.distanceM <= 50)
  if (hv) {
    f.push({
      level: 'ryzyko',
      basis: 'uzbrojenie',
      text: `Napowietrzna linia elektroenergetyczna${hv.voltage ? ` (${Math.round(Number(hv.voltage.split(';')[0]) / 1000)} kV)` : ''} w odległości ${hv.distanceM} m od działki (OSM) — sprawdź pas technologiczny u operatora.`,
    })
  }
  if (d.ru?.entry && d.ru.entry.status !== IN_FORCE_STATUS && !d.wPog) {
    f.push({ level: 'uwaga', basis: 'pog', text: `Plan ogólny gminy w Rejestrze Urbanistycznym: „${d.ru.entry.status}”.` })
  }
  return f
}
