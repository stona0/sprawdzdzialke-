/**
 * Utility map generator — CartoDB Voyager tiles + GESUT WMS → Supabase Storage cache
 *
 * Pipeline:
 *  1. Sprawdź bucket utility-maps w Supabase Storage (klucz ~100m siatka)
 *  2. Cache hit → zwróć publiczny CDN URL natychmiast
 *  3. Cache miss → sharp tile-stitch (CartoDB Voyager + GESUT WMS overlay, zoom 17, 1200×750)
 *     → upload do Storage → CDN URL
 *
 * CartoDB Voyager: jasne, czyste tło z wyraźnymi etykietami — linie GESUT dobrze widoczne.
 *
 * Dane:
 *  - Base tiles:  CartoDB Voyager (basemaps.cartocdn.com) — darmowe, bez klucza
 *  - Overlay:     GUGiK GESUT WMS (integracja02.gugik.gov.pl)
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

// ─── Cache helpers ────────────────────────────────────────────────────────────

/** Klucz cache: zaokrąglenie do 3 miejsc dziesiętnych ≈ siatka 100 m */
function cacheKey(lat: number, lng: number): string {
  const la = Math.round(lat * 1000) / 1000
  const lo = Math.round(lng * 1000) / 1000
  return `${la}_${lo}.jpg`
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

// ─── Renderer ─────────────────────────────────────────────────────────────────

async function renderMap(lat: number, lng: number): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default
    const W = 1200
    const H = 750
    const ZOOM = 17

    // Bbox ~600×400m wokół punktu
    const degPerM_lat = 1 / 111320
    const degPerM_lng = 1 / (111320 * Math.cos(toRad(lat)))
    const padLat = 370 * degPerM_lat
    const padLng = 600 * degPerM_lng

    const latMin = lat - padLat
    const latMax = lat + padLat
    const lngMin = lng - padLng
    const lngMax = lng + padLng

    // Tile range
    const tNW = lngLatToTile(latMax, lngMin, ZOOM)
    const tSE = lngLatToTile(latMin, lngMax, ZOOM)
    const tx0 = tNW.x, ty0 = tNW.y
    const tx1 = tSE.x, ty1 = tSE.y

    // Pobierz kafelki CartoDB Voyager równolegle
    const tilePromises: Promise<{ tx: number; ty: number; buf: Buffer } | null>[] = []
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const subdomain = ['a', 'b', 'c', 'd'][(tx + ty) % 4]
        tilePromises.push(
          fetch(
            `https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${ZOOM}/${tx}/${ty}.png`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 SprawdzDzialke/1.0 (sprawdzdzialke.com)',
                'Referer': 'https://sprawdzdzialke.com/',
              },
              signal: AbortSignal.timeout(8000),
            }
          )
            .then(r => r.arrayBuffer())
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

    // Sklej kafelki
    const canvasW = (tx1 - tx0 + 1) * 256
    const canvasH = (ty1 - ty0 + 1) * 256

    const composites = tiles.map(({ tx, ty, buf }) => ({
      input: buf,
      left: (tx - tx0) * 256,
      top: (ty - ty0) * 256,
    }))

    const canvasBuf = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 250, g: 250, b: 246, alpha: 1 } },
    })
      .composite(composites)
      .png()
      .toBuffer()

    // Crop do bbox i resize do 1200×750
    const { px: cropX0, py: cropY0 } = lngLatToPixel(latMax, lngMin, ZOOM, tx0, ty0)
    const { px: cropX1, py: cropY1 } = lngLatToPixel(latMin, lngMax, ZOOM, tx0, ty0)

    const baseBuf = await sharp(canvasBuf)
      .extract({
        left: Math.max(0, Math.round(cropX0)),
        top: Math.max(0, Math.round(cropY0)),
        width: Math.max(Math.round(cropX1 - cropX0), 1),
        height: Math.max(Math.round(cropY1 - cropY0), 1),
      })
      .resize(W, H)
      .png()
      .toBuffer()

    // Pobierz GESUT overlay (WMS GetMap, EPSG:3857)
    const sw = lngLatTo3857(latMin, lngMin)
    const ne = lngLatTo3857(latMax, lngMax)
    const bbox = `${sw.x.toFixed(0)},${sw.y.toFixed(0)},${ne.x.toFixed(0)},${ne.y.toFixed(0)}`

    const gesutUrl =
      `${GESUT_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&LAYERS=${GESUT_LAYERS}&STYLES=` +
      `&CRS=EPSG:3857&BBOX=${bbox}` +
      `&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE`

    let gesutBuf: Buffer | null = null
    try {
      const gesutResp = await fetch(gesutUrl, { signal: AbortSignal.timeout(10000) })
      const raw = Buffer.from(await gesutResp.arrayBuffer())
      // Sprawdź czy to PNG (nie błąd XML)
      if (raw[0] === 0x89 && raw[1] === 0x50) gesutBuf = raw
    } catch {
      // GESUT opcjonalne — bez overlay też jest sensowna mapa
    }

    // Composite: base + GESUT overlay + marker
    const compositeInputs: Parameters<ReturnType<typeof sharp>['composite']>[0] = []

    if (gesutBuf) {
      compositeInputs.push({ input: gesutBuf, blend: 'over' })
    }

    // Czerwony marker (okrąg + krzyżyk)
    const markerSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${W / 2}" cy="${H / 2}" r="12" fill="none" stroke="#dc2626" stroke-width="3" opacity="0.9"/>
      <line x1="${W/2 - 18}" y1="${H/2}" x2="${W/2 + 18}" y2="${H/2}" stroke="#dc2626" stroke-width="2.5" opacity="0.9"/>
      <line x1="${W/2}" y1="${H/2 - 18}" x2="${W/2}" y2="${H/2 + 18}" stroke="#dc2626" stroke-width="2.5" opacity="0.9"/>
    </svg>`
    compositeInputs.push({ input: Buffer.from(markerSvg), blend: 'over' })

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
 * Zwraca:
 *  - CDN URL (Supabase Storage) jeśli cache hit lub upload się udał
 *  - base64 data URL jako ostatni fallback
 *  - null przy całkowitym błędzie
 */
export async function generateUtilityMap(
  lat: number,
  lng: number
): Promise<string | null> {
  const key = cacheKey(lat, lng)

  // 1. Cache hit → CDN URL natychmiast
  const cached = await checkCache(key)
  if (cached) {
    console.log('[utility-map] Cache hit:', key)
    return cached
  }

  // 2. Renderuj mapę
  const jpegBuf = await renderMap(lat, lng)
  if (!jpegBuf) return null

  // 3. Wgraj do Storage → CDN URL
  const cdnUrl = await uploadToStorage(key, jpegBuf)
  if (cdnUrl) return cdnUrl

  // 4. Ostatni fallback: base64
  console.warn('[utility-map] Storage upload failed, returning base64')
  return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
}
