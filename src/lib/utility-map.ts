/**
 * Mapa uzbrojenia terenu: ortofotomapa GUGiK + działki KIEG + sieci KIUT/GESUT + granica działki.
 * Wszystkie warstwy pobierane jako WMS w EPSG:3857 dla tego samego BBOX, więc nakładają się 1:1.
 * Wynik trafia do Supabase Storage (cache) albo — w trybie bez Storage — wraca jako data URI.
 *
 * Wcześniej podkładem były kafelki CARTO Positron, które dziś zwracają obraz ze znakiem
 * „API KEY REQUIRED”, a GESUT był pobierany z integracja02.gugik.gov.pl (puste odpowiedzi).
 */
import { parseWkt, toWgs84 } from './geo'
import { fetchWithRetry } from './http'
import { networkMasks, type Rgb } from './kiut-raster'
import { vectorize, type Point, type Polyline } from './kiut-vector'

const ORTO_BASE = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS'
const KIEG_WMS = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow'
const GESUT_WMS = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu'

const STORAGE_BUCKET = 'utility-maps'
const W = 1200
const H = 750

// `server`: kolor, którym rysuje serwer KIUT (usługa ignoruje SLD_BODY; zmierzone na 6 powiatach).
// `color`: kolor linii na naszej mapie i w legendzie — rysujemy go sami, więc legenda zawsze się zgadza.
export const NETWORK_STYLES: Array<{ layer: string; color: string; server: Rgb; label: string }> = [
  { layer: 'przewod_elektroenergetyczny', color: '#E00000', server: [0xff, 0x00, 0x00], label: 'Sieć elektroenergetyczna' },
  { layer: 'przewod_wodociagowy', color: '#0000E0', server: [0x00, 0x00, 0xff], label: 'Wodociąg' },
  { layer: 'przewod_kanalizacyjny', color: '#7A3A00', server: [0x7c, 0x2e, 0x00], label: 'Kanalizacja' },
  { layer: 'przewod_gazowy', color: '#B8B000', server: [0xbe, 0xbe, 0x00], label: 'Sieć gazowa' },
  { layer: 'przewod_cieplowniczy', color: '#C000C0', server: [0xcc, 0x00, 0xcc], label: 'Sieć ciepłownicza' },
  { layer: 'przewod_telekomunikacyjny', color: '#E07000', server: [0xff, 0x8d, 0x00], label: 'Telekomunikacja' },
]
/** Kolejność rysowania (indeksy NETWORK_STYLES): sieci podziemne pod spodem, linie energetyczne na wierzchu. */
const DRAW_ORDER = [5, 4, 3, 2, 1, 0]

// ─── Cache (Supabase Storage) ─────────────────────────────────────────────────

/**
 * v6: sieci jako wektor, widok przycięty do działki, dalsze sieci wyblakłe (v5: pogrubiony raster, cały obszar;
 * v4: rozmyte, z przekłamanymi kolorami; v3 i starsze ~24 km od działki).
 */
function cacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 1000) / 1000}_${Math.round(lng * 1000) / 1000}_v6.jpg`
}

async function checkCache(key: string): Promise<string | null> {
  try {
    const { createServiceClient } = await import('./supabase/server')
    const supabase = await createServiceClient()
    const { data } = await supabase.storage.from(STORAGE_BUCKET).list('', { search: key })
    if (data && data.length > 0) return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key).data?.publicUrl ?? null
    return null
  } catch {
    return null
  }
}

async function uploadToStorage(key: string, jpeg: Buffer): Promise<string | null> {
  try {
    const { createServiceClient } = await import('./supabase/server')
    const supabase = await createServiceClient()
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(key, jpeg, {
      contentType: 'image/jpeg', upsert: true, cacheControl: '604800',
    })
    if (error) {
      console.error('[utility-map] Storage upload error:', error.message)
      return null
    }
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key).data?.publicUrl ?? null
  } catch (err) {
    console.error('[utility-map] Storage upload exception:', err)
    return null
  }
}

// ─── Geometria ────────────────────────────────────────────────────────────────

function to3857(lat: number, lng: number) {
  const x = (lng * 20037508.34) / 180
  const y = ((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * 20037508.34) / 180
  return { x, y }
}

function parcelRingsWgs84(wkt: string): Array<Array<{ lat: number; lng: number }>> {
  const mp = parseWkt(wkt)
  if (!mp.length) return []
  return mp.flatMap(poly => poly).filter(r => r.length >= 3).map(r => r.map(toWgs84))
}

// ─── Warstwy ──────────────────────────────────────────────────────────────────

async function wmsPng(base: string, params: Record<string, string>, timeoutMs: number, size = { width: W, height: H }): Promise<Buffer | null> {
  const q = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', STYLES: '', CRS: 'EPSG:3857', WIDTH: String(size.width), HEIGHT: String(size.height), ...params })
  try {
    // KIUT przyjmuje 10 zapytań na 2 s, a mapa pyta go razem z gesut.ts — nadmiar dostaje 429 z Retry-After.
    // Pozostałych usług nie ponawiamy: ortofotomapa ma już zapasowy wariant, a raport ma limit czasu.
    const res = await fetchWithRetry(`${base}?${q}`, { timeoutMs, retries: base === GESUT_WMS ? 1 : 0 })
    const buf = Buffer.from(await res.arrayBuffer())
    const isPng = buf[0] === 0x89 && buf[1] === 0x50
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8
    if (res.ok && (isPng || isJpg)) return buf
    console.warn(`[utility-map] ${new URL(base).host}: HTTP ${res.status}, ${buf.toString('utf8', 0, 120)}`)
    return null
  } catch (e) {
    console.warn(`[utility-map] ${new URL(base).host}: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

/**
 * Ortofotomapa GUGiK. Usługi bywają niestabilne: StandardResolution potrafi zwracać 404,
 * a HighResolution poza obszarami zdjęć wysokiej rozdzielczości oddaje biały obraz.
 */
async function ortho(bbox: string): Promise<Buffer | null> {
  const sharp = (await import('sharp')).default
  for (const variant of ['StandardResolution', 'HighResolution']) {
    const img = await wmsPng(`${ORTO_BASE}/${variant}`, { LAYERS: 'Raster', BBOX: bbox, FORMAT: 'image/jpeg' }, 15_000)
    if (!img) continue
    const { channels } = await sharp(img).stats()
    if (channels.some(c => c.stdev > 3)) return img
  }
  return null
}

/** Obszar, z którego pobieramy sieci KIUT: ~840 × 525 m (skala, w której serwery powiatowe rysują bez opisów). */
const GEOMETRY_WIDTH_M = 840
/** Widok: działka z marginesem co najmniej tyle metrów… */
const VIEW_MARGIN_M = 120
/** …ale nie węższy niż tyle (mała działka nie wypełnia całej mapy). */
const VIEW_MIN_WIDTH_M = 420
/** Sieci bliżej działki rysujemy w pełnym kolorze, dalsze wyblakłe. */
const FOCUS_RADIUS_M = 100
// Grubości w pikselach mapy 1200 px (w raporcie pokazywanej na ~780 px).
const LINE_NEAR = 4
const LINE_CASING = 7
const LINE_FAR = 2.2
const FAR_OPACITY = 0.4

export interface MapView {
  /** Lewy górny róg i rozmiar widoku w pikselach siatki geometrii (1200 × 750). */
  x: number
  y: number
  width: number
  height: number
  /** Piksele mapy na piksel siatki geometrii. */
  zoom: number
}

/**
 * Widok dopasowany do działki: prostokąt działki z marginesem, proporcje mapy, w granicach obszaru geometrii.
 * Bez geometrii działki — cały obszar.
 */
export function focusView(rings: Point[][], metersPerPx: number): MapView {
  const all = rings.flat()
  if (!all.length) return { x: 0, y: 0, width: W, height: H, zoom: 1 }
  const xs = all.map(p => p[0]), ys = all.map(p => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const margin = Math.max(VIEW_MARGIN_M / metersPerPx, 0.5 * Math.max(x1 - x0, y1 - y0))
  let width = Math.max(x1 - x0 + 2 * margin, VIEW_MIN_WIDTH_M / metersPerPx)
  let height = Math.max(y1 - y0 + 2 * margin, width * H / W)
  if (width / height < W / H) width = height * W / H
  else height = width * H / W
  width = Math.min(width, W)
  height = Math.min(height, H)
  const x = Math.max(0, Math.min(W - width, (x0 + x1) / 2 - width / 2))
  const y = Math.max(0, Math.min(H - height, (y0 + y1) / 2 - height / 2))
  return { x, y, width, height, zoom: W / width }
}

async function rawRgba(png: Buffer) {
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

export interface NetworkLines {
  /** Sieci w kolejności rysowania (DRAW_ORDER), polilinie w pikselach siatki geometrii. */
  networks: Array<{ index: number; polylines: Polyline[] }>
  stable: boolean
}

/**
 * Sieci z odpowiedzi KIUT w pełnej i połowie rozdzielczości (każda łączona) jako polilinie (kiut-vector.ts).
 * `stable`: odpowiedzi tej samej rozdzielczości się zgadzały — tylko taką mapę wolno zapisać w cache.
 */
export async function networkLines(fulls: Buffer[], halves: Buffer[]): Promise<NetworkLines> {
  const [full, half] = await Promise.all([Promise.all(fulls.map(rawRgba)), Promise.all(halves.map(rawRgba))])
  const { native, stable } = networkMasks(full, half, NETWORK_STYLES.map(s => s.server))
  const networks: NetworkLines['networks'] = []
  for (const index of DRAW_ORDER) {
    const m = native[index]
    if (!m) continue
    const polylines = vectorize(m.mask, m.width, m.height, { scale: m.scale })
    if (polylines.length) networks.push({ index, polylines })
  }
  return { networks, stable }
}

const pathData = (lines: Point[][], closed: boolean, view: MapView) =>
  lines.map(pts => 'M' + pts.map(([x, y]) => `${((x - view.x) * view.zoom).toFixed(1)} ${((y - view.y) * view.zoom).toFixed(1)}`).join('L') + (closed ? 'Z' : '')).join('')

const polylinePath = (polys: Polyline[], view: MapView) =>
  polys.map(p => pathData([p.points], p.closed, view)).join('')

/**
 * Sieci jako SVG: wszystkie cienkie i wyblakłe, a w promieniu FOCUS_RADIUS_M od działki — pełny kolor z białą
 * obwódką. Obszar „blisko” to maska z obrysu działki linią o szerokości 2R (bufor R), z miękką krawędzią.
 * Bez geometrii działki wszystkie sieci są „blisko”.
 */
export function networksSvg(lines: NetworkLines['networks'], view: MapView, parcel: Point[][], focusRadiusPx: number): Buffer {
  const paths = lines.map(n => ({ color: NETWORK_STYLES[n.index].color, d: polylinePath(n.polylines, view) }))
  const far = paths.map(p => `<path d="${p.d}" stroke="${p.color}" stroke-width="${LINE_FAR}"/>`).join('')
  // obwódka każdej sieci tuż pod jej linią: sieć przecinająca inną albo biegnąca tuż obok jest od niej oddzielona
  // białą krawędzią (zamiast wygładzonego szwu w kolorze mieszanym, np. czerwony + niebieski = fiolet)
  const near = paths.map(p => `<path d="${p.d}" stroke="#FFFFFF" stroke-width="${LINE_CASING}"/><path d="${p.d}" stroke="${p.color}" stroke-width="${LINE_NEAR}"/>`).join('')
  const parcelD = pathData(parcel, true, view)
  const r = focusRadiusPx * view.zoom
  const mask = parcelD
    ? `<defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(r * 0.2).toFixed(1)}"/></filter>
<mask id="near" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g filter="url(#soft)"><path d="${parcelD}" fill="#fff" stroke="#fff" stroke-width="${(2 * r).toFixed(1)}" stroke-linejoin="round"/></g></mask></defs>`
    : ''
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${mask}
<g fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${FAR_OPACITY}">${far}</g>
<g fill="none" stroke-linecap="round" stroke-linejoin="round"${parcelD ? ' mask="url(#near)"' : ''}>${near}</g>
</svg>`)
}

function overlaySvg(parcel: Point[][], view: MapView): Buffer {
  const d = pathData(parcel, true, view)
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<path d="${d}" fill="rgba(250,204,21,0.12)" stroke="#111827" stroke-width="6" stroke-linejoin="round" opacity="0.55"/>
<path d="${d}" fill="none" stroke="#FACC15" stroke-width="3" stroke-dasharray="12 6" stroke-linejoin="round"/></svg>`)
}

async function renderMap(lat: number, lng: number, geomWkt?: string | null): Promise<{ jpeg: Buffer; cacheable: boolean } | null> {
  try {
    const sharp = (await import('sharp')).default
    // Geometria sieci: ~840 × 525 m wokół działki (proporcje 1200×750)
    const c = to3857(lat, lng)
    const k = 1 / Math.cos((lat * Math.PI) / 180) // skala Mercatora
    const halfW = (GEOMETRY_WIDTH_M / 2) * k, halfH = halfW * H / W
    const [x0, y0, x1, y1] = [c.x - halfW, c.y - halfH, c.x + halfW, c.y + halfH]
    const bbox = `${x0.toFixed(1)},${y0.toFixed(1)},${x1.toFixed(1)},${y1.toFixed(1)}`
    const metersPerPx = GEOMETRY_WIDTH_M / W

    const toPx = (la: number, ln: number): Point => {
      const p = to3857(la, ln)
      return [((p.x - x0) / (x1 - x0)) * W, ((y1 - p.y) / (y1 - y0)) * H]
    }
    const parcel = geomWkt ? parcelRingsWgs84(geomWkt).map(r => r.map(p => toPx(p.lat, p.lng))) : []
    // Widok przycięty do działki; zdjęcie i działki ewidencyjne pobieramy dla niego (ostrzejsze),
    // a sieci zawsze dla całego obszaru — w większym zbliżeniu serwery KIUT dokładają opisy średnic.
    const view = focusView(parcel, metersPerPx)
    const vx = (px: number) => x0 + (px / W) * (x1 - x0), vy = (py: number) => y1 - (py / H) * (y1 - y0)
    const viewBbox = `${vx(view.x).toFixed(1)},${vy(view.y + view.height).toFixed(1)},${vx(view.x + view.width).toFixed(1)},${vy(view.y).toFixed(1)}`

    const gesutParams = { LAYERS: NETWORK_STYLES.map(s => s.layer).join(','), BBOX: bbox, FORMAT: 'image/png', TRANSPARENT: 'TRUE' }
    const halfSize = { width: W / 2, height: H / 2 }
    // Każda warstwa KIUT dwa razy: serwer często gubi część sieci, a połączenie dwóch odpowiedzi prawie zawsze
    // ją ma. Połowa rozdzielczości (~1:5000): większość serwerów powiatowych rysuje sieci bez opisów (kiut-raster.ts).
    const [ortoFetched, kieg, ...gesutAll] = await Promise.all([
      ortho(viewBbox),
      wmsPng(KIEG_WMS, { LAYERS: 'dzialki,numery_dzialek', BBOX: viewBbox, FORMAT: 'image/png', TRANSPARENT: 'TRUE' }, 12_000),
      wmsPng(GESUT_WMS, gesutParams, 15_000),
      wmsPng(GESUT_WMS, gesutParams, 15_000),
      wmsPng(GESUT_WMS, gesutParams, 15_000, halfSize),
      wmsPng(GESUT_WMS, gesutParams, 15_000, halfSize),
    ])
    const present = (bufs: Array<Buffer | null>) => bufs.filter((b): b is Buffer => b !== null)
    const gesut = present(gesutAll.slice(0, 2)), gesutHalf = present(gesutAll.slice(2))
    // Bez ortofotomapy mapa nadal ma sens (działki, sieci, granica) — jasne tło zamiast zdjęcia.
    const orto = ortoFetched ?? await sharp({ create: { width: W, height: H, channels: 3, background: { r: 246, g: 246, b: 244 } } }).jpeg().toBuffer()
    if (!ortoFetched) console.warn('[utility-map] Ortofotomapa niedostępna — mapa na neutralnym tle')

    // Zdjęcie lekko rozjaśnione, a granice działek ewidencyjnych przygaszone, żeby sieci i granica działki
    // odcinały się od tła.
    const layers: { input: Buffer | { create: { width: number; height: number; channels: 4; background: { r: number; g: number; b: number; alpha: number } } } }[] = [
      { input: { create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.25 } } } },
    ]
    if (kieg) layers.push({ input: await sharp(kieg).ensureAlpha().linear([1, 1, 1, 0.6], [0, 0, 0, 0]).png().toBuffer() })
    const networks = gesut.length ? await networkLines(gesut, gesutHalf) : { networks: [], stable: false }
    if (networks.networks.length) layers.push({ input: networksSvg(networks.networks, view, parcel, FOCUS_RADIUS_M / metersPerPx) })
    if (parcel.length) layers.push({ input: overlaySvg(parcel, view) })

    const jpeg = await sharp(orto).resize(W, H).composite(layers).jpeg({ quality: 85 }).toBuffer()
    return { jpeg, cacheable: networks.stable && ortoFetched !== null && kieg !== null }
  } catch (err) {
    console.error('[utility-map] Render error:', err)
    return null
  }
}

/**
 * Zwraca URL mapy (Supabase Storage), a przy storage=false lub błędzie uploadu — data URI.
 * Mapę z niepewnymi danymi (odpowiedzi KIUT się różniły, brak zdjęcia lub działek) zapisujemy pod
 * jednorazową nazwą: raport ma swój URL, a kolejny raport dla tej okolicy pobierze dane od nowa.
 */
export async function generateUtilityMap(
  lat: number,
  lng: number,
  geomWkt?: string | null,
  { storage = true }: { storage?: boolean } = {},
): Promise<string | null> {
  const key = cacheKey(lat, lng)
  if (storage) {
    const cachedUrl = await checkCache(key)
    if (cachedUrl) return cachedUrl
  }
  const rendered = await renderMap(lat, lng, geomWkt)
  if (!rendered) return null
  const { jpeg, cacheable } = rendered
  if (storage) {
    const url = await uploadToStorage(cacheable ? key : key.replace(/\.jpg$/, `_${Date.now()}.jpg`), jpeg)
    if (url) return url
  }
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
