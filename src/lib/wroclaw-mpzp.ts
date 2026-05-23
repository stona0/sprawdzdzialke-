/**
 * wroclaw-mpzp.ts
 * Zapytania do publicznego WFS Urzędu Miejskiego Wrocławia
 * Serwis OGC: http://gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpzp/MapServer/WFSServer
 *
 * Zwraca strefę MPZP (symbol + przeznaczenie + nr uchwały) dla podanych współrzędnych WGS84.
 * Nie wymaga uwierzytelniania.
 */

const WFS_URL = 'http://gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpzp/MapServer/WFSServer'

export interface WroclawMpzpZone {
  symbol_terenu: string
  symbol_literowy: string | null
  przeznaczenie: string | null               // opis_w_legendzie
  klasyfikacja: string | null                // uproszczona_klasyfikacja_przeznaczenia
  nr_planu: number | null
  uchwalenie_uchwala: string | null          // numer uchwały rady miejskiej
  tytul_planu: string | null
  id_terenu: number | null
}

/**
 * Zapytaj WFS o strefę MPZP dla punktu (lat, lng w WGS84).
 * Zwraca pierwszą pasującą strefę lub null jeśli brak planu.
 */
export async function queryWroclawMpzp(
  lat: number,
  lng: number,
  timeoutMs = 8000
): Promise<WroclawMpzpZone | null> {
  // WFS 1.1.0 + EPSG:4326 używa odwróconej kolejności osi: lat,lon (Y,X)
  const delta = 0.00002
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`

  const url =
    `${WFS_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature` +
    `&TYPENAME=tereny` +
    `&MAXFEATURES=1` +
    `&SRSNAME=EPSG:4326` +
    `&BBOX=${bbox},EPSG:4326`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/xml, text/xml' },
      // Node.js next-fetch nie wysyła User-Agent automatycznie
      next: { revalidate: 0 },
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const xml = await res.text()
    return parseWfsGml(xml)
  } catch {
    return null
  }
}

/**
 * Parsuje odpowiedź GML z WFS – wyciąga atrybuty pierwszego feature.
 * Nie używamy zewnętrznego parsera XML — prosta ekstrakcja tagów.
 */
function parseWfsGml(xml: string): WroclawMpzpZone | null {
  // Brak wyników
  if (xml.includes('numberOfFeatures="0"') || !xml.includes('symbol_terenu')) {
    return null
  }

  function extract(tag: string): string | null {
    // GML z ArcGIS zwraca tagi jako <esri:tag> lub <tag>
    const patterns = [
      new RegExp(`<[^:>]*:${tag}[^>]*>([^<]*)<`, 'i'),
      new RegExp(`<${tag}[^>]*>([^<]*)<`, 'i'),
    ]
    for (const re of patterns) {
      const m = xml.match(re)
      if (m && m[1].trim()) return m[1].trim()
    }
    return null
  }

  function extractInt(tag: string): number | null {
    const v = extract(tag)
    if (!v) return null
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const symbol = extract('symbol_terenu')
  if (!symbol) return null

  return {
    symbol_terenu: symbol,
    symbol_literowy: extract('symbol_literowy'),
    przeznaczenie: extract('opis_w_legendzie'),
    klasyfikacja: extract('uproszczona_klasyfikacja_przeznaczenia'),
    nr_planu: extractInt('nr_planu'),
    uchwalenie_uchwala: null, // wymaga join z obowiazujace_plany_miejscowe
    tytul_planu: null,
    id_terenu: extractInt('id_terenu'),
  }
}

/**
 * Zapytaj o dane planu (nr uchwały, tytuł) po nr_planu.
 * Osobne zapytanie do warstwy obowiazujace_plany_miejscowe.
 */
export async function queryWroclawPlanDetails(
  nrPlanu: number,
  timeoutMs = 6000
): Promise<{ uchwalenie_uchwala: string | null; tytul: string | null }> {
  const filter = encodeURIComponent(
    `<ogc:Filter xmlns:ogc="http://www.opengis.net/ogc">` +
    `<ogc:PropertyIsEqualTo>` +
    `<ogc:PropertyName>nr_planu</ogc:PropertyName>` +
    `<ogc:Literal>${nrPlanu}</ogc:Literal>` +
    `</ogc:PropertyIsEqualTo></ogc:Filter>`
  )
  const url =
    `${WFS_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature` +
    `&TYPENAME=obowiazujace_plany_miejscowe` +
    `&MAXFEATURES=1` +
    `&FILTER=${filter}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 0 } })
    clearTimeout(timer)
    if (!res.ok) return { uchwalenie_uchwala: null, tytul: null }

    const xml = await res.text()

    function extract(tag: string): string | null {
      const patterns = [
        new RegExp(`<[^:>]*:${tag}[^>]*>([^<]*)<`, 'i'),
        new RegExp(`<${tag}[^>]*>([^<]*)<`, 'i'),
      ]
      for (const re of patterns) {
        const m = xml.match(re)
        if (m && m[1].trim()) return m[1].trim()
      }
      return null
    }

    return {
      uchwalenie_uchwala: extract('uchwalenie_uchwala'),
      tytul: extract('tytul'),
    }
  } catch {
    return { uchwalenie_uchwala: null, tytul: null }
  }
}

/**
 * Pełne zapytanie: strefa + dane planu, gotowe do użycia w raporcie.
 */
export async function getWroclawMpzpForCoords(
  lat: number,
  lng: number
): Promise<WroclawMpzpZone | null> {
  const zone = await queryWroclawMpzp(lat, lng)
  if (!zone) return null

  // Dociągnij dane planu jeśli mamy nr_planu
  if (zone.nr_planu) {
    const plan = await queryWroclawPlanDetails(zone.nr_planu)
    zone.uchwalenie_uchwala = plan.uchwalenie_uchwala
    zone.tytul_planu = plan.tytul
  }

  return zone
}
