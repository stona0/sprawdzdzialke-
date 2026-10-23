/**
 * Warstwa sieci z Krajowej Integracji Uzbrojenia Terenu jako raster → maski linii do narysowania.
 *
 * Serwer KIUT ignoruje SLD: rysuje sieci liniami 1 px (z wygładzaniem krawędzi) i dokłada opisy
 * średnic („kd160”, „wo32”) oraz kreski w kolorze sieci. Dlatego:
 *   1. każdy piksel przypisujemy do jednej sieci po kolorze serwera (reszta odpada),
 *   2. geometrię sieci bierzemy z obrazu w połowie rozdzielczości (~1:5000), w którym serwery
 *      powiatowe pomijają opisy — o ile dana sieć jest tam narysowana (część powiatów, np. milicki
 *      i kłodzki, w tej skali nie rysuje sieci wcale),
 *   3. w przeciwnym razie bierzemy pełną rozdzielczość i usuwamy opisy po kształcie: odizolowany
 *      napis jest krótki, gruby w poprzek osi i gęsto wypełniony; linia jest cienka albo rozgałęziona.
 * Serwer bywa niekompletny: przy identycznych zapytaniach sieć wraca w różnych wersjach (Sobótka, prąd
 * w 10 odpowiedziach 1200 px: 29 123 / 8 686 / 0 pikseli; kompletna tylko w 4). Dlatego każdą
 * rozdzielczość pobieramy dwukrotnie i łączymy, a wynik oznaczamy jako niestabilny, gdy odpowiedzi się różnią.
 * Zmierzone 23.10.2026 na działkach z 6 powiatów (wrocławski, lubelski, milicki, kłodzki, sieradzki, Radom).
 */

export interface Rgba {
  data: Uint8Array
  width: number
  height: number
}

export type Rgb = readonly [number, number, number]

/** Piksele bardziej przezroczyste to resztki wygładzania krawędzi. */
const MIN_ALPHA = 48
/** Maksymalna odległość koloru od koloru serwera (RGB); dalej = piksel spoza sieci (np. czarny). */
const MAX_COLOR_DIST = 90

/** Indeks sieci z `palette` dla każdego piksela, -1 = brak sieci. */
export function classifyPixels(img: Rgba, palette: readonly Rgb[]): Int8Array {
  const n = img.width * img.height
  const out = new Int8Array(n).fill(-1)
  const d = img.data
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    if (d[i + 3] < MIN_ALPHA) continue
    let best = -1
    let bestDist = MAX_COLOR_DIST * MAX_COLOR_DIST
    for (let c = 0; c < palette.length; c++) {
      const [r, g, b] = palette[c]
      const dist = (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2
      if (dist < bestDist) { bestDist = dist; best = c }
    }
    out[p] = best
  }
  return out
}

export interface Component {
  network: number
  pixels: Int32Array
  /** Dłuższy bok prostokąta otaczającego (px). */
  span: number
  /** Odchylenie standardowe w poprzek osi głównej (px): linia ~0,5, napis ≥ 1. */
  minorStd: number
  /** Rozpiętość w poprzek osi głównej (px). */
  minorExt: number
  /** Wypełnienie prostokąta zorientowanego wzdłuż osi głównej. */
  fill: number
  touchesEdge: boolean
}

/** Składowe spójne (sąsiedztwo 8) pikseli tej samej sieci. */
export function components(cls: Int8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(cls.length)
  const out: Component[] = []
  const stack: number[] = []
  const buf: number[] = []
  for (let s = 0; s < cls.length; s++) {
    if (cls[s] < 0 || seen[s]) continue
    const net = cls[s]
    buf.length = 0
    stack.push(s)
    seen[s] = 1
    let x0 = width, x1 = 0, y0 = height, y1 = 0, mx = 0, my = 0
    while (stack.length) {
      const p = stack.pop()!
      buf.push(p)
      const x = p % width, y = (p - x) / width
      mx += x; my += y
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (!seen[q] && cls[q] === net) { seen[q] = 1; stack.push(q) }
        }
      }
    }
    const n = buf.length
    mx /= n; my /= n
    let sxx = 0, syy = 0, sxy = 0
    for (const p of buf) {
      const dx = (p % width) - mx, dy = Math.floor(p / width) - my
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy
    }
    sxx /= n; syy /= n; sxy /= n
    const half = (sxx + syy) / 2
    const minorVar = Math.max(0, half - Math.sqrt(Math.max(0, half * half - (sxx * syy - sxy * sxy))))
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const ux = Math.cos(ang), uy = Math.sin(ang)
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (const p of buf) {
      const dx = (p % width) - mx, dy = Math.floor(p / width) - my
      const a = dx * ux + dy * uy, b = dy * ux - dx * uy
      if (a < a0) a0 = a
      if (a > a1) a1 = a
      if (b < b0) b0 = b
      if (b > b1) b1 = b
    }
    const majorExt = a1 - a0 + 1, minorExt = b1 - b0 + 1
    out.push({
      network: net,
      pixels: Int32Array.from(buf),
      span: Math.max(x1 - x0, y1 - y0) + 1,
      minorStd: Math.sqrt(minorVar),
      minorExt,
      fill: n / (majorExt * minorExt),
      touchesEdge: x0 === 0 || y0 === 0 || x1 === width - 1 || y1 === height - 1,
    })
  }
  return out
}

/** Opis, kropka albo symbol urządzenia, a nie odcinek sieci. Składowe przy krawędzi mapy zostają (urwane linie). */
export function isLabel(c: Component): boolean {
  if (c.touchesEdge) return false
  if (c.span <= 6) return true
  // skupisko nachodzących na siebie opisów: szerokie i gęste
  if (c.span <= 96 && c.minorExt >= 8 && c.fill >= 0.3) return true
  if (c.span > 48 || c.minorExt < 4) return false
  return (c.minorStd >= 0.95 && c.fill >= 0.35) || (c.minorStd >= 1.15 && c.fill >= 0.2)
}

export interface NetworkMasks {
  /** Maska 0/255 na siatce pełnej rozdzielczości, jedna na sieć z palety. */
  masks: Uint8Array[]
  /** Skąd wzięto geometrię sieci: 'half' (bez opisów), 'full' (opisy odfiltrowane), null (brak sieci). */
  source: Array<'half' | 'full' | null>
  /** Pikseli usuniętych jako opisy w ścieżce pełnej rozdzielczości. */
  labelPixels: number
  /** W każdej rozdzielczości są co najmniej dwie odpowiedzi i zgadzają się co do każdej sieci (±10% pikseli). */
  stable: boolean
}

/** Udział pikseli, o który mogą się różnić dwie kompletne odpowiedzi (drobne różnice wygładzania). */
const STABLE_TOLERANCE = 0.1

/** Połączenie odpowiedzi: piksel należy do sieci, jeśli którakolwiek odpowiedź go narysowała. */
function union(responses: Rgba[], palette: readonly Rgb[]): { cls: Int8Array; agree: boolean } {
  const per = responses.map(r => classifyPixels(r, palette))
  const cls = new Int8Array(per[0])
  for (const other of per.slice(1)) for (let p = 0; p < cls.length; p++) if (cls[p] < 0) cls[p] = other[p]
  let agree = per.length >= 2
  for (let c = 0; c < palette.length && agree; c++) {
    const counts = per.map(x => x.reduce((k, v) => k + (v === c ? 1 : 0), 0))
    const hi = Math.max(...counts)
    if (hi - Math.min(...counts) > STABLE_TOLERANCE * hi) agree = false
  }
  return { cls, agree }
}

const asList = (x: Rgba | Rgba[] | null): Rgba[] => (x === null ? [] : Array.isArray(x) ? x : [x])

/**
 * Maski sieci. `fulls` — jedna lub więcej odpowiedzi w pełnej rozdzielczości, `halves` — ten sam obszar
 * w połowie rozdzielczości (może być pusto). Odpowiedzi tej samej rozdzielczości są łączone. Sieć bierze
 * geometrię z połowy rozdzielczości, jeśli jest tam narysowana w ilości kompletnej odpowiedzi.
 */
export function networkMasks(fulls: Rgba | Rgba[], halves: Rgba | Rgba[] | null, palette: readonly Rgb[]): NetworkMasks {
  const fullList = asList(fulls), halfList = asList(halves)
  const { width, height } = fullList[0]
  const n = width * height
  const fullUnion = union(fullList, palette)
  const fullCls = fullUnion.cls
  const halfUnion = halfList.length ? union(halfList, palette) : null
  const stable = fullUnion.agree && (halfUnion?.agree ?? false)
  const half = halfList[0] ?? null
  const cleaned = new Int8Array(fullCls)
  let labelPixels = 0
  for (const c of components(fullCls, width, height)) {
    if (!isLabel(c)) continue
    for (const p of c.pixels) cleaned[p] = -1
    labelPixels += c.pixels.length
  }

  let halfOnFull: Int8Array | null = null
  if (half && halfUnion) {
    const halfCls = halfUnion.cls
    halfOnFull = new Int8Array(n)
    for (let y = 0; y < height; y++) {
      const hy = Math.min(half.height - 1, Math.floor((y * half.height) / height))
      for (let x = 0; x < width; x++) {
        const hx = Math.min(half.width - 1, Math.floor((x * half.width) / width))
        halfOnFull[y * width + x] = halfCls[hy * half.width + hx]
      }
    }
  }

  const masks: Uint8Array[] = []
  const source: NetworkMasks['source'] = []
  for (let c = 0; c < palette.length; c++) {
    let nFull = 0, nHalf = 0
    for (let p = 0; p < n; p++) {
      if (fullCls[p] === c) nFull++
      if (halfOnFull && halfOnFull[p] === c) nHalf++
    }
    // Linia z obrazu w połowie rozdzielczości zajmuje na siatce pełnej tyle pikseli co w pełnej rozdzielczości
    // razy ~0,9–1,6 (blok 2×2 zamiast wygładzonej linii; pełna ma jeszcze opisy). Mniej = sieci tam nie ma
    // (powiat nie rysuje jej w 1:5000) albo odpowiedź była niekompletna — wtedy pełna rozdzielczość.
    const useHalf = halfOnFull !== null && nHalf > 0 && nHalf >= 0.75 * nFull
    const pick = useHalf ? halfOnFull! : cleaned
    const mask = new Uint8Array(n)
    let any = false
    for (let p = 0; p < n; p++) if (pick[p] === c) { mask[p] = 255; any = true }
    masks.push(mask)
    source.push(any ? (useHalf ? 'half' : 'full') : null)
  }
  return { masks, source, labelPixels, stable }
}
