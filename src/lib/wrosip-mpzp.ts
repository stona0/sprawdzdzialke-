/**
 * MPZP via Zoomify raster analysis — wrosip.pl (Powiat Wrocławski)
 *
 * Approach:
 *  1. Plan definitions (bbox, scale, urls) stored in Supabase table `mpzp_plans`
 *  2. Full-resolution plan JPEG stored in Supabase Storage (bucket: mpzp-maps)
 *  3. For a given coordinate: find plan → compute pixel → download tile OR full image → sample color
 *  4. Color → zone designation via perceptual-distance lookup table
 *
 * Pixel sampling strategy (in order of preference):
 *  A. Supabase Storage full image → sharp extract 3×3 px region (self-contained, reliable)
 *  B. wrosip.pl Zoomify tiles     → fast 256×256 tile fetch     (external dependency)
 *
 * Color lookup built from plan #40 analysis (8132×4798 px):
 *  #1ea52d  15%  → ZL   Zieleń leśna / parkowa na gruntach leśnych
 *  #b4784b  10%  → MN   Zabudowa mieszkaniowa jednorodzinna
 *  #d22d1e   9%  → UP   Zabudowa usługowo-mieszkaniowa / tereny usług
 *  #8778b4   9%  → AG   Aktywność gospodarcza
 *  #87c387   5%  → ZP   Zieleń parkowa
 *  #a5d269   2%  → RP   Tereny rolne / zieleń nieurządzona
 */

import { createServiceClient } from './supabase/server'

// ─── Public result type ───────────────────────────────────────────────────────

export interface WrosipMpzpResult {
  symbol: string
  przeznaczenie: string
  plan_name: string
  plan_id: number
  pdf_url: string | null
  image_url: string | null
  zrodlo: 'wrosip_raster'
  pewnosc: 'wysoka' | 'srednia' | 'niska'
  hex_color?: string
}

// ─── DB plan type (mirrors mpzp_plans table) ─────────────────────────────────

interface DbPlan {
  id: number
  gmina_teryt: string
  gmina_nazwa: string
  plan_id: number
  plan_name: string
  uchwala_nr: string | null
  uchwala_data: string | null
  west: number
  east: number
  south: number
  north: number
  img_w: number
  img_h: number
  m_per_px: number
  map_w_frac: number
  image_url: string | null
  pdf_url: string | null
  source: string
}

// Fallback static plans — used if DB is unavailable
const FALLBACK_PLANS: DbPlan[] = [
  {
    id: 1, gmina_teryt: '026101', gmina_nazwa: 'Długołęka',
    plan_id: 40, plan_name: 'MPZP Obręb wsi Długołęka',
    uchwala_nr: 'NR XXXVIII/581/2005', uchwala_data: '2005-03-30',
    west: 17.1620, east: 17.2082, south: 51.1168, north: 51.1373,
    img_w: 8132, img_h: 4798, m_per_px: 0.4762, map_w_frac: 0.75,
    image_url: 'https://dpabcijnuzrkzstpnxlz.supabase.co/storage/v1/object/public/mpzp-maps/dlugoleka/plan-40-mapa.jpg',
    pdf_url: 'https://dpabcijnuzrkzstpnxlz.supabase.co/storage/v1/object/public/mpzp-maps/dlugoleka/plan-40-uchwala.pdf',
    source: 'wrosip',
  },
  {
    id: 2, gmina_teryt: '026101', gmina_nazwa: 'Długołęka',
    plan_id: 101, plan_name: 'Długołęka II – URZĄD',
    uchwala_nr: null, uchwala_data: null,
    west: 17.1830, east: 17.1970, south: 51.1230, north: 51.1310,
    img_w: 4720, img_h: 2814, m_per_px: 0.4762, map_w_frac: 0.78,
    image_url: null, pdf_url: null, source: 'wrosip',
  },
  {
    id: 3, gmina_teryt: '026101', gmina_nazwa: 'Długołęka',
    plan_id: 113, plan_name: 'Długołęka IV – dz. 49/4',
    uchwala_nr: null, uchwala_data: null,
    west: 17.1770, east: 17.1920, south: 51.1190, north: 51.1290,
    img_w: 6495, img_h: 4487, m_per_px: 0.4762, map_w_frac: 0.78,
    image_url: null, pdf_url: null, source: 'wrosip',
  },
  {
    id: 4, gmina_teryt: '026101', gmina_nazwa: 'Długołęka',
    plan_id: 124, plan_name: 'Długołęka dz. 437/3',
    uchwala_nr: null, uchwala_data: null,
    west: 17.1860, east: 17.2000, south: 51.1200, north: 51.1300,
    img_w: 6614, img_h: 4676, m_per_px: 0.4762, map_w_frac: 0.78,
    image_url: null, pdf_url: null, source: 'wrosip',
  },
  {
    id: 5, gmina_teryt: '026101', gmina_nazwa: 'Długołęka',
    plan_id: 125, plan_name: 'Długołęka dz. 79/10',
    uchwala_nr: null, uchwala_data: null,
    west: 17.1780, east: 17.1950, south: 51.1240, north: 51.1340,
    img_w: 6614, img_h: 4676, m_per_px: 0.4762, map_w_frac: 0.78,
    image_url: null, pdf_url: null, source: 'wrosip',
  },
]

// ─── Plan loader (DB → fallback) ─────────────────────────────────────────────

async function loadPlans(gminaTeryt: string): Promise<DbPlan[]> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('mpzp_plans')
      .select('*')
      .eq('gmina_teryt', gminaTeryt)
      .eq('aktywny', true)
      .order('plan_id')

    if (error || !data?.length) throw new Error('no data')
    return data as DbPlan[]
  } catch {
    // Table not yet created or unavailable — use fallback
    return FALLBACK_PLANS.filter(p => p.gmina_teryt === gminaTeryt)
  }
}

// ─── Color → Zone lookup ──────────────────────────────────────────────────────

interface ZoneColor {
  r: number; g: number; b: number
  symbol: string; przeznaczenie: string
  pewnosc: 'wysoka' | 'srednia' | 'niska'
}

const ZONE_COLORS: ZoneColor[] = [
  // Bright green → ZL (forest parks)
  { r: 30,  g: 165, b: 45,  symbol: 'ZL',  przeznaczenie: 'Zieleń parkowa na gruntach leśnych',           pewnosc: 'wysoka' },
  { r: 30,  g: 150, b: 45,  symbol: 'ZL',  przeznaczenie: 'Zieleń parkowa na gruntach leśnych',           pewnosc: 'wysoka' },
  // Brown → MN (single-family residential)
  { r: 180, g: 120, b: 75,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej',  pewnosc: 'wysoka' },
  { r: 165, g: 120, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej',  pewnosc: 'wysoka' },
  { r: 165, g: 120, b: 75,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej',  pewnosc: 'wysoka' },
  { r: 180, g: 135, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej',  pewnosc: 'wysoka' },
  { r: 150, g: 120, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej',  pewnosc: 'wysoka' },
  // Red → UP (service/residential mixed)
  { r: 210, g: 45,  b: 30,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',        pewnosc: 'wysoka' },
  { r: 210, g: 30,  b: 30,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',        pewnosc: 'wysoka' },
  { r: 195, g: 45,  b: 30,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',        pewnosc: 'wysoka' },
  { r: 225, g: 90,  b: 90,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',        pewnosc: 'srednia' },
  // Purple → AG (industrial/commercial)
  { r: 135, g: 120, b: 180, symbol: 'AG',  przeznaczenie: 'Tereny aktywności gospodarczej',                pewnosc: 'wysoka' },
  { r: 135, g: 135, b: 180, symbol: 'AG',  przeznaczenie: 'Tereny aktywności gospodarczej',                pewnosc: 'wysoka' },
  { r: 135, g: 120, b: 165, symbol: 'AG',  przeznaczenie: 'Tereny aktywności gospodarczej',                pewnosc: 'wysoka' },
  // Light green → ZP (parks)
  { r: 135, g: 195, b: 135, symbol: 'ZP',  przeznaczenie: 'Tereny zieleni parkowej',                       pewnosc: 'wysoka' },
  { r: 150, g: 195, b: 150, symbol: 'ZP',  przeznaczenie: 'Tereny zieleni parkowej',                       pewnosc: 'wysoka' },
  // Yellow-green → RP/ZN (agricultural / unorganized green)
  { r: 165, g: 210, b: 105, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych / zieleń nieurządzona',  pewnosc: 'srednia' },
  { r: 150, g: 210, b: 105, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych / zieleń nieurządzona',  pewnosc: 'srednia' },
  // Light cream → agricultural
  { r: 250, g: 240, b: 200, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych',                        pewnosc: 'srednia' },
]

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    (r1 - r2) ** 2 * 0.30 +
    (g1 - g2) ** 2 * 0.59 +
    (b1 - b2) ** 2 * 0.11
  )
}

function classifyColor(r: number, g: number, b: number) {
  const brightness = Math.max(r, g, b)
  const saturation = brightness - Math.min(r, g, b)

  if (brightness > 240) return null   // white background
  if (brightness < 30)  return null   // black border lines
  if (saturation < 15 && brightness > 160) return { symbol: 'KD', przeznaczenie: 'Tereny komunikacji drogowej', pewnosc: 'niska' as const }
  if (saturation < 15)  return null   // dark gray

  let best: ZoneColor | null = null
  let bestDist = Infinity
  for (const z of ZONE_COLORS) {
    const d = colorDistance(r, g, b, z.r, z.g, z.b)
    if (d < bestDist) { bestDist = d; best = z }
  }
  if (!best || bestDist > 50) return null
  const pewnosc = bestDist < 20 ? best.pewnosc : 'niska'
  return { symbol: best.symbol, przeznaczenie: best.przeznaczenie, pewnosc }
}

// ─── Pixel sampler — Strategy A: Supabase Storage full image ─────────────────

async function sampleFromStorageImage(
  imageUrl: string, px: number, py: number
): Promise<{ r: number; g: number; b: number } | null> {
  try {
    const sharp = (await import('sharp').catch(() => null)) as typeof import('sharp') | null
    if (!sharp) return null

    const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
    if (!resp.ok) return null
    const buffer = Buffer.from(await resp.arrayBuffer())

    const left  = Math.max(0, px - 1)
    const top   = Math.max(0, py - 1)
    const { data } = await sharp(buffer)
      .extract({ left, top, width: 3, height: 3 })
      .raw()
      .toBuffer({ resolveWithObject: true })

    let rSum = 0, gSum = 0, bSum = 0
    for (let i = 0; i < data.length; i += 3) {
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]
    }
    const n = data.length / 3
    return { r: Math.round(rSum / n), g: Math.round(gSum / n), b: Math.round(bSum / n) }
  } catch {
    return null
  }
}

// ─── Pixel sampler — Strategy B: Zoomify tile from wrosip.pl ─────────────────

const WROSIP_BASE = 'https://wrosip.pl/zoom//dlugoleka'
const TILE_SIZE = 256

function levelOffset(imgW: number, imgH: number, targetLevel: number): number {
  const levels: [number, number][] = []
  let lw = imgW, lh = imgH
  while (true) {
    levels.unshift([Math.ceil(lw / TILE_SIZE), Math.ceil(lh / TILE_SIZE)])
    if (lw <= TILE_SIZE && lh <= TILE_SIZE) break
    lw = Math.ceil(lw / 2); lh = Math.ceil(lh / 2)
  }
  let off = 0
  for (let i = 0; i < targetLevel; i++) off += levels[i][0] * levels[i][1]
  return off
}

async function sampleFromZoomifyTile(
  plan: DbPlan, px: number, py: number
): Promise<{ r: number; g: number; b: number } | null> {
  try {
    const sharp = (await import('sharp').catch(() => null)) as typeof import('sharp') | null
    if (!sharp) return null

    let lw = plan.img_w, lh = plan.img_h, lvl = 0
    while (lw > TILE_SIZE || lh > TILE_SIZE) { lw = Math.ceil(lw / 2); lh = Math.ceil(lh / 2); lvl++ }
    const maxLevel = lvl
    const maxCols  = Math.ceil(plan.img_w / TILE_SIZE)
    const tileX = Math.floor(px / TILE_SIZE)
    const tileY = Math.floor(py / TILE_SIZE)
    const off   = levelOffset(plan.img_w, plan.img_h, maxLevel)
    const group = Math.floor((off + tileY * maxCols + tileX) / 256)

    const url = `${WROSIP_BASE}/${plan.plan_id}/TileGroup${group}/${maxLevel}-${tileX}-${tileY}.jpg`
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())

    const innerX = Math.max(0, (px - tileX * TILE_SIZE) - 1)
    const innerY = Math.max(0, (py - tileY * TILE_SIZE) - 1)
    const { data } = await sharp(buf)
      .extract({ left: innerX, top: innerY, width: 3, height: 3 })
      .raw()
      .toBuffer({ resolveWithObject: true })

    let rSum = 0, gSum = 0, bSum = 0
    for (let i = 0; i < data.length; i += 3) {
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]
    }
    const n = data.length / 3
    return { r: Math.round(rSum / n), g: Math.round(gSum / n), b: Math.round(bSum / n) }
  } catch {
    return null
  }
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Given WGS84 coordinates, find the matching Długołęka MPZP plan,
 * sample the pixel color, and return the zone designation.
 */
export async function getDlugolekaMpzpZone(
  lat: number,
  lng: number
): Promise<WrosipMpzpResult | null> {
  const plans = await loadPlans('026101')
  const plan  = plans.find(p => lat >= p.south && lat <= p.north && lng >= p.west && lng <= p.east)
  if (!plan) return null

  // coord → pixel
  const mapWpx = Math.floor(plan.img_w * plan.map_w_frac)
  const px = Math.round((lng - plan.west)   / (plan.east  - plan.west)  * mapWpx)
  const py = Math.round((plan.north - lat)   / (plan.north - plan.south) * plan.img_h)

  if (px < 0 || px >= plan.img_w || py < 0 || py >= plan.img_h) return null

  // Strategy A: full image from Supabase Storage (preferred — self-contained)
  // Strategy B: Zoomify tile from wrosip.pl (fallback)
  const color =
    (plan.image_url ? await sampleFromStorageImage(plan.image_url, px, py) : null)
    ?? await sampleFromZoomifyTile(plan, px, py)

  const hex = color
    ? `#${color.r.toString(16).padStart(2,'0')}${color.g.toString(16).padStart(2,'0')}${color.b.toString(16).padStart(2,'0')}`
    : undefined

  if (!color) {
    return {
      symbol: '?',
      przeznaczenie: 'Nie można odczytać koloru z rastra',
      plan_name: plan.plan_name,
      plan_id: plan.plan_id,
      pdf_url: plan.pdf_url,
      image_url: plan.image_url,
      zrodlo: 'wrosip_raster',
      pewnosc: 'niska',
    }
  }

  const zone = classifyColor(color.r, color.g, color.b)

  return {
    symbol:        zone?.symbol       ?? '?',
    przeznaczenie: zone?.przeznaczenie ?? 'Nierozpoznana strefa (granica, droga lub brak danych)',
    plan_name:  plan.plan_name,
    plan_id:    plan.plan_id,
    pdf_url:    plan.pdf_url,
    image_url:  plan.image_url,
    zrodlo:     'wrosip_raster',
    pewnosc:    zone?.pewnosc ?? 'niska',
    hex_color:  hex,
  }
}

/** Quick check: does this coordinate fall in any known Długołęka plan? */
export async function isDlugolek(lat: number, lng: number): Promise<boolean> {
  const plans = await loadPlans('026101')
  return plans.some(p => lat >= p.south && lat <= p.north && lng >= p.west && lng <= p.east)
}
