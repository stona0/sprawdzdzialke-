import type { Pt } from '../geo'

/**
 * URL GetFeatureInfo dla punktu w EPSG:2180. W WMS 1.3.0 EPSG:2180 ma kolejność
 * osi northing,easting, więc BBOX to y,x — pomyłka daje puste odpowiedzi.
 */
export function gfiUrl2180(
  base: string,
  layers: string[],
  [x, y]: Pt,
  infoFormat: string,
  { half = 5, featureCount = 10 } = {},
): string {
  const px = 11
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layers.join(','),
    QUERY_LAYERS: layers.join(','),
    STYLES: '',
    CRS: 'EPSG:2180',
    BBOX: `${y - half},${x - half},${y + half},${x + half}`,
    WIDTH: String(px),
    HEIGHT: String(px),
    I: String((px - 1) / 2),
    J: String((px - 1) / 2),
    INFO_FORMAT: infoFormat,
    FEATURE_COUNT: String(featureCount),
  })
  return `${base}${base.includes('?') ? '&' : '?'}${params}`
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export interface HtmlTable {
  layer: string | null
  rows: Record<string, string>[]
}

/**
 * Wyciąga tabele z odpowiedzi GetFeatureInfo text/html. Obsługuje dwa spotykane
 * w krajowych integracjach warianty: ArcGIS (<h5>layer name: '…'</h5><table>)
 * i GeoServer (<table><caption>…</caption>).
 */
export function parseHtmlTables(html: string): HtmlTable[] {
  const clean = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  const out: HtmlTable[] = []
  const re = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  let last = 0
  while ((m = re.exec(clean))) {
    const before = clean.slice(last, m.index)
    last = m.index + m[0].length
    const table = m[0]
    const caption = table.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1]
    const h5 = [...before.matchAll(/layer name:\s*'([^']+)'/gi)].pop()?.[1]
    const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(t => t[1])
    const header = trs.find(t => /<th/i.test(t))
    if (!header) continue
    const keys = [...header.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(c => cellText(c[1]))
    const rows = trs
      .filter(t => /<td/i.test(t))
      .map(t => {
        const vals = [...t.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => cellText(c[1]))
        return Object.fromEntries(keys.map((k, i) => [k, vals[i] ?? '']))
      })
    out.push({ layer: caption ? cellText(caption) : h5 ?? null, rows })
  }
  return out
}
