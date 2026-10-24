/**
 * Rejestr Urbanistyczny (GUGiK / MRiT) — publiczne API opublikowanych planów ogólnych gmin.
 * Od 1.09.2026 to, czy gmina ma obowiązujący POG i czy działka leży w jego obszarze
 * uzupełnienia zabudowy (OUZ), decyduje o tym, czy można uzyskać decyzję o warunkach zabudowy.
 *
 * API (to samo, którego używa rejestr-urbanistyczny.gov.pl):
 *  - POST /published/query — lista planów; `query` przyjmuje kod TERC gminy,
 *  - GET /published-details/{id} — karta planu (uchwała),
 *  - GET /published-details/{id}/geometries — strefy planistyczne i obszary (OUZ, OZS)
 *    z poligonami w WGS84 [lat, lng],
 *  - GET /published-details/{id}/planning-zones?symbol=… — parametry stref.
 * Uwaga: rejestr bywa opóźniony względem gmin (np. 23.10.2026 POG Wrocławia był
 * w nim jeszcze „w opracowaniu”, choć obowiązuje od 19.09.2026).
 */
import { area, bbox, fromWgs84, intersectionArea, toWgs84, type MultiPolygon } from '../geo'
import { cachedSource, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'
import type { Pog, PogStrefa } from '../pog'

const API = 'https://rejestr-urbanistyczny.gov.pl/api/public'
export const RU_PUBLIC_URL = 'https://rejestr-urbanistyczny.gov.pl/published/pog'
export const ruPlanUrl = (actId: number) => `${RU_PUBLIC_URL}/${actId}`

export const IN_FORCE_STATUS = 'prawnie wiążący lub realizowany'
/** Wpisy planów, które jeszcze nie obowiązują. Inne statusy (np. archiwalne) pomijamy. */
const DRAFT_STATUSES = new Set(['w opracowaniu', 'w trakcie przyjmowania'])

export interface RuPogEntry {
  actId: number
  tytul: string
  status: string
  obowiazujeOd: string | null
  dataPublikacji: string | null
  terc: string
  gmina: string
}

export interface RuPog {
  /** Wpis decydujący o statusie: plan w mocy, a gdy go nie ma — najnowszy wpis gminy. */
  entry: RuPogEntry | null
  inForce: boolean
  /** Plan (lub jego nowa wersja) w opracowaniu, opublikowany nie wcześniej niż plan w mocy. */
  draft: RuPogEntry | null
}

interface ApiAct {
  publishedActId: number
  title: string
  spatialPlanningActStatus: string
  validFrom: string | null
  publishDate: string | null
  tercCode: string
  commune: string
}

const toEntry = (a: ApiAct): RuPogEntry => ({
  actId: a.publishedActId,
  tytul: a.title,
  status: a.spatialPlanningActStatus,
  obowiazujeOd: a.validFrom,
  dataPublikacji: a.publishDate,
  terc: a.tercCode,
  gmina: a.commune,
})

/**
 * Wybiera wpisy gminy z listy posortowanej od najnowszej publikacji. Plan w mocy ma
 * pierwszeństwo przed nowszym projektem — wcześniej brany był po prostu najnowszy
 * wpis, więc np. Radom (POG w mocy + nowsza wersja w opracowaniu) wychodził jako
 * gmina bez planu ogólnego.
 */
export function selectRuEntries(acts: ApiAct[], terc: string): RuPog {
  const mine = acts.filter(a => a.tercCode === terc).map(toEntry)
  const inForce = mine.find(e => e.status === IN_FORCE_STATUS) ?? null
  const draft = mine.find(e => DRAFT_STATUSES.has(e.status)
    && (!inForce || (e.dataPublikacji ?? '') >= (inForce.dataPublikacji ?? ''))) ?? null
  return { entry: inForce ?? mine[0] ?? null, inForce: !!inForce, draft }
}

const json = { 'Content-Type': 'application/json', Accept: 'application/json' }

export async function queryRejestrPog(terc: string): Promise<SourceResult<RuPog>> {
  return cachedSource(`ru-pog:${terc}`, 6 * 60 * 60 * 1000, () => runSource<RuPog>('Plan ogólny – Rejestr Urbanistyczny', async () => {
    const body = {
      page: { number: 1, size: 50, sort: { sortBy: 'publishDate', direction: 'desc' } },
      criteria: {
        query: terc,
        statusList: null,
        publishDateFrom: null,
        publishDateTo: null,
        planValidFrom: null,
        planValidTo: null,
        publishedActVersions: 'CURRENT',
        planTypeList: ['MUNICIPAL_GENERAL_PLAN'],
        plansGroup: 'MUNICIPAL_GENERAL_PLAN',
      },
    }
    const res = await fetchWithRetry(`${API}/published/query`, { method: 'POST', body: JSON.stringify(body), headers: json, timeoutMs: 15_000 })
    if (!res.ok) throw new Error(`Rejestr Urbanistyczny HTTP ${res.status}`)
    const data = selectRuEntries(((await res.json()) as { publishedActs?: ApiAct[] }).publishedActs ?? [], terc)
    return { status: data.entry ? 'ok' : 'no_data', data }
  }))
}

// ─── Strefy planu ogólnego na działce ─────────────────────────────────────────

type LatLngPair = [number, number]
interface ApiPolygon { exterior: LatLngPair[]; interiors: LatLngPair[][] }
export interface ApiFeature { designation: string; symbol: string; name: string; polygon: ApiPolygon }
export interface ApiGeometries { planningZones: ApiFeature[]; regulations: ApiFeature[]; validFrom: string | null; gmlStatus: string }
export interface ApiZoneDetails {
  designation: string
  basicProfiles: string[] | null
  additionalProfiles: string[] | null
  maxAboveGroundDevelopmentIntensity: number | null
  maxDevelopmentAreaPart: number | null
  maxDevelopmentHeight: string | null
  minBiologicallyActiveAreaPart: number | null
}

const MIN_ZONE_SHARE_PCT = 0.5
const MIN_AREA_SHARE_PCT = 0.1

const toMultiPolygon = (p: ApiPolygon): MultiPolygon =>
  [[p.exterior, ...p.interiors].map(r => r.map(([lat, lng]) => fromWgs84({ lat, lng })))]

/** Część wspólna działki z obiektami planu; najpierw tani filtr po prostokątach w WGS84. */
export function overlaps(parcel: MultiPolygon, features: ApiFeature[], minSharePct: number) {
  const parcelArea = area(parcel)
  const [x0, y0, x1, y1] = bbox(parcel)
  const corners = [toWgs84([x0, y0]), toWgs84([x1, y1]), toWgs84([x0, y1]), toWgs84([x1, y0])]
  const pad = 0.0005 // ~50 m — zapas na krzywiznę odwzorowania
  const lat0 = Math.min(...corners.map(c => c.lat)) - pad, lat1 = Math.max(...corners.map(c => c.lat)) + pad
  const lng0 = Math.min(...corners.map(c => c.lng)) - pad, lng1 = Math.max(...corners.map(c => c.lng)) + pad

  const hits: Array<{ feature: ApiFeature; sharePct: number }> = []
  for (const f of features) {
    const ext = f.polygon?.exterior
    if (!ext?.length) continue
    let fl0 = 90, fl1 = -90, fg0 = 180, fg1 = -180
    for (const [lat, lng] of ext) {
      if (lat < fl0) fl0 = lat
      if (lat > fl1) fl1 = lat
      if (lng < fg0) fg0 = lng
      if (lng > fg1) fg1 = lng
    }
    if (fl1 < lat0 || fl0 > lat1 || fg1 < lng0 || fg0 > lng1) continue
    const sharePct = (intersectionArea(parcel, toMultiPolygon(f.polygon)) / parcelArea) * 100
    if (sharePct >= minSharePct) hits.push({ feature: f, sharePct })
  }
  return hits.sort((a, b) => b.sharePct - a.sharePct)
}

/** „12 m”, „12,5 m” → liczba metrów. */
export function parseHeight(v: string | null | undefined): number | null {
  const m = v?.match(/\d+(?:[.,]\d+)?/)
  return m ? Number(m[0].replace(',', '.')) : null
}

export function pogFromRu(
  parcel: MultiPolygon,
  g: ApiGeometries,
  details: Map<string, ApiZoneDetails>,
  meta: { uchwala: string | null; url: string; zrodlo: string },
): Pog | null {
  const zones = overlaps(parcel, g.planningZones, MIN_ZONE_SHARE_PCT)
  if (!zones.length) return null
  const ouz = overlaps(parcel, g.regulations.filter(r => r.symbol === 'OUZ'), MIN_AREA_SHARE_PCT)
  const ozs = overlaps(parcel, g.regulations.filter(r => r.symbol === 'OZS'), MIN_AREA_SHARE_PCT)
  const strefy: PogStrefa[] = zones.map(({ feature: f, sharePct }) => {
    const d = details.get(f.designation)
    return {
      oznaczenie: f.designation,
      symbol: f.symbol,
      nazwa: f.name,
      maks_intensywnosc: d?.maxAboveGroundDevelopmentIntensity ?? null,
      maks_udzial_zabudowy: d?.maxDevelopmentAreaPart ?? null,
      maks_wysokosc: parseHeight(d?.maxDevelopmentHeight),
      min_pbc: d?.minBiologicallyActiveAreaPart ?? null,
      profil_podstawowy: d?.basicProfiles ?? [],
      profil_dodatkowy: d?.additionalProfiles ?? [],
      sharePct: +sharePct.toFixed(1),
    }
  })
  return {
    strefy,
    obszar_uzupelnienia_zabudowy: ouz.length ? ouz.map(h => h.feature.designation).join(', ') : null,
    ouzSharePct: +Math.min(100, ouz.reduce((s, h) => s + h.sharePct, 0)).toFixed(1),
    obszar_zabudowy_srodmiejskiej: ozs.length ? ozs[0].feature.designation : null,
    obowiazuje_od: g.gmlStatus === 'LEGAL_FORCE' ? g.validFrom : null,
    uchwala: meta.uchwala,
    zrodlo: meta.zrodlo,
    url: meta.url,
  }
}

async function getJson<T>(path: string, timeoutMs: number): Promise<T> {
  const res = await fetchWithRetry(`${API}${path}`, { headers: { Accept: 'application/json' }, timeoutMs })
  if (!res.ok) throw new Error(`Rejestr Urbanistyczny ${path.split('?')[0]}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** Parametry stref (wysokość, intensywność, PBC, profile) — jedno zapytanie na symbol strefy. */
async function zoneDetails(actId: number, symbols: string[]): Promise<Map<string, ApiZoneDetails>> {
  const out = new Map<string, ApiZoneDetails>()
  await Promise.all(symbols.map(async symbol => {
    try {
      const rows = await getJson<ApiZoneDetails[]>(`/published-details/${actId}/planning-zones?symbol=${encodeURIComponent(symbol)}&page=1&pageSize=1000`, 15_000)
      for (const r of rows) out.set(r.designation, r)
    } catch (e) {
      // Bez parametrów strefa i OUZ nadal są wiarygodne — raport pokaże „—”.
      console.warn(`[ru] parametry stref ${symbol} (plan ${actId}):`, e instanceof Error ? e.message : e)
    }
  }))
  return out
}

async function resolution(actId: number): Promise<string | null> {
  try {
    const d = await getJson<{ documentsSection?: Array<{ typeName?: string }> }>(`/published-details/${actId}`, 10_000)
    const name = d.documentsSection?.find(x => /^Uchwała/i.test(x.typeName ?? ''))?.typeName ?? null
    // Treść bywa łamana znakami nowej linii (np. Radom) — normalizujemy białe znaki.
    return name?.replace(/\s+/g, ' ').split(/ w sprawie /i)[0].trim() ?? null
  } catch {
    return null
  }
}

/**
 * Strefy planu ogólnego i obszary (OUZ, OZS) na działce, z geometrii planu
 * opublikowanej w Rejestrze Urbanistycznym. Dla projektu (`entry` nie w mocy)
 * wynik jest informacyjny — nie wpływa na ocenę zabudowy.
 */
export async function queryRuPogZones(entry: RuPogEntry, parcelId: string, geom: MultiPolygon): Promise<SourceResult<Pog>> {
  const isDraft = entry.status !== IN_FORCE_STATUS
  const source = isDraft ? 'Projekt planu ogólnego – Rejestr Urbanistyczny' : 'Plan ogólny (strefy) – Rejestr Urbanistyczny'
  return cachedSource(`ru-pog-zones:${entry.actId}:${parcelId}`, DAY, () => runSource<Pog>(source, async () => {
    const [geometries, uchwala] = await Promise.all([
      getJson<ApiGeometries[]>(`/published-details/${entry.actId}/geometries`, 45_000),
      isDraft ? Promise.resolve(null) : resolution(entry.actId),
    ])
    const g = geometries[0]
    if (!g) return { status: 'no_data', data: null }
    const symbols = [...new Set(overlaps(geom, g.planningZones, MIN_ZONE_SHARE_PCT).map(h => h.feature.symbol))]
    const details = await zoneDetails(entry.actId, symbols)
    const data = pogFromRu(geom, g, details, { uchwala, url: ruPlanUrl(entry.actId), zrodlo: 'Rejestr Urbanistyczny' })
    return { status: data ? 'ok' : 'no_data', data }
  }))
}
