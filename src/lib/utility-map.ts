/**
 * Utility map generator — OSM tiles + GESUT WMS overlay → base64 PNG
 *
 * Data sources:
 *  - Base:    OpenStreetMap tile CDN (tile.openstreetmap.org)
 *  - Overlay: GUGiK Krajowa Integracja Uzbrojenia Terenu (WMS, public)
 */

const GESUT_WMS =
  'https://integracja02.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu'

const GESUT_LAYERS = [
  'przewod_wodociagowy',
  'przewod_kanalizacyjny',
  'przewod_gazowy',
  'przewod_elektroenergetyczny',
  'przewod_telekomunikacyjny',
  'przewod_cieplowniczy',
].join(',')

// ─── Geo helpers ─────────────────────────────────────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function lngLatToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(
    ((1 - Math.log(Math.tan(toRad(lat)) + 1 / Math.cos(toRad(lat))) / Math.PI) / 2) * n
  )
  return { x, y }
}

/** Pixel position within a tile grid (origin = top-left of tile tx0,ty0) */
function lngLatToPixel(
  lat: number,
  lng: number,
  zoom: number,
  tx0: number,
  ty0: number
) {
  const n = Math.pow(2, zoom)
  const px = ((lng + 180) / 360) * n * 256 - tx0 * 256
  const py =
    ((1 - Math.log(Math.tan(toRad(lat)) + 1 / Math.cos(toRad(lat))) / Math.PI) / 2) *
      n *
      256 -
    ty0 * 256
  return { px, py }
}

function lngLatTo3857(lat: number, lng: number) {
  const x = lng * 20037508.34 / 180
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)
  y = y * 20037508.34 / 180
  return { x, y }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Generate a utility map image (800×500 px) centered on the given coordinates.
 * Returns a base64-encoded PNG data URL, or null on failure.
 */
export async function generateUtilityMap(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default
    const W = 800
    const H = 500
    const ZOOM = 16  // Dobre dla działek — widać ulice + sieci

    // ── 1. Pobierz OSM tiles ─────────────────────────────────────────────────

    // Oblicz bbox ~500m wokół punktu
    const degPerM_lat = 1 / 111320
    const degPerM_lng = 1 / (111320 * Math.cos(toRad(lat)))
    const padLat = 300 * degPerM_lat
    const padLng = 400 * degPerM_lng

    const latMin = lat - padLat
    const latMax = lat + padLat
    const lngMin = lng - padLng
    const lngMax = lng + padLng

    // Tile range
    const tNW = lngLatToTile(latMax, lngMin, ZOOM)
    const tSE = lngLatToTile(latMin, lngMax, ZOOM)
    const tx0 = tNW.x, ty0 = tNW.y
    const tx1 = tSE.x, ty1 = tSE.y

    // Pobierz kafelki równolegle
    const tilePromises: Promise<{ tx: number; ty: number; buf: Buffer }>[] = []
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        tilePromises.push(
          fetch(`https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`, {
            headers: { 'User-Agent': 'SprawdzDzialke/1.0 (sprawdzdzialke.com)' },
            signal: AbortSignal.timeout(8000),
          })
            .then(r => r.arrayBuffer())
            .then(ab => ({ tx, ty, buf: Buffer.from(ab) }))
        )
      }
    }

    const tiles = await Promise.all(tilePromises)

    // Sklej kafelki w canvas
    const canvasW = (tx1 - tx0 + 1) * 256
    const canvasH = (ty1 - ty0 + 1) * 256

    let canvas = sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 241, g: 238, b: 232, alpha: 1 } },
    }).png()

    // Composite tiles onto canvas
    const composites: Parameters<ReturnType<typeof sharp>['composite']>[0] = tiles.map(({ tx, ty, buf }) => ({
      input: buf,
      left: (tx - tx0) * 256,
      top: (ty - ty0) * 256,
    }))

    const canvasBuf = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 241, g: 238, b: 232, alpha: 1 } },
    })
      .composite(composites)
      .png()
      .toBuffer()

    // Crop do bbox i resize do 800×500
    const { px: cropX0, py: cropY0 } = lngLatToPixel(latMax, lngMin, ZOOM, tx0, ty0)
    const { px: cropX1, py: cropY1 } = lngLatToPixel(latMin, lngMax, ZOOM, tx0, ty0)

    const cropW = Math.round(cropX1 - cropX0)
    const cropH = Math.round(cropY1 - cropY0)

    const baseBuf = await sharp(canvasBuf)
      .extract({
        left: Math.round(cropX0),
        top: Math.round(cropY0),
        width: Math.max(cropW, 1),
        height: Math.max(cropH, 1),
      })
      .resize(W, H)
      .png()
      .toBuffer()

    // ── 2. Pobierz GESUT overlay (WMS GetMap) ────────────────────────────────

    const sw = lngLatTo3857(latMin, lngMin)
    const ne = lngLatTo3857(latMax, lngMax)
    const bbox = `${sw.x.toFixed(0)},${sw.y.toFixed(0)},${ne.x.toFixed(0)},${ne.y.toFixed(0)}`

    const gesutUrl =
      `${GESUT_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&LAYERS=${GESUT_LAYERS}&STYLES=` +
      `&CRS=EPSG:3857&BBOX=${bbox}` +
      `&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE`

    const gesutResp = await fetch(gesutUrl, { signal: AbortSignal.timeout(10000) })
    const gesutBuf = Buffer.from(await gesutResp.arrayBuffer())

    // Sprawdź czy to PNG (nie błąd XML)
    const isValidPng = gesutBuf[0] === 0x89 && gesutBuf[1] === 0x50

    // ── 3. Composite: base + GESUT overlay ───────────────────────────────────

    const compositeInputs: Parameters<ReturnType<typeof sharp>['composite']>[0] = []

    if (isValidPng) {
      // Wzmocnij opacity overlay (linie sieci są cienkie)
      const enhancedGesut = await sharp(gesutBuf)
        .ensureAlpha()
        .modulate({ brightness: 1.0 })
        .toBuffer()

      compositeInputs.push({ input: enhancedGesut, blend: 'over' })
    }

    // Dodaj marker działki (czerwony krzyżyk)
    const markerSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${W / 2}" cy="${H / 2}" r="10" fill="none" stroke="#dc2626" stroke-width="3"/>
      <line x1="${W/2 - 16}" y1="${H/2}" x2="${W/2 + 16}" y2="${H/2}" stroke="#dc2626" stroke-width="2.5"/>
      <line x1="${W/2}" y1="${H/2 - 16}" x2="${W/2}" y2="${H/2 + 16}" stroke="#dc2626" stroke-width="2.5"/>
    </svg>`

    compositeInputs.push({ input: Buffer.from(markerSvg), blend: 'over' })

    const finalBuf = await sharp(baseBuf)
      .composite(compositeInputs)
      .jpeg({ quality: 88 })
      .toBuffer()

    return `data:image/jpeg;base64,${finalBuf.toString('base64')}`
  } catch (err) {
    console.error('[utility-map] Error:', err)
    return null
  }
}
