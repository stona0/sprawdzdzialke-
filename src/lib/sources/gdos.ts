/**
 * Formy ochrony przyrody — GDOŚ.
 *  - „na działce”: WMS GetFeatureInfo w kilku punktach wewnątrz działki (serwer sam
 *    robi point-in-polygon na pełnej geometrii obszaru)
 *  - „w pobliżu”: WFS BBOX = obrys działki + 300 m (bez ściągania ogromnych geometrii)
 * Filtry CQL (INTERSECTS/DWITHIN) w tej usłudze zwracają puste wyniki — nie używać.
 */
import { bbox, samplePoints, type MultiPolygon } from '../geo'
import { cachedSource, DAY, fetchWithRetry, runSource, type SourceResult } from '../http'
import { gfiUrl2180 } from './wms'

const WMS = 'https://sdi.gdos.gov.pl/wms'
const WFS = 'https://sdi.gdos.gov.pl/wfs'
export const NEARBY_M = 300

const LAYERS: Record<string, string> = {
  'GDOS:ObszarySpecjalnejOchrony': 'Natura 2000 – obszar specjalnej ochrony ptaków (OSO)',
  'GDOS:SpecjalneObszaryOchrony': 'Natura 2000 – specjalny obszar ochrony siedlisk (SOO)',
  'GDOS:ParkiNarodowe': 'Park narodowy',
  'GDOS:Rezerwaty': 'Rezerwat przyrody',
  'GDOS:ParkiKrajobrazowe': 'Park krajobrazowy',
  'GDOS:ObszaryChronionegoKrajobrazu': 'Obszar chronionego krajobrazu',
}

export interface GdosArea {
  type: string
  name: string
}

export interface GdosResult {
  onParcel: GdosArea[]
  nearby: GdosArea[]
}

function dedupe(a: GdosArea[]): GdosArea[] {
  return a.filter((x, i) => a.findIndex(y => y.type === x.type && y.name === x.name) === i)
}

async function onParcel(geom: MultiPolygon): Promise<GdosArea[]> {
  const layers = Object.keys(LAYERS)
  const results = await Promise.all(samplePoints(geom, 5).map(async pt => {
    const res = await fetchWithRetry(gfiUrl2180(WMS, layers, pt, 'application/json', { half: 2 }), { timeoutMs: 15_000 })
    if (!res.ok) throw new Error(`GDOŚ WMS HTTP ${res.status}`)
    const json = await res.json() as { features?: Array<{ id?: string; properties?: Record<string, unknown> }> }
    return (json.features ?? []).map(f => {
      const layer = `GDOS:${String(f.id ?? '').split('.')[0]}`
      return { type: LAYERS[layer] ?? layer, name: String(f.properties?.nazwa ?? '—') }
    })
  }))
  return dedupe(results.flat())
}

async function nearby(geom: MultiPolygon): Promise<GdosArea[]> {
  const [minx, miny, maxx, maxy] = bbox(geom)
  // urn:ogc:def:crs:EPSG::2180 w WFS 2.0 ma kolejność osi northing,easting
  const b = `${miny - NEARBY_M},${minx - NEARBY_M},${maxy + NEARBY_M},${maxx + NEARBY_M},urn:ogc:def:crs:EPSG::2180`
  const results = await Promise.all(Object.entries(LAYERS).map(async ([layer, label]) => {
    const url =
      `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${encodeURIComponent(layer)}` +
      `&outputFormat=application%2Fjson&count=10&propertyName=nazwa&BBOX=${encodeURIComponent(b)}`
    const res = await fetchWithRetry(url, { timeoutMs: 15_000 })
    if (!res.ok) throw new Error(`GDOŚ WFS HTTP ${res.status}`)
    const json = await res.json() as { features?: Array<{ properties?: { nazwa?: string } }> }
    return (json.features ?? []).map(f => ({ type: label, name: f.properties?.nazwa ?? '—' }))
  }))
  return dedupe(results.flat())
}

export async function queryGdos(parcelId: string, geom: MultiPolygon): Promise<SourceResult<GdosResult>> {
  return cachedSource(`gdos:${parcelId}`, DAY, () => runSource('Ochrona przyrody – GDOŚ', async () => {
    const [on, near] = await Promise.all([onParcel(geom), nearby(geom)])
    const nearOnly = near.filter(n => !on.some(o => o.type === n.type && o.name === n.name))
    const data = { onParcel: on, nearby: nearOnly }
    return { status: on.length || nearOnly.length ? 'ok' : 'no_data', data }
  }))
}
