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

/** v5: ostre linie w kolorach legendy, bez opisów (v4: rozmyte, z przekłamanymi kolorami; v3 i starsze ~24 km od działki). */
function cacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 1000) / 1000}_${Math.round(lng * 1000) / 1000}_v5.jpg`
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

async function rawRgba(png: Buffer) {
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/**
 * Linia o stałej szerokości z maski 0/255: rozmycie maski i strome progowanie dają poszerzenie
 * z ostrą, wygładzoną krawędzią (~1 px przejścia). Kolor jest jednolity — nie miesza się z sąsiednimi sieciami.
 */
async function lineLayer(mask: Uint8Array, sigma: number, threshold: number, hex: string, opacity = 1): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const blurred = await sharp(Buffer.from(mask), { raw: { width: W, height: H, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer()
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const px = Buffer.alloc(W * H * 4)
  for (let i = 0, j = 0; i < blurred.length; i++, j += 4) {
    const a = Math.max(0, Math.min(255, (blurred[i] - threshold + 12) * (255 / 24)))
    px[j] = r; px[j + 1] = g; px[j + 2] = b; px[j + 3] = a * opacity
  }
  return sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
}

/**
 * Warstwy sieci (obwódka + linie) z odpowiedzi KIUT w pełnej i połowie rozdzielczości (każda łączona).
 * `stable`: odpowiedzi tej samej rozdzielczości się zgadzały — tylko taką mapę wolno zapisać w cache.
 */
export async function networkLayers(fulls: Buffer[], halves: Buffer[]): Promise<{ layers: Buffer[]; stable: boolean }> {
  const [full, half] = await Promise.all([Promise.all(fulls.map(rawRgba)), Promise.all(halves.map(rawRgba))])
  const { masks, stable } = networkMasks(full, half, NETWORK_STYLES.map(s => s.server))
  if (!masks.some(m => m.some(v => v))) return { layers: [], stable }
  const union = new Uint8Array(W * H)
  for (const m of masks) for (let p = 0; p < union.length; p++) if (m[p]) union[p] = 255
  // biała obwódka pod wszystkimi sieciami — kontrast na ciemnych fragmentach zdjęcia
  // grubość dobrana do raportu, gdzie mapa 1200 px jest pokazywana na ~780 px: linia ~5 px, obwódka ~8 px
  const layers = [await lineLayer(union, 2.3, 35, '#FFFFFF', 0.85)]
  for (const i of DRAW_ORDER) if (masks[i].some(v => v)) layers.push(await lineLayer(masks[i], 1.3, 55, NETWORK_STYLES[i].color))
  return { layers, stable }
}

function overlaySvg(rings: Array<Array<{ lat: number; lng: number }>>, toPx: (lat: number, lng: number) => [number, number]): Buffer {
  const polys = rings.map(r => {
    const pts = r.map(p => toPx(p.lat, p.lng).map(v => v.toFixed(1)).join(',')).join(' ')
    return `<polygon points="${pts}" fill="rgba(250,204,21,0.12)" stroke="#111827" stroke-width="6" stroke-linejoin="round" opacity="0.55"/>
<polygon points="${pts}" fill="none" stroke="#FACC15" stroke-width="3" stroke-dasharray="12 6" stroke-linejoin="round"/>`
  }).join('')
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${polys}</svg>`)
}

async function renderMap(lat: number, lng: number, geomWkt?: string | null): Promise<{ jpeg: Buffer; cacheable: boolean } | null> {
  try {
    const sharp = (await import('sharp')).default
    // ~840 × 520 m wokół działki (proporcje 1200×750)
    const c = to3857(lat, lng)
    const k = 1 / Math.cos((lat * Math.PI) / 180) // skala Mercatora
    const halfW = 420 * k, halfH = 262.5 * k
    const [x0, y0, x1, y1] = [c.x - halfW, c.y - halfH, c.x + halfW, c.y + halfH]
    const bbox = `${x0.toFixed(1)},${y0.toFixed(1)},${x1.toFixed(1)},${y1.toFixed(1)}`

    const gesutParams = { LAYERS: NETWORK_STYLES.map(s => s.layer).join(','), BBOX: bbox, FORMAT: 'image/png', TRANSPARENT: 'TRUE' }
    const halfSize = { width: W / 2, height: H / 2 }
    // Każda warstwa KIUT dwa razy: serwer często gubi część sieci, a połączenie dwóch odpowiedzi prawie zawsze
    // ją ma. Połowa rozdzielczości (~1:5000): większość serwerów powiatowych rysuje sieci bez opisów (kiut-raster.ts).
    const [ortoFetched, kieg, ...gesutAll] = await Promise.all([
      ortho(bbox),
      wmsPng(KIEG_WMS, { LAYERS: 'dzialki,numery_dzialek', BBOX: bbox, FORMAT: 'image/png', TRANSPARENT: 'TRUE' }, 12_000),
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

    const toPx = (la: number, ln: number): [number, number] => {
      const p = to3857(la, ln)
      return [((p.x - x0) / (x1 - x0)) * W, ((y1 - p.y) / (y1 - y0)) * H]
    }
    // Zdjęcie lekko rozjaśnione, żeby kolorowe sieci i granica działki odcinały się od tła.
    const layers: { input: Buffer | { create: { width: number; height: number; channels: 4; background: { r: number; g: number; b: number; alpha: number } } } }[] = [
      { input: { create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.25 } } } },
    ]
    if (kieg) layers.push({ input: kieg })
    const networks = gesut.length ? await networkLayers(gesut, gesutHalf) : { layers: [], stable: false }
    for (const input of networks.layers) layers.push({ input })
    if (geomWkt) layers.push({ input: overlaySvg(parcelRingsWgs84(geomWkt), toPx) })

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
