/**
 * wroclaw-pog.ts
 * Plan ogólny miasta Wrocławia (uchwała nr XXXVI/872/26 z 26.08.2026, obowiązuje od 19.09.2026).
 * Dane z ArcGIS REST UM Wrocławia (te same usługi, których używa geoportal.wroclaw.pl/www/pog_app).
 * Nazwy usług zawierają "PROJEKT", ale warstwy OBOW to wersja obowiązująca (STATUS = "prawnie wiążący").
 */

const BASE = 'https://gis.um.wroc.pl/portal_srv/rest/services'

const LAYERS = {
  strefy: `${BASE}/POG_PROJEKT_OBOW_strefy_planistyczne/MapServer/7`,
  ouz: `${BASE}/POG_PROJEKT_OBOW_obszar_uzupelnienia_zabudowy/MapServer/5`,
  ozs: `${BASE}/POG_PROJEKT_OBOW_obszar_zabudowy_srodmiejskiej/MapServer/3`,
}

export interface WroclawPogStrefa {
  oznaczenie: string
  symbol: string | null
  nazwa: string | null
  maks_intensywnosc: number | null
  maks_udzial_zabudowy: number | null
  maks_wysokosc: number | null
  min_pbc: number | null
  profil_podstawowy: string[]
  profil_dodatkowy: string[]
}

export interface WroclawPog {
  strefa: WroclawPogStrefa
  obszar_uzupelnienia_zabudowy: string | null
  obszar_zabudowy_srodmiejskiej: string | null
  obowiazuje_od: string | null
}

type Attrs = Record<string, string | number | null>

async function queryPoint(layerUrl: string, lat: number, lng: number, timeoutMs: number): Promise<Attrs | null> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  })
  const res = await fetch(`${layerUrl}/query?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`POG HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(`POG ArcGIS: ${json.error.message}`)
  return json.features?.[0]?.attributes ?? null
}

function str(v: string | number | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function num(v: string | number | null | undefined): number | null {
  return typeof v === 'number' ? v : null
}

function list(v: string | number | null | undefined): string[] {
  return (str(v) ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

function date(v: string | number | null | undefined): string | null {
  return typeof v === 'number' ? new Date(v).toISOString().slice(0, 10) : null
}

/**
 * Zwraca ustalenia POG dla punktu (WGS84) lub null, gdy punkt leży poza planem / serwis nie odpowiada.
 */
export async function queryWroclawPog(lat: number, lng: number, timeoutMs = 8000): Promise<WroclawPog | null> {
  const [s, ouz, ozs] = await Promise.all([
    queryPoint(LAYERS.strefy, lat, lng, timeoutMs),
    queryPoint(LAYERS.ouz, lat, lng, timeoutMs),
    queryPoint(LAYERS.ozs, lat, lng, timeoutMs),
  ])

  if (!s) return null

  return {
    strefa: {
      oznaczenie: str(s.OZNACZENIE) ?? '?',
      symbol: str(s.SYMBOL),
      nazwa: str(s.NAZWA),
      maks_intensywnosc: num(s.MAKSNADZIE),
      maks_udzial_zabudowy: num(s.MAKSUDZIAL),
      maks_wysokosc: num(s.MAKSWYSOKO),
      min_pbc: num(s.MINUDZIALP),
      profil_podstawowy: list(s.PROFILPODS),
      profil_dodatkowy: list(s.PROFILDODA),
    },
    obszar_uzupelnienia_zabudowy: ouz ? str(ouz.OZNACZENIE) ?? 'tak' : null,
    obszar_zabudowy_srodmiejskiej: ozs ? str(ozs.OZNACZENIE) ?? 'tak' : null,
    obowiazuje_od: date(s.OBOWIAZUJE),
  }
}
