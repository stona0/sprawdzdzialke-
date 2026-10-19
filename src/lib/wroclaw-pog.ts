/**
 * Plan ogólny miasta Wrocławia (uchwała nr XXXVI/872/26 z 26.08.2026, obowiązuje od 19.09.2026).
 * ArcGIS REST UM Wrocławia (te same usługi co geoportal.wroclaw.pl/www/pog_app).
 * Nazwy usług zawierają „PROJEKT”, ale warstwy OBOW to wersja obowiązująca (STATUS = „prawnie wiążący”).
 * Krajowa usługa GUGiK PlanyOgolneGmin i Rejestr Urbanistyczny na dzień 19.10.2026 jeszcze
 * nie mają obowiązującego POG Wrocławia, dlatego dla Wrocławia źródłem jest GIS miasta.
 */
import type { MultiPolygon } from './geo'
import { cacheableResult, cached, DAY, runSource, type SourceResult } from './http'
import { num, queryByParcel, str } from './sources/arcgis'

const BASE = 'https://gis.um.wroc.pl/portal_srv/rest/services'
const LAYERS = {
  strefy: `${BASE}/POG_PROJEKT_OBOW_strefy_planistyczne/MapServer/7`,
  ouz: `${BASE}/POG_PROJEKT_OBOW_obszar_uzupelnienia_zabudowy/MapServer/5`,
  ozs: `${BASE}/POG_PROJEKT_OBOW_obszar_zabudowy_srodmiejskiej/MapServer/3`,
}

export const WROCLAW_POG_UCHWALA = 'XXXVI/872/26'

export interface PogStrefa {
  oznaczenie: string
  symbol: string | null
  nazwa: string | null
  maks_intensywnosc: number | null
  maks_udzial_zabudowy: number | null
  maks_wysokosc: number | null
  min_pbc: number | null
  profil_podstawowy: string[]
  profil_dodatkowy: string[]
  sharePct: number
}

export interface Pog {
  /** Strefy planistyczne przecinające działkę, od największego udziału. */
  strefy: PogStrefa[]
  /** Oznaczenie OUZ, gdy działka (choćby częściowo) w nim leży. */
  obszar_uzupelnienia_zabudowy: string | null
  ouzSharePct: number
  obszar_zabudowy_srodmiejskiej: string | null
  obowiazuje_od: string | null
  uchwala: string | null
  zrodlo: string
}

function list(v: string | number | null | undefined): string[] {
  return (str(v) ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

export async function queryWroclawPog(parcelId: string, geom: MultiPolygon): Promise<SourceResult<Pog>> {
  return cached(`wroclaw-pog:${parcelId}`, DAY, () => runSource('Plan ogólny – GIS UM Wrocławia', async () => {
    const [strefy, ouz, ozs] = await Promise.all([
      queryByParcel(LAYERS.strefy, geom, '*'),
      queryByParcel(LAYERS.ouz, geom, 'OZNACZENIE', { minSharePct: 0.1 }),
      queryByParcel(LAYERS.ozs, geom, 'OZNACZENIE', { minSharePct: 0.1 }),
    ])
    if (!strefy.length) return { status: 'no_data', data: null }

    const obow = strefy[0].attributes.OBOWIAZUJE
    const data: Pog = {
      strefy: strefy.map(h => ({
        oznaczenie: str(h.attributes.OZNACZENIE) ?? '?',
        symbol: str(h.attributes.SYMBOL),
        nazwa: str(h.attributes.NAZWA),
        maks_intensywnosc: num(h.attributes.MAKSNADZIE),
        maks_udzial_zabudowy: num(h.attributes.MAKSUDZIAL),
        maks_wysokosc: num(h.attributes.MAKSWYSOKO),
        min_pbc: num(h.attributes.MINUDZIALP),
        profil_podstawowy: list(h.attributes.PROFILPODS),
        profil_dodatkowy: list(h.attributes.PROFILDODA),
        sharePct: +h.sharePct.toFixed(1),
      })),
      obszar_uzupelnienia_zabudowy: ouz.length ? str(ouz[0].attributes.OZNACZENIE) ?? 'tak' : null,
      ouzSharePct: +ouz.reduce((s, h) => s + h.sharePct, 0).toFixed(1),
      obszar_zabudowy_srodmiejskiej: ozs.length ? str(ozs[0].attributes.OZNACZENIE) ?? 'tak' : null,
      obowiazuje_od: typeof obow === 'number' ? new Date(obow).toISOString().slice(0, 10) : null,
      uchwala: WROCLAW_POG_UCHWALA,
      zrodlo: 'GIS Urzędu Miejskiego Wrocławia',
    }
    return { status: 'ok', data }
  }), cacheableResult)
}
