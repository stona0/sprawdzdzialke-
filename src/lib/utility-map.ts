/**
 * Mapa uzbrojenia terenu: ortofotomapa GUGiK + działki KIEG + sieci KIUT/GESUT + granica działki.
 * Wszystkie warstwy pobierane jako WMS w EPSG:3857 dla tego samego BBOX, więc nakładają się 1:1.
 * Wynik trafia do Supabase Storage (cache) albo — w trybie bez Storage — wraca jako data URI.
 *
 * Wcześniej podkładem były kafelki CARTO Positron, które dziś zwracają obraz ze znakiem
 * „API KEY REQUIRED”, a GESUT był pobierany z integracja02.gugik.gov.pl (puste odpowiedzi).
 */
import { parseWkt, toWgs84 } from './geo'

const ORTO_BASE = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS'
const KIEG_WMS = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow'
const GESUT_WMS = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu'

const STORAGE_BUCKET = 'utility-maps'
const W = 1200
const H = 750

// Kolory legendy = kolory, którymi rysuje serwer KIUT (usługa ignoruje SLD_BODY).
export const NETWORK_STYLES = [
  { layer: 'przewod_elektroenergetyczny', color: '#E00000', label: 'Sieć elektroenergetyczna' },
  { layer: 'przewod_wodociagowy', color: '#0000E0', label: 'Wodociąg' },
  { layer: 'przewod_kanalizacyjny', color: '#7A3A00', label: 'Kanalizacja' },
  { layer: 'przewod_gazowy', color: '#B8B000', label: 'Sieć gazowa' },
  { layer: 'przewod_cieplowniczy', color: '#C000C0', label: 'Sieć ciepłownicza' },
  { layer: 'przewod_telekomunikacyjny', color: '#E07000', label: 'Telekomunikacja' },
]

// ─── Cache (Supabase Storage) ─────────────────────────────────────────────────

/** v4: poprawne współrzędne (v3 i starsze były renderowane ~24 km od działki). */
function cacheKey(lat: number, lng: number): string {
  return `${Math.round(lat * 1000) / 1000}_${Math.round(lng * 1000) / 1000}_v4.jpg`
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

async function wmsPng(base: string, params: Record<string, string>, timeoutMs: number): Promise<Buffer | null> {
  const q = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', STYLES: '', CRS: 'EPSG:3857', WIDTH: String(W), HEIGHT: String(H), ...params })
  try {
    const res = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
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

/** Poszerza linie na przezroczystym PNG (rozmycie + wzmocnienie alfy); halo = biała obwódka. */
async function thicken(png: Buffer, sigma: number, halo: boolean): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const { data, info } = await sharp(png).ensureAlpha().blur(sigma).raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) continue
    if (halo) {
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.min(255, a * 6) * 0.85
    } else {
      // kolor rozmyty z przezroczystym tłem jest przyciemniony — przywracamy nasycenie
      const k = 255 / a
      data[i] = Math.min(255, data[i] * k)
      data[i + 1] = Math.min(255, data[i + 1] * k)
      data[i + 2] = Math.min(255, data[i + 2] * k)
      data[i + 3] = Math.min(255, a * 5)
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

function overlaySvg(rings: Array<Array<{ lat: number; lng: number }>>, toPx: (lat: number, lng: number) => [number, number]): Buffer {
  const polys = rings.map(r => {
    const pts = r.map(p => toPx(p.lat, p.lng).map(v => v.toFixed(1)).join(',')).join(' ')
    return `<polygon points="${pts}" fill="rgba(250,204,21,0.12)" stroke="#111827" stroke-width="6" stroke-linejoin="round" opacity="0.55"/>
<polygon points="${pts}" fill="none" stroke="#FACC15" stroke-width="3" stroke-dasharray="12 6" stroke-linejoin="round"/>`
  }).join('')
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${polys}</svg>`)
}

async function renderMap(lat: number, lng: number, geomWkt?: string | null): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default
    // ~840 × 520 m wokół działki (proporcje 1200×750)
    const c = to3857(lat, lng)
    const k = 1 / Math.cos((lat * Math.PI) / 180) // skala Mercatora
    const halfW = 420 * k, halfH = 262.5 * k
    const [x0, y0, x1, y1] = [c.x - halfW, c.y - halfH, c.x + halfW, c.y + halfH]
    const bbox = `${x0.toFixed(1)},${y0.toFixed(1)},${x1.toFixed(1)},${y1.toFixed(1)}`

    const [ortoFetched, kieg, gesut] = await Promise.all([
      ortho(bbox),
      wmsPng(KIEG_WMS, { LAYERS: 'dzialki,numery_dzialek', BBOX: bbox, FORMAT: 'image/png', TRANSPARENT: 'TRUE' }, 12_000),
      wmsPng(GESUT_WMS, { LAYERS: NETWORK_STYLES.map(s => s.layer).join(','), BBOX: bbox, FORMAT: 'image/png', TRANSPARENT: 'TRUE' }, 15_000),
    ])
    // Bez ortofotomapy mapa nadal ma sens (działki, sieci, granica) — jasne tło zamiast zdjęcia.
    const orto = ortoFetched ?? await sharp({ create: { width: W, height: H, channels: 3, background: { r: 246, g: 246, b: 244 } } }).jpeg().toBuffer()
    if (!ortoFetched) console.warn('[utility-map] Ortofotomapa niedostępna — mapa na neutralnym tle')

    const toPx = (la: number, ln: number): [number, number] => {
      const p = to3857(la, ln)
      return [((p.x - x0) / (x1 - x0)) * W, ((y1 - p.y) / (y1 - y0)) * H]
    }
    const layers: { input: Buffer }[] = []
    if (kieg) layers.push({ input: kieg })
    if (gesut) {
      // Serwer KIUT ignoruje SLD i rysuje linie o szerokości 1 px — na ortofotomapie są
      // niewidoczne. Pogrubiamy je i podkładamy białą obwódkę.
      layers.push({ input: await thicken(gesut, 3, true) })
      layers.push({ input: await thicken(gesut, 1.2, false) })
    }
    if (geomWkt) layers.push({ input: overlaySvg(parcelRingsWgs84(geomWkt), toPx) })

    return await sharp(orto).resize(W, H).composite(layers).jpeg({ quality: 85 }).toBuffer()
  } catch (err) {
    console.error('[utility-map] Render error:', err)
    return null
  }
}

/**
 * Zwraca URL mapy (Supabase Storage), a przy storage=false lub błędzie uploadu — data URI.
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
  const jpeg = await renderMap(lat, lng, geomWkt)
  if (!jpeg) return null
  if (storage) {
    const url = await uploadToStorage(key, jpeg)
    if (url) return url
  }
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}
