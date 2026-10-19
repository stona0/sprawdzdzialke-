/**
 * MPZP Wrocławia — ArcGIS REST UM Wrocławia (te same warstwy co geoportal.wroclaw.pl).
 * Zapytanie obrysem działki, a nie punktem: działka może leżeć w kilku terenach
 * (np. MN + droga KDD) i raport podaje udział każdego.
 */
import type { MultiPolygon } from './geo'
import { cacheableResult, cached, DAY, runSource, type SourceResult } from './http'
import { queryByParcel, str } from './sources/arcgis'

const SRV = 'https://gis.um.wroc.pl/portal_srv/rest/services/POG_PROJEKT_OP_plany_miejscowe/MapServer'
const L = {
  tereny: `${SRV}/72`,
  planyObowiazujace: `${SRV}/79`,
  planyUchwaloneNieobowiazujace: `${SRV}/78`,
  planyWOpracowaniu: `${SRV}/77`,
  planyWOpracowaniuDzielnice: `${SRV}/88`,
  strefyDziedzictwa: `${SRV}/69`,
  stanowiskaArcheologiczne: `${SRV}/63`,
}

export interface WroclawMpzpZone {
  symbol: string
  symbolLiterowy: string | null
  przeznaczenie: string | null
  klasyfikacja: string | null
  nrPlanu: string | null
  sharePct: number
}

export interface WroclawPlan {
  nr: string | null
  tytul: string | null
  uchwalaUrl: string | null
  stan: string | null
}

export interface WroclawMpzp {
  zones: WroclawMpzpZone[]
  plans: WroclawPlan[]
  /** Plany uchwalone, ale jeszcze nieobowiązujące, oraz w opracowaniu — ważne dla kupującego. */
  plansPending: WroclawPlan[]
  heritage: string[]
  archeologia: boolean
}

function plan(a: Record<string, string | number | null>, stan?: string): WroclawPlan {
  return {
    nr: str(a.PLA_NR),
    tytul: str(a.TYTUL),
    uchwalaUrl: str(a.UCHWALENIE_UCHWALA_URL),
    stan: stan ?? str(a.STAN_NAZWA),
  }
}

export function isWroclawTerc(terc: string): boolean {
  return terc === '026401'
}

export async function queryWroclawMpzp(parcelId: string, geom: MultiPolygon): Promise<SourceResult<WroclawMpzp>> {
  return cached(`wroclaw-mpzp:${parcelId}`, DAY, () => runSource('MPZP – GIS UM Wrocławia', async () => {
    const [tereny, plany, uchwalone, wOpr, wOprDz, dziedzictwo, archeo] = await Promise.all([
      queryByParcel(L.tereny, geom, 'NRPLANU,SBLTERENU,UPROSZCZONA_KLASYFIKACJA,SYM_LIT,SYM_LIT_OPIS'),
      queryByParcel(L.planyObowiazujace, geom, 'PLA_NR,STAN_NAZWA,TYTUL,UCHWALENIE_UCHWALA_URL'),
      queryByParcel(L.planyUchwaloneNieobowiazujace, geom, '*'),
      queryByParcel(L.planyWOpracowaniu, geom, '*'),
      queryByParcel(L.planyWOpracowaniuDzielnice, geom, '*'),
      queryByParcel(L.strefyDziedzictwa, geom, '*', { minSharePct: 0.1 }),
      queryByParcel(L.stanowiskaArcheologiczne, geom, '*', { minSharePct: 0.1 }),
    ])

    const zones: WroclawMpzpZone[] = tereny.map(h => ({
      symbol: str(h.attributes.SBLTERENU) ?? '?',
      symbolLiterowy: str(h.attributes.SYM_LIT),
      przeznaczenie: str(h.attributes.SYM_LIT_OPIS),
      klasyfikacja: str(h.attributes.UPROSZCZONA_KLASYFIKACJA),
      nrPlanu: str(h.attributes.NRPLANU),
      sharePct: +h.sharePct.toFixed(1),
    }))

    const heritage = [...new Set(dziedzictwo
      .map(h => str(h.attributes.PKL_OBKT_OPIS) ?? str(h.attributes.OPISOBIEKTU) ?? str(h.attributes.ETYKIETA))
      .filter((s): s is string => !!s))]

    const data: WroclawMpzp = {
      zones,
      plans: plany.map(h => plan(h.attributes)),
      plansPending: [
        ...uchwalone.map(h => plan(h.attributes, 'uchwalony, jeszcze nieobowiązujący')),
        ...wOpr.map(h => plan(h.attributes, 'w opracowaniu')),
        ...wOprDz.map(h => plan(h.attributes, 'w opracowaniu')),
      ],
      heritage,
      archeologia: archeo.length > 0,
    }
    return { status: zones.length || data.plans.length ? 'ok' : 'no_data', data }
  }), cacheableResult)
}
