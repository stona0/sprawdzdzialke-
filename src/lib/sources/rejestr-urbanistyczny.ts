/**
 * Rejestr Urbanistyczny (GUGiK / MRiT) — publiczne API listy opublikowanych planów
 * ogólnych gmin. Od 1.09.2026 to, czy gmina ma obowiązujący POG, decyduje o tym,
 * czy w ogóle można w niej uzyskać decyzję o warunkach zabudowy.
 * `query` w POST /published/query przyjmuje kod TERC gminy.
 * Uwaga: rejestr bywa opóźniony względem gmin (np. 23.10.2026 POG Wrocławia był
 * w nim jeszcze „w opracowaniu”, choć obowiązuje od 19.09.2026).
 */
import { cachedSource, fetchWithRetry, runSource, type SourceResult } from '../http'

const API = 'https://rejestr-urbanistyczny.gov.pl/api/public'
export const RU_PUBLIC_URL = 'https://rejestr-urbanistyczny.gov.pl/published/pog'

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
