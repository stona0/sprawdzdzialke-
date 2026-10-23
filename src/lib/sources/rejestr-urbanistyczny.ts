/**
 * Rejestr Urbanistyczny (GUGiK / MRiT) — publiczne API listy opublikowanych planów
 * ogólnych gmin. Od 1.09.2026 to, czy gmina ma obowiązujący POG, decyduje o tym,
 * czy w ogóle można w niej uzyskać decyzję o warunkach zabudowy.
 * Uwaga: rejestr bywa opóźniony względem gmin (np. 19.10.2026 POG Wrocławia był
 * w nim jeszcze „w opracowaniu”, choć obowiązuje od 19.09.2026).
 */
import { cachedSource, fetchWithRetry, runSource, type SourceResult } from '../http'

const API = 'https://rejestr-urbanistyczny.gov.pl/api/public/published/query'
export const RU_PUBLIC_URL = 'https://rejestr-urbanistyczny.gov.pl/published/pog'

export interface RuPogEntry {
  tytul: string
  status: string
  obowiazujeOd: string | null
  dataPublikacji: string | null
  terc: string
  gmina: string
}

export interface RuPog {
  /** Wpis dla gminy działki (dopasowany po kodzie TERC), jeśli jest. */
  entry: RuPogEntry | null
  inForce: boolean
}

interface ApiAct {
  title: string
  spatialPlanningActStatus: string
  validFrom: string | null
  publishDate: string | null
  tercCode: string
  commune: string
}

export const IN_FORCE_STATUS = 'prawnie wiążący lub realizowany'

export async function queryRejestrPog(terc: string, communeName: string): Promise<SourceResult<RuPog>> {
  const name = communeName.replace(/\s*\(.*\)\s*/g, '').trim()
  return cachedSource(`ru-pog:${terc}`, 6 * 60 * 60 * 1000, () => runSource<RuPog>('Plan ogólny – Rejestr Urbanistyczny', async () => {
    const body = {
      page: { number: 1, size: 50, sort: { sortBy: 'publishDate', direction: 'desc' } },
      criteria: {
        query: name,
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
    const res = await fetchWithRetry(API, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeoutMs: 15_000,
    })
    if (!res.ok) throw new Error(`Rejestr Urbanistyczny HTTP ${res.status}`)
    const json = await res.json() as { publishedActs?: ApiAct[] }
    const act = (json.publishedActs ?? []).find(a => a.tercCode === terc)
    if (!act) return { status: 'no_data', data: { entry: null, inForce: false } }
    const entry: RuPogEntry = {
      tytul: act.title,
      status: act.spatialPlanningActStatus,
      obowiazujeOd: act.validFrom,
      dataPublikacji: act.publishDate,
      terc: act.tercCode,
      gmina: act.commune,
    }
    return { status: 'ok', data: { entry, inForce: entry.status === IN_FORCE_STATUS } }
  }))
}
