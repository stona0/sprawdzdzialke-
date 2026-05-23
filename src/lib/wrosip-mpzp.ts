/**
 * MPZP via Zoomify raster analysis — Gmina Długołęka (wrosip.pl)
 *
 * Approach:
 *  1. Plans are served as Zoomify tiles at wrosip.pl/zoom//dlugoleka/{id}/
 *  2. Each plan has an estimated geographic bounding box (szacunkowo ±200m)
 *  3. For a given coordinate: find plan → compute pixel → download tile → sample color
 *  4. Color → zone designation via lookup table
 *
 * Color analysis from plan #40 (full 8132×4798 map):
 *  #1ea52d  15%  → ZL  Zieleń leśna / parkowa na gruntach leśnych
 *  #b4784b  10%  → MN  Zabudowa mieszkaniowa jednorodzinna
 *  #d22d1e   9%  → UP  Zabudowa usługowo-mieszkaniowa / tereny usług
 *  #8778b4   9%  → AG  Aktywność gospodarcza (przemysł/usługi)
 *  #87c387   5%  → ZP  Zieleń parkowa
 *  #a5d269   2%  → RP  Tereny rolne / zieleń nieurządzona
 */

export interface WrosipMpzpResult {
  symbol: string
  przeznaczenie: string
  plan_name: string
  plan_id: number
  zrodlo: 'wrosip_raster'
  pewnosc: 'wysoka' | 'srednia' | 'niska'
  hex_color?: string
}

// ─── Plan catalog ─────────────────────────────────────────────────────────────

interface PlanDef {
  id: number                // Zoomify folder ID
  name: string
  img_w: number             // image width in pixels
  img_h: number             // image height in pixels
  map_w_frac: number        // fraction of image width that is actual map (rest = legend)
  // Geographic bbox (estimated, ±200m)
  west: number
  east: number
  south: number
  north: number
  m_per_px: number          // meters per pixel (from scale bar measurement)
}

// Plan #40 — MPZP Obręb wsi Długołęka (główny plan, cały obręb)
// Scale bar measured: 1050px = 500m → 0.4762 m/px
// Map content: ~75% of image width (rest = legend)
// Estimated bbox based on scale + visible landmarks
const DLUGOLEKA_PLANS: PlanDef[] = [
  {
    id: 40,
    name: 'MPZP Obręb wsi Długołęka',
    img_w: 8132,
    img_h: 4798,
    map_w_frac: 0.75,
    west: 17.1620,
    east: 17.2082,
    south: 51.1168,
    north: 51.1373,
    m_per_px: 0.4762,
  },
  {
    id: 101,
    name: 'Długołęka II – URZĄD',
    img_w: 4720,
    img_h: 2814,
    map_w_frac: 0.78,
    // Small plan near village center (urząd = office area)
    west: 17.1830,
    east: 17.1970,
    south: 51.1230,
    north: 51.1310,
    m_per_px: 0.4762,
  },
  {
    id: 113,
    name: 'Długołęka IV – dz. 49/4',
    img_w: 6495,
    img_h: 4487,
    map_w_frac: 0.78,
    // Small plan, parcel 49/4 in Długołęka
    west: 17.1770,
    east: 17.1920,
    south: 51.1190,
    north: 51.1290,
    m_per_px: 0.4762,
  },
  {
    id: 124,
    name: 'Długołęka dz. 437/3',
    img_w: 6614,
    img_h: 4676,
    map_w_frac: 0.78,
    // Small plan, parcel 437/3
    west: 17.1860,
    east: 17.2000,
    south: 51.1200,
    north: 51.1300,
    m_per_px: 0.4762,
  },
  {
    id: 125,
    name: 'Długołęka dz. 79/10',
    img_w: 6614,
    img_h: 4676,
    map_w_frac: 0.78,
    // Small plan, parcel 79/10
    west: 17.1780,
    east: 17.1950,
    south: 51.1240,
    north: 51.1340,
    m_per_px: 0.4762,
  },
]

// ─── Color → Zone lookup ──────────────────────────────────────────────────────

interface ZoneColor {
  r: number
  g: number
  b: number
  symbol: string
  przeznaczenie: string
  pewnosc: 'wysoka' | 'srednia' | 'niska'
}

// Colors measured from plan #40 dominant zone analysis
const ZONE_COLORS: ZoneColor[] = [
  // Bright green → ZL (forest parks) — 15% of map
  { r: 30,  g: 165, b: 45,  symbol: 'ZL',  przeznaczenie: 'Zieleń parkowa na gruntach leśnych',          pewnosc: 'wysoka' },
  { r: 30,  g: 150, b: 45,  symbol: 'ZL',  przeznaczenie: 'Zieleń parkowa na gruntach leśnych',          pewnosc: 'wysoka' },
  // Brown → MN (single-family residential) — 10% of map
  { r: 180, g: 120, b: 75,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej', pewnosc: 'wysoka' },
  { r: 165, g: 120, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej', pewnosc: 'wysoka' },
  { r: 165, g: 120, b: 75,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej', pewnosc: 'wysoka' },
  { r: 180, g: 135, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej', pewnosc: 'wysoka' },
  { r: 150, g: 120, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej', pewnosc: 'wysoka' },
  { r: 180, g: 120, b: 90,  symbol: 'MN',  przeznaczenie: 'Tereny zabudowy mieszkaniowej jednorodzinnej', pewnosc: 'wysoka' },
  // Red → UP (service/residential mixed) — 9% of map
  { r: 210, g: 45,  b: 30,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',       pewnosc: 'wysoka' },
  { r: 210, g: 30,  b: 30,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',       pewnosc: 'wysoka' },
  { r: 195, g: 45,  b: 30,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',       pewnosc: 'wysoka' },
  { r: 225, g: 90,  b: 90,  symbol: 'UP',  przeznaczenie: 'Tereny zabudowy usługowo-mieszkaniowej',       pewnosc: 'srednia' },
  // Purple/lavender → AG (industrial/commercial activity) — 9% of map
  { r: 135, g: 120, b: 180, symbol: 'AG',  przeznaczenie: 'Tereny aktywności gospodarczej',               pewnosc: 'wysoka' },
  { r: 135, g: 135, b: 180, symbol: 'AG',  przeznaczenie: 'Tereny aktywności gospodarczej',               pewnosc: 'wysoka' },
  { r: 135, g: 120, b: 165, symbol: 'AG',  przeznaczenie: 'Tereny aktywności gospodarczej',               pewnosc: 'wysoka' },
  // Light green → ZP (parks) or ZN (unorganized green) — 5%
  { r: 135, g: 195, b: 135, symbol: 'ZP',  przeznaczenie: 'Tereny zieleni parkowej',                      pewnosc: 'wysoka' },
  { r: 150, g: 195, b: 150, symbol: 'ZP',  przeznaczenie: 'Tereny zieleni parkowej',                      pewnosc: 'wysoka' },
  // Yellow-green → RP/ZN (agricultural / unorganized green) — 2.4%
  { r: 165, g: 210, b: 105, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych / zieleń nieurządzona', pewnosc: 'srednia' },
  { r: 150, g: 210, b: 105, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych / zieleń nieurządzona', pewnosc: 'srednia' },
  // Dark red/maroon → special zones
  { r: 90,  g: 0,   b: 0,   symbol: 'UP',  przeznaczenie: 'Tereny usług publicznych / kultury',           pewnosc: 'niska'  },
  // Light tan/cream → agricultural fields
  { r: 250, g: 240, b: 200, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych',                       pewnosc: 'srednia' },
  { r: 250, g: 240, b: 190, symbol: 'RP',  przeznaczenie: 'Tereny gruntów rolnych',                       pewnosc: 'srednia' },
]

// ─── Color matching ───────────────────────────────────────────────────────────

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) * 0.3 +
    Math.pow(g1 - g2, 2) * 0.59 +
    Math.pow(b1 - b2, 2) * 0.11
  )
}

function classifyColor(r: number, g: number, b: number): { symbol: string; przeznaczenie: string; pewnosc: 'wysoka' | 'srednia' | 'niska' } | null {
  // Ignore white, near-white (background), black (borders), and gray (roads)
  const brightness = Math.max(r, g, b)
  const darkness = Math.min(r, g, b)
  const saturation = brightness - darkness

  if (brightness > 240) return null  // white background
  if (brightness < 30)  return null  // black border lines
  if (saturation < 20 && brightness > 180) return null  // light gray (roads/background)
  if (saturation < 15)  return { symbol: 'KD', przeznaczenie: 'Tereny komunikacji / drogi', pewnosc: 'niska' }

  let bestMatch: ZoneColor | null = null
  let bestDist = Infinity

  for (const zone of ZONE_COLORS) {
    const dist = colorDistance(r, g, b, zone.r, zone.g, zone.b)
    if (dist < bestDist) {
      bestDist = dist
      bestMatch = zone
    }
  }

  // Only trust close matches (threshold ~40 in perceptual distance)
  if (!bestMatch || bestDist > 50) return null

  const pewnosc = bestDist < 20 ? bestMatch.pewnosc : 'niska'
  return { symbol: bestMatch.symbol, przeznaczenie: bestMatch.przeznaczenie, pewnosc }
}

// ─── Zoomify tile fetcher ─────────────────────────────────────────────────────

const WROSIP_BASE = 'https://wrosip.pl/zoom//dlugoleka'
const TILE_SIZE = 256

function getTileGroup(tileIndex: number): number {
  return Math.floor(tileIndex / 256)
}

function computeLevelOffset(imgW: number, imgH: number, targetLevel: number): number {
  // Zoomify levels from lowest (0) to highest resolution
  const levels: Array<[number, number]> = []
  let lw = imgW, lh = imgH
  while (true) {
    const cols = Math.ceil(lw / TILE_SIZE)
    const rows = Math.ceil(lh / TILE_SIZE)
    levels.unshift([cols, rows])
    if (lw <= TILE_SIZE && lh <= TILE_SIZE) break
    lw = Math.ceil(lw / 2)
    lh = Math.ceil(lh / 2)
  }

  let offset = 0
  for (let i = 0; i < targetLevel; i++) {
    const [cols, rows] = levels[i]
    offset += cols * rows
  }
  return offset
}

async function samplePixelColor(
  plan: PlanDef,
  px: number,
  py: number
): Promise<{ r: number; g: number; b: number } | null> {
  const { img_w, img_h, id } = plan

  // Compute tile coordinates at full resolution
  const tileX = Math.floor(px / TILE_SIZE)
  const tileY = Math.floor(py / TILE_SIZE)

  // Compute zoom level (highest = full resolution)
  let lw = img_w, lh = img_h
  let levelCount = 0
  while (lw > TILE_SIZE || lh > TILE_SIZE) {
    lw = Math.ceil(lw / 2)
    lh = Math.ceil(lh / 2)
    levelCount++
  }
  const maxLevel = levelCount
  const maxCols = Math.ceil(img_w / TILE_SIZE)

  const offset = computeLevelOffset(img_w, img_h, maxLevel)
  const tileIndex = offset + tileY * maxCols + tileX
  const group = getTileGroup(tileIndex)

  const url = `${WROSIP_BASE}/${id}/TileGroup${group}/${maxLevel}-${tileX}-${tileY}.jpg`

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    const buffer = await resp.arrayBuffer()

    // Parse JPEG and sample pixel
    // Decode JPEG without external canvas — use sharp or jimp if available,
    // otherwise fall back to a manual DCT approximation via raw Buffer scan.
    // In production (Netlify edge / Node.js) we use the 'sharp' package.
    try {
      const sharp = (await import('sharp').catch(() => null)) as typeof import('sharp') | null
      if (!sharp) {
        console.warn('[wrosip-mpzp] sharp not available, cannot sample pixel')
        return null
      }
      const innerX = px - tileX * TILE_SIZE
      const innerY = py - tileY * TILE_SIZE

      const { data } = await sharp(Buffer.from(buffer))
        .extract({ left: innerX, top: innerY, width: 3, height: 3 })
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Average 3×3 patch for stability
      let rSum = 0, gSum = 0, bSum = 0
      for (let i = 0; i < data.length; i += 3) {
        rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]
      }
      const n = data.length / 3
      return { r: Math.round(rSum / n), g: Math.round(gSum / n), b: Math.round(bSum / n) }
    } catch {
      return null
    }
  } catch {
    return null
  }
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Find which Długołęka plan covers these coordinates,
 * sample the pixel color, and return the MPZP zone.
 */
export async function getDlugolekaMpzpZone(
  lat: number,
  lng: number
): Promise<WrosipMpzpResult | null> {
  // Find plan that covers this coordinate
  const plan = DLUGOLEKA_PLANS.find(
    p => lat >= p.south && lat <= p.north && lng >= p.west && lng <= p.east
  )

  if (!plan) return null

  // Convert coordinate to pixel
  const mapWidthPx = Math.floor(plan.img_w * plan.map_w_frac)
  const px = Math.round((lng - plan.west) / (plan.east - plan.west) * mapWidthPx)
  const py = Math.round((plan.north - lat) / (plan.north - plan.south) * plan.img_h)

  // Clamp to image bounds
  if (px < 0 || px >= plan.img_w || py < 0 || py >= plan.img_h) return null

  const color = await samplePixelColor(plan, px, py)
  if (!color) {
    // Can't sample pixel — return plan info without zone
    return {
      symbol: '?',
      przeznaczenie: 'Nie można odczytać strefy z rastra',
      plan_name: plan.name,
      plan_id: plan.id,
      zrodlo: 'wrosip_raster',
      pewnosc: 'niska',
    }
  }

  const zone = classifyColor(color.r, color.g, color.b)
  const hex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`

  if (!zone) {
    return {
      symbol: '?',
      przeznaczenie: 'Granica, droga lub nierozpoznana strefa',
      plan_name: plan.name,
      plan_id: plan.id,
      zrodlo: 'wrosip_raster',
      pewnosc: 'niska',
      hex_color: hex,
    }
  }

  return {
    symbol: zone.symbol,
    przeznaczenie: zone.przeznaczenie,
    plan_name: plan.name,
    plan_id: plan.id,
    zrodlo: 'wrosip_raster',
    pewnosc: zone.pewnosc,
    hex_color: hex,
  }
}

/**
 * Check if a coordinate falls within any known Długołęka plan.
 */
export function isDlugoleka(lat: number, lng: number): boolean {
  return DLUGOLEKA_PLANS.some(
    p => lat >= p.south && lat <= p.north && lng >= p.west && lng <= p.east
  )
}

/**
 * Get all plans that cover a coordinate (may be multiple overlapping plans).
 */
export function getDlugolelkaPlansForCoord(lat: number, lng: number): PlanDef[] {
  return DLUGOLEKA_PLANS.filter(
    p => lat >= p.south && lat <= p.north && lng >= p.west && lng <= p.east
  )
}
