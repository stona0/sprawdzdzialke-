/**
 * Krajowa Integracja Miejscowych Planów Zagospodarowania Przestrzennego (GUGiK).
 * Usługa pośredniczy w zapytaniach do serwisów gmin, więc format atrybutów zależy
 * od gminy: raz dostajemy dane aktu (APP: tytuł, uchwała, obowiązuje od), raz
 * przeznaczenie terenu z symbolem. Odpowiada tylko dla punktu — pytamy o punkt
 * na pewno wewnątrz działki.
 */
import { interiorPoint, type MultiPolygon } from '../geo'
import { cacheableResult, cached, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'
import { gfiUrl2180, parseHtmlTables } from './wms'

const KIMPZP =
  'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego'

export interface KimpzpPlan {
  tytul: string | null
  symbol: string | null
  przeznaczenie: string | null
  uchwala: string | null
  obowiazujeOd: string | null
  status: string | null
  link: string | null
  warstwa: string | null
}

const norm = (k: string) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

function pick(row: Record<string, string>, ...candidates: string[]): string | null {
  const entries = Object.entries(row).map(([k, v]) => [norm(k), v.trim()] as const)
  for (const c of candidates) {
    const hit = entries.find(([k, v]) => k === c && v)
    if (hit) return hit[1]
  }
  return null
}

export function parseKimpzpHtml(html: string): { status: 'ok' | 'no_data' | 'not_covered'; plans: KimpzpPlan[] } {
  const text = html.replace(/<[^>]+>/g, ' ')
  if (/brak serwisu dla wskazanego obszaru/i.test(text)) return { status: 'not_covered', plans: [] }

  const plans: KimpzpPlan[] = []
  for (const t of parseHtmlTables(html)) {
    for (const row of t.rows) {
      const plan: KimpzpPlan = {
        tytul: pick(row, 'tytul', 'nazwampzp', 'nazwaplanu', 'name', 'nazwa'),
        symbol: pick(row, 'oznaczenie', 'symbol', 'symbolterenu', 'oznaczenieterenu'),
        przeznaczenie: pick(row, 'opisoznac', 'przeznaczenie', 'opisprzeznaczenia', 'rodzajoznaczenia'),
        uchwala: pick(row, 'uchwalenie', 'numeruchwaly', 'nruchwaly', 'uchwala', 'dokumentuchwalajacy'),
        obowiazujeOd: pick(row, 'obowiazujeod', 'dataobowiazywania', 'dataobowiazywaniaod'),
        status: pick(row, 'state', 'statustitle', 'status'),
        link: pick(row, 'www', 'xlinkhref', 'link', 'url'),
        warstwa: t.layer,
      }
      if (plan.tytul || plan.symbol || plan.uchwala) plans.push(plan)
    }
  }
  const unique = plans.filter(
    (p, i) => plans.findIndex(q => q.tytul === p.tytul && q.symbol === p.symbol && q.uchwala === p.uchwala) === i,
  )
  return { status: unique.length ? 'ok' : 'no_data', plans: unique }
}

export async function queryKimpzp(parcelId: string, geom: MultiPolygon): Promise<SourceResult<KimpzpPlan[]>> {
  return cached(`kimpzp:${parcelId}`, DAY, () => runSource('MPZP – Krajowa Integracja MPZP (GUGiK)', async () => {
    const url = gfiUrl2180(KIMPZP, ['plany'], interiorPoint(geom), 'text/html')
    const res = await fetchWithRetry(url, { timeoutMs: 20_000, retries: 1 })
    if (!res.ok) throw new Error(`KIMPZP HTTP ${res.status}`)
    const { status, plans } = parseKimpzpHtml(await res.text())
    return { status, data: plans }
  }), cacheableResult)
}
