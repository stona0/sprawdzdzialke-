/**
 * Utility map generator — CartoDB Positron + GESUT WMS (SLD-styled) → Supabase Storage cache
 *
 * Pipeline:
 *  1. Sprawdź bucket utility-maps w Supabase Storage (klucz ~100m siatka, wersja v2)
 *  2. Cache hit → zwróć publiczny CDN URL natychmiast
 *  3. Cache miss → sharp tile-stitch:
 *       - CartoDB Positron base tiles (jasne, czyste — nie zasłaniają sieci)
 *       - GESUT WMS z SLD_BODY (grube, kolorowe linie per typ sieci)
 *       - SVG overlays: granica działki, okrąg analizy, legenda, marker
 *     → upload do Storage → CDN URL
 *
 * Wersja v2: CartoDB Positron + SLD styling + granica działki + legenda
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

const STORAGE_BUCKET = 'utility-maps'

// Kolory per typ sieci (zgodne z map_prompt.md)
const NETWORK_STYLES = [
  { layer: 'przewod_elektroenergetyczny', color: '#DC2626', width: 4 },
  { layer: 'przewod_wodociagowy',         color: '#2563EB', width: 4 },
  { layer: 'przewod_kanalizacyjny',       color: '#D97706', width: 4 },
  { layer: 'przewod_gazowy',             color: '#F59E0B', width: 4 },
  { layer: 'przewod_telekomunikacyjny',  color: '#4B5563', width: 3 },
  { layer: 'przewod_cieplowniczy',       color: '#7C3AED', width: 3 },
]

// ─── Cache helpers ────────────────────────────────────────────────────────────

/** Klucz cache v3: zoom18, KIEG cadastral, HTML legenda */
function cacheKey(lat: number, lng: number): string {
  const la = Math.round(lat * 1000) / 1000
  const lo = Math.round(lng * 1000) / 1000
  return `${la}_${lo}_v3.jpg`
}

async function checkCache(key: string): Promise<string | null> {
  try {
    const { createServiceClient } = await import('./supabase/server')
    const supabase = await createServiceClient()
    const { data } = await supabase.storage.from(STORAGE_BUCKET).list('', { search: key })
    if (data && data.length > 0) {
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key)
      return urlData?.publicUrl ?? null
    }
    return null
  } catch {
    return null
  }
}

async function uploadToStorage(key: string, jpegBuf: Buffer): Promise<string | null> {
  try {
    const { createServiceClient } = await import('./supabase/server')
    const supabase = await createServiceClient()
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(key, jpegBuf, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '604800', // 7 dni
    })
    if (error) {
      console.error('[utility-map] Storage upload error:', error.message)
      return null
    }
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(key)
    return urlData?.publicUrl ?? null
  } catch (err) {
    console.error('[utility-map] Storage upload exception:', err)
    return null
  }
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

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

function lngLatToPixel(lat: number, lng: number, zoom: number, tx0: number, ty0: number) {
  const n = Math.pow(2, zoom)
  const px = ((lng + 180) / 360) * n * 256 - tx0 * 256
  const py =
    ((1 - Math.log(Math.tan(toRad(lat)) + 1 / Math.cos(toRad(lat))) / Math.PI) / 2) *
      n * 256 - ty0 * 256
  return { px, py }
}

function lngLatTo3857(lat: number, lng: number) {
  const x = lng * 20037508.34 / 180
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180)
  y = y * 20037508.34 / 180
  return { x, y }
}

/** EPSG:2180 (CS92) → przybliżone WGS84 — dokładność ~50-100m, OK dla wizualizacji */
function epsg2180ToWgs84(x: number, y: number): { lat: number; lng: number } {
  const lat = (y + 5_300_000) / (111_320 * 0.9993)
  const lng = 19.0 + (x - 500_000) / (111_320 * 0.9993 * Math.cos(toRad(lat)))
  return { lat, lng }
}

/** Parsuje WKT POLYGON (SRID=2180;POLYGON (...)) → tablica punktów WGS84 */
function parseWktToWgs84(wkt: string): Array<{ lat: number; lng: number }> {
  const pairs = wkt.match(/-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g)
  if (!pairs || pairs.length < 3) return []
  return pairs.map(p => {
    const [x, y] = p.trim().split(/\s+/).map(Number)
    return epsg2180ToWgs84(x, y)
  })
}

// ─── SLD Builder ─────────────────────────────────────────────────────────────

function buildSLD(): string {
  const namedLayers = NETWORK_STYLES.map(({ layer, color, width }) => `  <NamedLayer>
    <Name>${layer}</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">${color}</CssParameter>
              <CssParameter name="stroke-width">${width}</CssParameter>
              <CssParameter name="stroke-linecap">round</CssParameter>
              <CssParameter name="stroke-linejoin">round</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${namedLayers}
</StyledLayerDescriptor>`
}

// ─── SVG Overlays ─────────────────────────────────────────────────────────────

/** Granica działki — niebieski dashed polygon */
function buildParcelBoundarySvg(
  W: number, H: number,
  polygon: Array<{ lat: number; lng: number }>,
  zoom: number, tx0: number, ty0: number,
  cropX0: number, cropY0: number,
  origW: number, origH: number
): Buffer | null {
  if (polygon.length < 3) return null

  const points = polygon.map(pt => {
    const { px, py } = lngLatToPixel(pt.lat, pt.lng, zoom, tx0, ty0)
    const ox = ((px - cropX0) / origW) * W
    const oy = ((py - cropY0) / origH) * H
    return `${ox.toFixed(1)},${oy.toFixed(1)}`
  }).join(' ')

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${points}"
    fill="rgba(37,99,235,0.06)"
    stroke="#2563EB"
    stroke-width="3"
    stroke-dasharray="10 6"
    stroke-linejoin="round"/>
</svg>`
  return Buffer.from(svg)
}

/** Okrąg analizy 200m — szary dashed circle */
function buildAnalysisCircleSvg(
  W: number, H: number,
  lat: number, lng: number,
  zoom: number, tx0: number, ty0: number,
  cropX0: number, cropY0: number,
  origW: number, origH: number
): Buffer {
  const { px, py } = lngLatToPixel(lat, lng, zoom, tx0, ty0)
  const ocx = ((px - cropX0) / origW) * W
  const ocy = ((py - cropY0) / origH) * H

  // Piksele na metr w płaszczyźnie mapy przy danym zoomie
  const pixelsPerMeter =
    256 * Math.pow(2, zoom) / (2 * Math.PI * 6378137 * Math.cos(toRad(lat)))
  // Przelicz przez skalę resize
  const r = 200 * pixelsPerMeter * (W / origW)

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${ocx.toFixed(1)}" cy="${ocy.toFixed(1)}" r="${r.toFixed(1)}"
    fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.9"/>
</svg>`
  return Buffer.from(svg)
}

// Legenda przeniesiona do HTML raportu — SVG text nie renderuje się
// poprawnie przez librsvg bez systemowych fontów na serwerze.

/** Marker centralny (okrąg + krzyżyk) */
function buildMarkerSvg(W: number, H: number): Buffer {
  const cx = W / 2
  const cy = H / 2
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#DC2626" stroke-width="3" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="3" fill="#DC2626" opacity="0.9"/>
  <line x1="${cx - 16}" y1="${cy}" x2="${cx + 16}" y2="${cy}" stroke="#DC2626" stroke-width="2" opacity="0.7"/>
  <line x1="${cx}" y1="${cy - 16}" x2="${cx}" y2="${cy + 16}" stroke="#DC2626" stroke-width="2" opacity="0.7"/>
</svg>`
  return Buffer.from(svg)
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

async function renderMap(
  lat: number,
  lng: number,
  geomWkt?: string | null
): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default
    const W = 1200
    const H = 750
    const ZOOM = 18   // zoom 18 = bardzo dobre detale, widać drogi, działki, zabudowania

    // Bbox ~520×840m wokół punktu — dobry balans: widać okolice ale działka dominuje
    const degPerM_lat = 1 / 111320
    const degPerM_lng = 1 / (111320 * Math.cos(toRad(lat)))
    const padLat = 260 * degPerM_lat
    const padLng = 420 * degPerM_lng

    const latMin = lat - padLat
    const latMax = lat + padLat
    const lngMin = lng - padLng
    const lngMax = lng + padLng

    // Tile range
    const tNW = lngLatToTile(latMax, lngMin, ZOOM)
    const tSE = lngLatToTile(latMin, lngMax, ZOOM)
    const tx0 = tNW.x, ty0 = tNW.y
    const tx1 = tSE.x, ty1 = tSE.y

    // Pobierz kafelki CartoDB Positron równolegle
    const tilePromises: Promise<{ tx: number; ty: number; buf: Buffer } | null>[] = []
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const subdomain = ['a', 'b', 'c', 'd'][(tx + ty) % 4]
        const url = `https://${subdomain}.basemaps.cartocdn.com/light_all/${ZOOM}/${tx}/${ty}.png`
        tilePromises.push(
          fetch(url, {
            headers: {
              'User-Agent': 'SprawdzDzialke/2.0 (+https://sprawdzdzialke.com)',
              'Referer':    'https://sprawdzdzialke.com',
              'Accept':     'image/png,image/*',
            },
            signal: AbortSignal.timeout(8000),
          })
            .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(ab => ({ tx, ty, buf: Buffer.from(ab) }))
            .catch(() => null)
        )
      }
    }

    const tilesRaw = await Promise.all(tilePromises)
    const tiles = tilesRaw.filter((t): t is { tx: number; ty: number; buf: Buffer } => t !== null)

    if (tiles.length === 0) {
      console.error('[utility-map] No tiles fetched')
      return null
    }

    // Sklej kafelki na canvas
    const canvasW = (tx1 - tx0 + 1) * 256
    const canvasH = (ty1 - ty0 + 1) * 256

    const composites = tiles.map(({ tx, ty, buf }) => ({
      input: buf,
      left: (tx - tx0) * 256,
      top: (ty - ty0) * 256,
    }))

    // Jasne tło CartoDB (białawo-szare) na wypadek brakujących kafelków
    const canvasBuf = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 246, g: 246, b: 244, alpha: 1 } },
    })
      .composite(composites)
      .png()
      .toBuffer()

    // Wyznacz współrzędne crop (NW corner i SE corner w przestrzeni canvas)
    const { px: cropX0, py: cropY0 } = lngLatToPixel(latMax, lngMin, ZOOM, tx0, ty0)
    const { px: cropX1, py: cropY1 } = lngLatToPixel(latMin, lngMax, ZOOM, tx0, ty0)
    const origW = cropX1 - cropX0
    const origH = cropY1 - cropY0

    // Crop do bbox i resize do 1200×750
    const baseBuf = await sharp(canvasBuf)
      .extract({
        left:   Math.max(0, Math.round(cropX0)),
        top:    Math.max(0, Math.round(cropY0)),
        width:  Math.max(Math.round(origW), 1),
        height: Math.max(Math.round(origH), 1),
      })
      .resize(W, H)
      .png()
      .toBuffer()

    // Pobierz GESUT overlay z SLD_BODY (kolorowe, grube linie)
    const sw = lngLatTo3857(latMin, lngMin)
    const ne = lngLatTo3857(latMax, lngMax)
    const bbox = `${sw.x.toFixed(0)},${sw.y.toFixed(0)},${ne.x.toFixed(0)},${ne.y.toFixed(0)}`
    const sldBody = buildSLD()

    const gesutUrl =
      `${GESUT_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&LAYERS=${GESUT_LAYERS}&STYLES=` +
      `&CRS=EPSG:3857&BBOX=${bbox}` +
      `&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE` +
      `&SLD_BODY=${encodeURIComponent(sldBody)}`

    let gesutBuf: Buffer | null = null
    try {
      const gesutResp = await fetch(gesutUrl, { signal: AbortSignal.timeout(12000) })
      const raw = Buffer.from(await gesutResp.arrayBuffer())
      // Sprawdź czy to PNG (nie błąd XML)
      if (raw[0] === 0x89 && raw[1] === 0x50) {
        gesutBuf = raw
        console.log(`[utility-map] GESUT SLD OK: ${raw.length} bytes`)
      } else {
        // Fallback bez SLD (oryginalny styl GESUT)
        const fallbackUrl =
          `${GESUT_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
          `&LAYERS=${GESUT_LAYERS}&STYLES=` +
          `&CRS=EPSG:3857&BBOX=${bbox}` +
          `&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE`
        const fallbackResp = await fetch(fallbackUrl, { signal: AbortSignal.timeout(10000) })
        const fallbackRaw = Buffer.from(await fallbackResp.arrayBuffer())
        if (fallbackRaw[0] === 0x89 && fallbackRaw[1] === 0x50) gesutBuf = fallbackRaw
      }
    } catch {
      // GESUT opcjonalne — mapa bez overlay też jest użyteczna
      console.warn('[utility-map] GESUT fetch failed')
    }

    // Pobierz warstwę katastralną KIEG (granice działek + budynki)
    let kiegBuf: Buffer | null = null
    try {
      const kiegUrl =
        `https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow` +
        `?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=Dzialki,Budynki&STYLES=` +
        `&CRS=EPSG:3857&BBOX=${bbox}` +
        `&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE`
      const kiegResp = await fetch(kiegUrl, { signal: AbortSignal.timeout(10000) })
      const kiegRaw = Buffer.from(await kiegResp.arrayBuffer())
      if (kiegRaw[0] === 0x89 && kiegRaw[1] === 0x50) {
        kiegBuf = kiegRaw
        console.log(`[utility-map] KIEG OK: ${kiegRaw.length} bytes`)
      } else {
        console.warn('[utility-map] KIEG returned non-PNG')
      }
    } catch {
      console.warn('[utility-map] KIEG fetch failed (optional)')
    }

    // ── Buduj listę composites ────────────────────────────────────────────────
    const compositeInputs: Parameters<ReturnType<typeof sharp>['composite']>[0] = []

    // 1. Warstwa katastralna KIEG (działki + budynki) — pod liniami GESUT
    if (kiegBuf) {
      compositeInputs.push({ input: kiegBuf, blend: 'over' })
    }

    // 2. GESUT overlay (linie mediów — na wierzchu działek)
    if (gesutBuf) {
      compositeInputs.push({ input: gesutBuf, blend: 'over' })
    }

    // 3. Granica wybranej działki (niebieski dashed polygon)
    if (geomWkt) {
      const polygon = parseWktToWgs84(geomWkt)
      const boundarySvg = buildParcelBoundarySvg(
        W, H, polygon, ZOOM, tx0, ty0, cropX0, cropY0, origW, origH
      )
      if (boundarySvg) {
        compositeInputs.push({ input: boundarySvg, blend: 'over' })
      }
    }

    // 4. Okrąg analizy 200m
    const circleSvg = buildAnalysisCircleSvg(
      W, H, lat, lng, ZOOM, tx0, ty0, cropX0, cropY0, origW, origH
    )
    compositeInputs.push({ input: circleSvg, blend: 'over' })

    // 5. Marker centralny (legenda jest w HTML raportu, nie w obrazku)
    compositeInputs.push({ input: buildMarkerSvg(W, H), blend: 'over' })

    return await sharp(baseBuf)
      .composite(compositeInputs)
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch (err) {
    console.error('[utility-map] Render error:', err)
    return null
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generuje mapę uzbrojenia terenu 1200×750 px dla podanych współrzędnych.
 *
 * @param lat       - szerokość geograficzna centrum (WGS84)
 * @param lng       - długość geograficzna centrum (WGS84)
 * @param geomWkt   - WKT polygon działki w EPSG:2180 (opcjonalnie — rysuje granicę)
 *
 * Zwraca CDN URL (Supabase Storage), base64 jako fallback, lub null przy błędzie.
 */
export async function generateUtilityMap(
  lat: number,
  lng: number,
  geomWkt?: string | null
): Promise<string | null> {
  const key = cacheKey(lat, lng)

  // 1. Cache hit → CDN URL natychmiast
  const cached = await checkCache(key)
  if (cached) {
    console.log('[utility-map] Cache hit:', key)
    return cached
  }

  // 2. Renderuj mapę
  const jpegBuf = await renderMap(lat, lng, geomWkt)
  if (!jpegBuf) return null

  // 3. Wgraj do Storage → CDN URL
  const cdnUrl = await uploadToStorage(key, jpegBuf)
  if (cdnUrl) return cdnUrl

  // 4. Ostatni fallback: base64
  console.warn('[utility-map] Storage upload failed, returning base64')
  return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
}
