/**
 * Utility map generator — Playwright + Leaflet → Supabase Storage cache
 *
 * Pipeline:
 *  1. Sprawdź bucket utility-maps w Supabase Storage (klucz ~100m siatka)
 *  2. Cache hit → zwróć publiczny CDN URL natychmiast
 *  3. Cache miss → headless Chromium renderuje Leaflet (OSM + GESUT WMS, zoom 17)
 *     → screenshot 1200×750 → JPEG 90% → upload do Storage → CDN URL
 *  4. Fallback: jeśli Playwright zawiedzie → stara metoda sharp (OSM tiles + GESUT WMS)
 *
 * Dane:
 *  - Base tiles:  OpenStreetMap (tile.openstreetmap.org)
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

async function getStorageClient() {
  const { createServiceClient } = await import('./supabase/server')
  return createServiceClient()
}

async function checkCache(key: string): Promise<string | null> {
  try {
    const supabase = await getStorageClient()
    const { data } = await (await supabase).storage
      .from(STORAGE_BUCKET)
      .list('', { search: key })

    if (data && data.length > 0) {
      const { data: urlData } = (await supabase).storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(key)
      return urlData?.publicUrl ?? null
    }
    return null
  } catch {
    return null
  }
}

async function uploadToStorage(key: string, jpegBuf: Buffer): Promise<string | null> {
  try {
    const supabase = await getStorageClient()
    const { error } = await (await supabase).storage
      .from(STORAGE_BUCKET)
      .upload(key, jpegBuf, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '604800', // 7 dni
      })

    if (error) {
      console.error('[utility-map] Storage upload error:', error.message)
      return null
    }

    const { data: urlData } = (await supabase).storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(key)

    return urlData?.publicUrl ?? null
  } catch (err) {
    console.error('[utility-map] Storage upload exception:', err)
    return null
  }
}

// ─── Playwright renderer ──────────────────────────────────────────────────────

function buildLeafletHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1200px; height: 750px; overflow: hidden; }
    #map { width: 1200px; height: 750px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: false
    }).setView([${lat}, ${lng}], 17);

    var osmLoaded = false;
    var gesutLoaded = false;

    function checkReady() {
      if (osmLoaded && gesutLoaded) {
        window.__mapReady = true;
      }
    }

    var osm = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: ''
    });
    osm.on('load', function() { osmLoaded = true; checkReady(); });
    osm.on('tileerror', function() { osmLoaded = true; checkReady(); });
    osm.addTo(map);

    var gesut = L.tileLayer.wms('${GESUT_WMS}', {
      layers: '${GESUT_LAYERS}',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 1.0,
      attribution: ''
    });
    gesut.on('load', function() { gesutLoaded = true; checkReady(); });
    gesut.on('tileerror', function() { gesutLoaded = true; checkReady(); });
    gesut.addTo(map);

    // Czerwony marker (krzyżyk + okrąg)
    L.circleMarker([${lat}, ${lng}], {
      radius: 10, color: '#dc2626', weight: 3, fill: false, opacity: 0.9
    }).addTo(map);

    var icon = L.divIcon({
      html: '<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="17" x2="32" y2="17" stroke="#dc2626" stroke-width="2.5"/><line x1="17" y1="2" x2="17" y2="32" stroke="#dc2626" stroke-width="2.5"/></svg>',
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);

    // Fallback timeout: jeśli po 4 s tiles nie załadowały
    setTimeout(function() { window.__mapReady = true; }, 4000);
  <\/script>
</body>
</html>`
}

async function renderWithPlaywright(lat: number, lng: number): Promise<Buffer | null> {
  try {
    // Dynamiczny import aby nie blokowało bundlera po stronie klienta
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: playwright } = await import('playwright')

    const browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 1200, height: 750 })
      await page.setContent(buildLeafletHtml(lat, lng), { timeout: 15000 })

      // Poczekaj aż mapa zasygnalizuje gotowość (tiles załadowane)
      await page.waitForFunction(() => (window as any).__mapReady === true, {
        timeout: 10000,
      })

      // Dodatkowe 800 ms na ostatnie kafelki
      await page.waitForTimeout(800)

      const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 750 } })
      return Buffer.from(screenshot)
    } finally {
      await browser.close()
    }
  } catch (err) {
    console.error('[utility-map] Playwright error:', err)
    return null
  }
}

// ─── Fallback: sharp tile-stitch (stara metoda) ───────────────────────────────

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

async function renderWithSharp(lat: number, lng: number): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default
    const W = 1200
    const H = 750
    const ZOOM = 17

    const degPerM_lat = 1 / 111320
    const degPerM_lng = 1 / (111320 * Math.cos(toRad(lat)))
    const padLat = 370 * degPerM_lat
    const padLng = 600 * degPerM_lng

    const latMin = lat - padLat
    const latMax = lat + padLat
    const lngMin = lng - padLng
    const lngMax = lng + padLng

    const tNW = lngLatToTile(latMax, lngMin, ZOOM)
    const tSE = lngLatToTile(latMin, lngMax, ZOOM)
    const tx0 = tNW.x, ty0 = tNW.y
    const tx1 = tSE.x, ty1 = tSE.y

    const tilePromises: Promise<{ tx: number; ty: number; buf: Buffer }>[] = []
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const subdomain = ['a','b','c','d'][(tx + ty) % 4]
        tilePromises.push(
          fetch(`https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${ZOOM}/${tx}/${ty}.png`, {
            headers: { 'User-Agent': 'SprawdzDzialke/1.0 (sprawdzdzialke.com)' },
            signal: AbortSignal.timeout(8000),
          })
            .then(r => r.arrayBuffer())
            .then(ab => ({ tx, ty, buf: Buffer.from(ab) }))
        )
      }
    }

    const tiles = await Promise.all(tilePromises)
    const canvasW = (tx1 - tx0 + 1) * 256
    const canvasH = (ty1 - ty0 + 1) * 256

    const composites = tiles.map(({ tx, ty, buf }) => ({
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

    const { px: cropX0, py: cropY0 } = lngLatToPixel(latMax, lngMin, ZOOM, tx0, ty0)
    const { px: cropX1, py: cropY1 } = lngLatToPixel(latMin, lngMax, ZOOM, tx0, ty0)

    const baseBuf = await sharp(canvasBuf)
      .extract({
        left: Math.round(cropX0),
        top: Math.round(cropY0),
        width: Math.max(Math.round(cropX1 - cropX0), 1),
        height: Math.max(Math.round(cropY1 - cropY0), 1),
      })
      .resize(W, H)
      .png()
      .toBuffer()

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
    const isValidPng = gesutBuf[0] === 0x89 && gesutBuf[1] === 0x50

    const compositeInputs: Parameters<ReturnType<typeof sharp>['composite']>[0] = []
    if (isValidPng) {
      compositeInputs.push({ input: gesutBuf, blend: 'over' })
    }

    const markerSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${W / 2}" cy="${H / 2}" r="12" fill="none" stroke="#dc2626" stroke-width="3"/>
      <line x1="${W/2 - 18}" y1="${H/2}" x2="${W/2 + 18}" y2="${H/2}" stroke="#dc2626" stroke-width="2.5"/>
      <line x1="${W/2}" y1="${H/2 - 18}" x2="${W/2}" y2="${H/2 + 18}" stroke="#dc2626" stroke-width="2.5"/>
    </svg>`
    compositeInputs.push({ input: Buffer.from(markerSvg), blend: 'over' })

    return await sharp(baseBuf)
      .composite(compositeInputs)
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch (err) {
    console.error('[utility-map] Sharp fallback error:', err)
    return null
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generuje mapę uzbrojenia terenu 1200×750 px dla podanych współrzędnych.
 *
 * Kolejność:
 *  1. Cache hit w Supabase Storage → zwraca CDN URL (bardzo szybko)
 *  2. Playwright + Leaflet → upload → CDN URL
 *  3. Fallback: sharp tile-stitch → upload → CDN URL lub base64
 *
 * Zwraca URL (HTTPS CDN lub data:) albo null przy całkowitym błędzie.
 */
export async function generateUtilityMap(
  lat: number,
  lng: number
): Promise<string | null> {
  const key = cacheKey(lat, lng)

  // 1. Sprawdź cache
  const cached = await checkCache(key)
  if (cached) {
    console.log('[utility-map] Cache hit:', key)
    return cached
  }

  // 2. Playwright render
  let jpegBuf: Buffer | null = await renderWithPlaywright(lat, lng)

  if (jpegBuf) {
    // Playwright zwraca PNG → konwertuj do JPEG 90%
    try {
      const sharp = (await import('sharp')).default
      jpegBuf = await sharp(jpegBuf).jpeg({ quality: 90 }).toBuffer()
    } catch {
      // zostawiamy PNG jeśli sharp zawiedzie
    }
  }

  // 3. Fallback: sharp tile-stitch
  if (!jpegBuf) {
    console.warn('[utility-map] Playwright failed, trying sharp fallback')
    jpegBuf = await renderWithSharp(lat, lng)
  }

  if (!jpegBuf) {
    console.error('[utility-map] Both renderers failed for', lat, lng)
    return null
  }

  // 4. Upload do Supabase Storage
  const cdnUrl = await uploadToStorage(key, jpegBuf)
  if (cdnUrl) {
    return cdnUrl
  }

  // 5. Ostatni fallback: base64 (nie cachowane)
  console.warn('[utility-map] Storage upload failed, returning base64')
  return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
}
