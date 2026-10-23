import { getParcelData, type ParcelData } from '../geoportal'
import type { SourceResult, SourceStatus } from '../http'
import { queryGdos, type GdosResult } from '../sources/gdos'
import { queryGesut, NETWORKS, type GesutResult, type Network } from '../sources/gesut'
import { queryIsok, SCENARIO_LABEL, type IsokResult } from '../sources/isok'
import { queryKimpzp, type KimpzpPlan } from '../sources/kimpzp'
import { queryOsmUtilities, type OsmUtilities } from '../sources/osm'
import { LINE_LABEL, queryPowerLines, TYPICAL_HALF_WIDTH_M, type PowerLinesResult } from '../sources/power-lines'
import type { Pog } from '../pog'
import { IN_FORCE_STATUS, queryRejestrPog, queryRuPogZones, type RuPog, type RuPogEntry } from '../sources/rejestr-urbanistyczny'
import { isWroclawTerc, queryWroclawMpzp, type WroclawMpzp } from '../wroclaw-mpzp'
import { queryWroclawPog } from '../wroclaw-pog'
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
  stale?: boolean
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
  pog: {
    /** Obowiązujący plan ogólny na działce (GIS Wrocławia albo geometria z Rejestru Urbanistycznego). */
    plan: Pog | null
    planStatus: SourceStatus
    /** Projekt planu (jeszcze nie obowiązuje) — tylko informacyjnie, nie wpływa na ocenę. */
    draft: Pog | null
    ru: RuPog | null
    inForce: boolean | null
    source: string | null
  }
  assessment: Assessment
  flood: IsokResult | null
  nature: GdosResult | null
  gesut: GesutResult | null
  gesutStatus: SourceStatus
  osm: OsmUtilities | null
  /** Linie napowietrzne i rurociągi z BDOT10k; gdy null, raport pokazuje OSM. */
  powerLines: PowerLinesResult | null
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
  return { source: r.source, status: r.status, error: r.error, ms: r.ms, fetchedAt: r.fetchedAt, ...(r.stale ? { stale: true } : {}) }
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

  // Strefy planu ogólnego z Rejestru Urbanistycznego: plan w mocy (do oceny) i projekt
  // (informacyjnie). Wrocław ma własne, aktualniejsze źródło — RU go pomija.
  const ruP = queryRejestrPog(parcel.terc)
  const ruZones = (pick: (r: RuPog) => RuPogEntry | null, name: string): Promise<SourceResult<Pog>> =>
    wroclaw
      ? Promise.resolve(skipped<Pog>(name))
      : ruP.then(r => {
        const entry = r.data ? pick(r.data) : null
        return entry ? queryRuPogZones(entry, parcelId, geom) : skipped<Pog>(name)
      })

  // Linie z własnych kafli BDOT10k; OSM (publiczny Overpass) tylko, gdy kafli nie ma albo zawiodły.
  const linesP = queryPowerLines(parcelId, geom)
  const osmP = linesP.then(r => (r.status === 'ok' || r.status === 'no_data'
    ? skipped<OsmUtilities>('Linie i rurociągi – OpenStreetMap')
    : queryOsmUtilities(parcelId, geom)))

  const [wMpzp, wPog, kimpzp, ru, ruPlan, ruDraft, isok, gdos, gesut, lines, osm, sip, utilityMapUrl] = await Promise.all([
    wroclaw ? queryWroclawMpzp(parcelId, geom) : Promise.resolve(skipped<WroclawMpzp>('MPZP – GIS UM Wrocławia')),
    wroclaw ? queryWroclawPog(parcelId, geom) : Promise.resolve(skipped<Pog>('Plan ogólny – GIS UM Wrocławia')),
    wroclaw ? Promise.resolve(skipped<KimpzpPlan[]>('MPZP – Krajowa Integracja MPZP (GUGiK)')) : queryKimpzp(parcelId, geom),
    ruP,
    ruZones(r => (r.inForce ? r.entry : null), 'Plan ogólny (strefy) – Rejestr Urbanistyczny'),
    ruZones(r => r.draft, 'Projekt planu ogólnego – Rejestr Urbanistyczny'),
    queryIsok(parcelId, geom),
    queryGdos(parcelId, geom),
    queryGesut(parcelId, geom),
    linesP,
    osmP,
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
  // Obowiązujący plan na działce: we Wrocławiu z GIS miasta, gdzie indziej z geometrii RU.
  const planSrc = wroclaw ? wPog : ruPlan
  const plan = pogInForce && planSrc.status === 'ok' ? planSrc.data : null
  const inOuz = plan ? !!plan.obszar_uzupelnienia_zabudowy : null

  const assessment = assessBuildability({
    mpzpCovered,
    pogInForce,
    pogSource,
    pogStatusText,
    inOuz,
    ouzSharePct: plan?.ouzSharePct ?? null,
    asOf: now.toISOString().slice(0, 10),
  })

  const findings = buildFindings({
    wMpzp: wMpzp.data, isok: isok.data, gdos: gdos.data, gesut: gesut.data, osm: osm.data, powerLines: lines.data, ru: ru.data, plan,
    draft: ruDraft.status === 'ok' ? ruDraft.data : null,
  })

  const { geom: _g, ...parcelPublic } = parcel
  void _g

  return {
    version: 2,
    parcelId,
    generatedAt: now.toISOString(),
    parcel: parcelPublic,
    mpzp: { covered: mpzpCovered, wroclaw: wMpzp.data, kimpzp: kimpzp.data, status: mpzpSrc.status },
    pog: {
      plan,
      planStatus: planSrc.status,
      draft: ruDraft.status === 'ok' ? ruDraft.data : null,
      ru: ru.data,
      inForce: pogInForce,
      source: pogSource,
    },
    assessment,
    flood: isok.data,
    nature: gdos.data,
    gesut: gesut.data,
    gesutStatus: gesut.status,
    osm: osm.data,
    powerLines: lines.data,
    sip,
    utilityMapUrl,
    findings,
    sources: [
      {
        source: 'Dane ewidencyjne – ULDK (GUGiK)', status: 'ok' as const, ms: 0,
        fetchedAt: parcel.fetchedAt ?? now.toISOString(), ...(parcel.stale ? { stale: true } : {}),
      },
      ...[wMpzp, wPog, kimpzp, ru, ruPlan, ruDraft, isok, gdos, gesut, lines, osm]
        .filter(s => !(s.status === 'not_covered' && s.ms === 0))
        .map(summary),
    ],
  }
}

export function buildFindings(d: {
  wMpzp: WroclawMpzp | null
  isok: IsokResult | null
  gdos: GdosResult | null
  gesut: GesutResult | null
  osm: OsmUtilities | null
  powerLines?: PowerLinesResult | null
  ru: RuPog | null
  plan: Pog | null
  draft: Pog | null
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
  if (d.powerLines) f.push(...powerLineFindings(d.powerLines))
  const hv = !d.powerLines && d.osm?.power.find(p => p.kind === 'linia napowietrzna' && p.distanceM <= 50)
  if (hv) {
    f.push({
      level: 'ryzyko',
      basis: 'uzbrojenie',
      text: `Napowietrzna linia elektroenergetyczna${hv.voltage ? ` (${Math.round(Number(hv.voltage.split(';')[0]) / 1000)} kV)` : ''} w odległości ${hv.distanceM} m od działki (OSM) — sprawdź pas technologiczny u operatora.`,
    })
  }
  if (d.ru?.entry && d.ru.entry.status !== IN_FORCE_STATUS && !d.plan) {
    f.push({ level: 'uwaga', basis: 'pog', text: `Plan ogólny gminy w Rejestrze Urbanistycznym: „${d.ru.entry.status}”.` })
  }
  if (d.draft) {
    const zones = d.draft.strefy.map(s => `${s.oznaczenie} (${s.nazwa ?? s.symbol})`).join(', ')
    const ouz = d.draft.obszar_uzupelnienia_zabudowy
      ? `w projektowanym obszarze uzupełnienia zabudowy (${Math.round(d.draft.ouzSharePct)}% działki)`
      : 'poza projektowanym obszarem uzupełnienia zabudowy'
    f.push({
      level: 'uwaga',
      basis: 'pog',
      text: `W projekcie planu ogólnego (${d.ru?.draft?.status ?? 'projekt'}) działka leży w strefie ${zones}, ${ouz}. Projekt nie obowiązuje i może się jeszcze zmienić.`,
    })
  }
  return f
}

const HAZARDOUS_PIPES = /gaz|naft|benzyn|paliw|produkt/i
const where = (h: { crosses: boolean; distanceM: number }) => (h.crosses ? 'przebiega przez działkę' : `w odległości ${h.distanceM} m od granicy działki`)

/** Ustalenia z linii i rurociągów BDOT10k (odległość liczona od granicy działki do osi linii). */
export function powerLineFindings(pl: PowerLinesResult): Finding[] {
  const f: Finding[] = []
  for (const klasa of ['EHV', 'HV'] as const) {
    const near = pl.lines.find(l => l.klasa === klasa) // posortowane od najbliższej
    if (!near) continue
    const half = TYPICAL_HALF_WIDTH_M[klasa]
    const label = LINE_LABEL[klasa][0].toUpperCase() + LINE_LABEL[klasa].slice(1)
    if (near.distanceM <= half) {
      f.push({
        level: 'ryzyko',
        basis: 'uzbrojenie',
        text: `${label} ${where(near)} (BDOT10k). Część działki może leżeć w pasie technologicznym linii (typowo ok. ${half} m od osi w każdą stronę), gdzie zabudowa jest ograniczona — szerokość pasa i warunki potwierdź u operatora sieci.`,
      })
    } else if (near.distanceM <= 100) {
      f.push({ level: 'uwaga', basis: 'uzbrojenie', text: `${label} w odległości ${near.distanceM} m od granicy działki (BDOT10k) — sprawdź u operatora zasięg pasa technologicznego.` })
    }
  }
  const mv = pl.lines.find(l => l.klasa === 'MV')
  if (mv && mv.distanceM <= TYPICAL_HALF_WIDTH_M.MV) {
    f.push({ level: 'uwaga', basis: 'uzbrojenie', text: `Napowietrzna linia średniego napięcia ${where(mv)} (BDOT10k) — możliwa służebność przesyłu i ograniczenia zabudowy pod linią.` })
  }
  const pipe = pl.pipelines.find(p => p.crosses || (HAZARDOUS_PIPES.test(p.rodzaj ?? '') && p.distanceM <= 20))
  if (pipe) {
    f.push({ level: 'uwaga', basis: 'uzbrojenie', text: `Rurociąg${pipe.rodzaj ? ` ${pipe.rodzaj}` : ''} ${where(pipe)} (BDOT10k) — strefa ochronna lub służebność może ograniczać zabudowę; sprawdź u operatora.` })
  }
  return f
}

