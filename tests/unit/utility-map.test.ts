/**
 * Mapa uzbrojenia: warstwa sieci z KIUT (src/lib/kiut-raster.ts → wektoryzacja src/lib/kiut-vector.ts, testy
 * w kiut-vector.test.ts → networkLines/networksSvg i widok przycięty do działki focusView w src/lib/utility-map.ts).
 * Fixture'y w tests/fixtures/kiut to prawdziwe odpowiedzi serwera (23.10.2026) dla tego samego obszaru
 * w 1200×750 (~1:2500) i 600×375 (~1:5000):
 *   • sobotka   — powiat wrocławski: w 1:5000 sieci bez opisów,
 *   • milicz    — powiat milicki: w 1:5000 pusto, w 1:2500 dziesiątki opisów „kd160”,
 *   • siechnice — mieszane: prąd tylko w 1:2500, reszta także w 1:5000.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { classifyPixels, components, isLabel, networkMasks, type Rgba, type Rgb } from '../../src/lib/kiut-raster'
import { focusView, NETWORK_STYLES, networkLines, networksSvg } from '../../src/lib/utility-map'

const FIX = path.join(__dirname, '../fixtures/kiut')
const PALETTE = NETWORK_STYLES.map(s => s.server)
const IDX = Object.fromEntries(NETWORK_STYLES.map((s, i) => [s.layer.replace('przewod_', ''), i])) as Record<string, number>

async function decode(file: string): Promise<Rgba> {
  const { data, info } = await sharp(path.join(FIX, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
const count = (m: Uint8Array) => m.reduce((n, v) => n + (v ? 1 : 0), 0)

/** Syntetyczny obraz w stylu KIUT: przezroczyste tło, piksele w kolorach serwera. */
function canvas(width: number, height: number) {
  const data = new Uint8Array(width * height * 4)
  const put = (x: number, y: number, [r, g, b]: Rgb, a = 255) => { const i = (y * width + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a }
  return { img: { data, width, height } as Rgba, put }
}

describe('klasyfikacja pikseli KIUT', () => {
  it('piksel wygładzonej krawędzi trafia do sieci po kolorze; czarny i prawie przezroczysty odpadają', () => {
    const { img, put } = canvas(5, 1)
    put(0, 0, [0xfb, 0x00, 0x00], 120) // półprzezroczysta krawędź linii energetycznej
    put(1, 0, [0x7b, 0x2f, 0x00], 200) // kanalizacja
    put(2, 0, [0xbd, 0xbd, 0x00], 90) // gaz
    put(3, 0, [0, 0, 0], 200) // czarny artefakt
    put(4, 0, [0x00, 0x00, 0xff], 30) // za mała alfa
    expect([...classifyPixels(img, PALETTE)]).toEqual([IDX.elektroenergetyczny, IDX.kanalizacyjny, IDX.gazowy, -1, -1])
  })
})

describe('opisy a linie', () => {
  const W = 200, H = 120
  const { img, put } = canvas(W, H)
  const blue = PALETTE[IDX.wodociagowy], brown = PALETTE[IDX.kanalizacyjny]
  for (let x = 10; x < 190; x++) put(x, 30, blue) // długa linia
  for (let x = 50; x <= 70; x++) put(x, 80, brown) // krótkie przyłącze w kształcie L
  for (let y = 80; y <= 95; y++) put(70, y, brown)
  for (let x = 120; x < 138; x++) for (let y = 60; y < 65; y++) if ((x + y) % 3) put(x, y, brown) // napis ~18×5 px
  put(150, 100, brown) // kropka
  for (let x = 0; x < 20; x++) put(x, 110, brown) // krótki odcinek urwany na krawędzi mapy
  const cls = classifyPixels(img, PALETTE)
  const labels = components(cls, W, H).filter(isLabel)

  it('usuwa napis i kropkę, zostawia linię, przyłącze w kształcie L i odcinek przy krawędzi', () => {
    expect(labels.map(c => c.span).sort((a, b) => a - b)).toEqual([1, 18])
    const { masks, source, labelPixels } = networkMasks(img, null, PALETTE)
    expect(source[IDX.wodociagowy]).toBe('full')
    expect(count(masks[IDX.wodociagowy])).toBe(180)
    expect(count(masks[IDX.kanalizacyjny])).toBe(21 + 15 + 20)
    expect(labelPixels).toBe(labels.reduce((n, c) => n + c.pixels.length, 0))
  })

  it('sieć narysowana w połowie rozdzielczości bierze geometrię stamtąd; brakująca wraca do pełnej', () => {
    const half = canvas(W / 2, H / 2)
    for (let x = 5; x < 95; x++) half.put(x, 15, blue) // ta sama linia wodociągu, bez opisów
    const { masks, source } = networkMasks(img, half.img, PALETTE)
    expect(source[IDX.wodociagowy]).toBe('half')
    expect(count(masks[IDX.wodociagowy])).toBe(90 * 4) // blok 2×2 na piksel
    expect(source[IDX.kanalizacyjny]).toBe('full') // w połowie rozdzielczości brak kanalizacji
    expect(source[IDX.gazowy]).toBeNull()
  })
})

describe('prawdziwe odpowiedzi KIUT', () => {
  it('Sobótka: wszystkie sieci z 1:5000 (bez opisów), żadnej sieci spoza danych serwera', async () => {
    const full = await decode('sobotka-1200.png')
    const { source, masks } = networkMasks(full, await decode('sobotka-600.png'), PALETTE)
    const raw = classifyPixels(full, PALETTE)
    for (let i = 0; i < PALETTE.length; i++) {
      const present = raw.some(c => c === i)
      expect(source[i], NETWORK_STYLES[i].label).toBe(present ? 'half' : null)
      if (!present) expect(count(masks[i])).toBe(0)
    }
    expect(raw.some(c => c === IDX.cieplowniczy)).toBe(false)
  })

  it('Milicz: w 1:5000 serwer nic nie rysuje → pełna rozdzielczość; opisy kanalizacji usunięte, linie gazu i ciepła zostają', async () => {
    const full = await decode('milicz-1200.png')
    const { source, masks } = networkMasks(full, await decode('milicz-600.png'), PALETTE)
    const raw = classifyPixels(full, PALETTE)
    const kept = (i: number) => {
      let n = 0, k = 0
      for (let p = 0; p < raw.length; p++) if (raw[p] === i) { n++; if (masks[i][p]) k++ }
      return k / n
    }
    expect(source[IDX.kanalizacyjny]).toBe('full')
    expect(kept(IDX.kanalizacyjny)).toBeLessThan(0.1) // ~49 tys. pikseli to niemal same napisy „kd160”
    expect(kept(IDX.gazowy)).toBeGreaterThan(0.95)
    expect(kept(IDX.cieplowniczy)).toBeGreaterThan(0.95)
  })

  describe('niekompletne odpowiedzi serwera (Sobótka, prawdziwe odpowiedzi bez sieci elektroenergetycznej)', () => {
    const POWER = IDX.elektroenergetyczny
    const load = () => Promise.all(['sobotka-1200.png', 'sobotka-1200-bez-pradu.png', 'sobotka-600.png', 'sobotka-600-bez-pradu.png'].map(decode))

    it('pełna rozdzielczość bez prądu → prąd z 1:5000', async () => {
      const [, full0, half] = await load()
      const r = networkMasks([full0], [half], PALETTE)
      expect(r.source[POWER]).toBe('half')
      expect(count(r.masks[POWER])).toBeGreaterThan(40_000)
    })

    it('1:5000 bez prądu → prąd z pełnej rozdzielczości', async () => {
      const [full, , , half0] = await load()
      const r = networkMasks([full], [half0], PALETTE)
      expect(r.source[POWER]).toBe('full')
      expect(count(r.masks[POWER])).toBeGreaterThan(20_000)
    })

    it('odpowiedzi tej samej rozdzielczości są łączone; różne → mapa niestabilna (bez cache), zgodne → stabilna', async () => {
      const [full, full0, half, half0] = await load()
      const mixed = networkMasks([full0, full], [half0, half], PALETTE)
      expect(count(mixed.masks[POWER])).toBeGreaterThan(40_000)
      expect(mixed.stable).toBe(false)
      expect(networkMasks([full, full], [half, half], PALETTE).stable).toBe(true)
      expect(networkMasks([full], [half], PALETTE).stable).toBe(false) // jedna odpowiedź = brak potwierdzenia
    })

    it('zgodnie puste odpowiedzi (awaria serwera powiatowego) nie są potwierdzeniem — mapa bez cache', () => {
      const empty = canvas(1200, 750).img, emptyHalf = canvas(600, 375).img
      const r = networkMasks([empty, empty], [emptyHalf, emptyHalf], PALETTE)
      expect(r.source.every(s => s === null)).toBe(true)
      expect(r.stable).toBe(false)
    })
  })

  it('Siechnice: każda sieć ze swojego źródła (prąd tylko w 1:2500)', async () => {
    const { source } = networkMasks(await decode('siechnice-1200.png'), await decode('siechnice-600.png'), PALETTE)
    expect(source[IDX.elektroenergetyczny]).toBe('full')
    expect([IDX.wodociagowy, IDX.kanalizacyjny, IDX.gazowy, IDX.telekomunikacyjny].map(i => source[i])).toEqual(['half', 'half', 'half', 'half'])
  })

  it('narysowane linie mają wyłącznie kolory legendy (bez fioletu „sieci ciepłowniczej” z mieszania kolorów)', async () => {
    const { networks } = await networkLines([readFileSync(path.join(FIX, 'sobotka-1200.png'))], [readFileSync(path.join(FIX, 'sobotka-600.png'))])
    const identity = { x: 0, y: 0, width: 1200, height: 750, zoom: 1 }
    const { data } = await sharp({ create: { width: 1200, height: 750, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: networksSvg(networks, identity, [], 0) }]).raw().toBuffer({ resolveWithObject: true })
    const legend = NETWORK_STYLES.map(s => [1, 3, 5].map(i => parseInt(s.color.slice(i, i + 2), 16)))
    const heat = legend[IDX.cieplowniczy]
    const W = 1200, H = 750
    // Odległość od odcinka biały–kolor legendy: krawędź linii na białej obwódce to rozjaśniony kolor tej samej sieci.
    const tintDistance = (c: number[], l: number[]) => {
      const d = l.map(v => v - 255), q = c.map(v => v - 255)
      const t = Math.max(0, Math.min(1, (q[0] * d[0] + q[1] * d[1] + q[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)))
      return Math.hypot(q[0] - t * d[0], q[1] - t * d[1], q[2] - t * d[2])
    }
    // 0 = brak linii, 1 = kolor legendy (także rozjaśniony na obwódce), 2 = kolor mieszany z dwóch sieci,
    // 3 = biała obwódka
    const kind = new Uint8Array(W * H)
    let heatLike = 0
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      if (data[i + 3] < 250) continue // krawędzie, obwódka i wyblakłe dalsze sieci są półprzezroczyste
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      if (r > 200 && g > 200 && b > 200) { kind[p] = 3; continue }
      kind[p] = Math.min(...legend.map(l => tintDistance([r, g, b], l))) > 40 ? 2 : 1
      if (Math.hypot(r - heat[0], g - heat[1], b - heat[2]) <= 40) heatLike++
    }
    const lines = kind.reduce((n, k) => n + (k === 1 || k === 2 ? 1 : 0), 0)
    // kolor spoza legendy tylko jako krawędź: każdy taki piksel sąsiaduje z linią w kolorze legendy albo z obwódką (żadnych plam)
    let blobs = 0
    for (let p = 0; p < W * H; p++) {
      if (kind[p] !== 2) continue
      const x = p % W, y = (p - x) / W
      let edge = false
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1 && !edge; dx++) {
        const nx = x + dx, ny = y + dy
        edge = nx >= 0 && ny >= 0 && nx < W && ny < H && (kind[ny * W + nx] === 1 || kind[ny * W + nx] === 3)
      }
      if (!edge) blobs++
    }
    expect(lines).toBeGreaterThan(50_000)
    expect(blobs).toBe(0)
    expect(heatLike).toBe(0)
  })

})

describe('widok przycięty do działki (focusView)', () => {
  const M_PER_PX = 840 / 1200
  const rect = (x0: number, y0: number, x1: number, y1: number) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]] as Array<Array<[number, number]>>

  it('mała działka → widok o minimalnej szerokości 420 m, wyśrodkowany, proporcje mapy', () => {
    const v = focusView(rect(580, 360, 620, 390), M_PER_PX)
    expect(v.width * M_PER_PX).toBeCloseTo(420, 0)
    expect(v.width / v.height).toBeCloseTo(1200 / 750, 5)
    expect(v.x + v.width / 2).toBeCloseTo(600, 0)
    expect(v.zoom).toBeCloseTo(2, 1)
  })

  it('margines co najmniej 120 m wokół działki', () => {
    const v = focusView(rect(400, 300, 800, 450), M_PER_PX)
    expect(v.x).toBeLessThanOrEqual(400 - 120 / M_PER_PX + 1e-6)
    expect(v.x + v.width).toBeGreaterThanOrEqual(800 + 120 / M_PER_PX - 1e-6)
  })

  it('duża działka → cały obszar geometrii, bez zbliżenia', () => {
    expect(focusView(rect(100, 100, 1100, 650), M_PER_PX)).toEqual({ x: 0, y: 0, width: 1200, height: 750, zoom: 1 })
  })

  it('działka przy krawędzi → widok nie wychodzi poza obszar geometrii', () => {
    const v = focusView(rect(5, 5, 40, 30), M_PER_PX)
    expect(v.x).toBe(0)
    expect(v.y).toBe(0)
  })

  it('bez geometrii działki → cały obszar', () => {
    expect(focusView([], M_PER_PX)).toEqual({ x: 0, y: 0, width: 1200, height: 750, zoom: 1 })
  })
})
