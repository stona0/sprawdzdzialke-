/**
 * Wektoryzacja masek sieci KIUT (src/lib/kiut-vector.ts): szkielet → polilinie bez schodków, koralików
 * i resztek opisów. Syntetyczne maski oraz prawdziwe odpowiedzi serwera z tests/fixtures/kiut (opis w utility-map.test.ts).
 */
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { networkMasks, type Rgba } from '../../src/lib/kiut-raster'
import { vectorize, type Polyline } from '../../src/lib/kiut-vector'
import { NETWORK_STYLES } from '../../src/lib/utility-map'

const FIX = path.join(__dirname, '../fixtures/kiut')
const PALETTE = NETWORK_STYLES.map(s => s.server)

async function decode(file: string): Promise<Rgba> {
  const { data, info } = await sharp(path.join(FIX, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
const count = (m: Uint8Array) => m.reduce((n, v) => n + (v ? 1 : 0), 0)

describe('wektoryzacja masek (kiut-vector)', () => {
  const W = 120, H = 80
  const mask = () => new Uint8Array(W * H)
  const set = (m: Uint8Array, x: number, y: number) => { m[y * W + x] = 255 }
  const span = (p: Polyline) => {
    const xs = p.points.map(q => q[0]), ys = p.points.map(q => q[1])
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  }

  it('prosta linia (także 2 px grubości) → jedna polilinia z dwoma punktami', () => {
    const m = mask()
    for (let x = 10; x < 110; x++) { set(m, x, 40); set(m, x, 41) }
    const polys = vectorize(m, W, H)
    expect(polys).toHaveLength(1)
    expect(polys[0].points).toHaveLength(2)
    const [x0, x1, y0, y1] = span(polys[0])
    expect(x0).toBeLessThan(13)
    expect(x1).toBeGreaterThan(107)
    expect(y1 - y0).toBeLessThan(1.5)
  })

  it('kształt L → jedna polilinia z narożnikiem', () => {
    const m = mask()
    for (let x = 10; x <= 80; x++) set(m, x, 20)
    for (let y = 20; y <= 70; y++) set(m, 80, y)
    const polys = vectorize(m, W, H)
    expect(polys).toHaveLength(1)
    const corner = polys[0].points.some(([x, y]) => Math.hypot(x - 80.5, y - 20.5) < 3)
    expect(corner).toBe(true)
  })

  it('linia przerywana (kreski 5 px, przerwy 3 px) → jedna ciągła polilinia', () => {
    const m = mask()
    for (let x = 10; x < 110; x++) if ((x - 10) % 8 < 5) set(m, x, 40)
    const polys = vectorize(m, W, H)
    expect(polys).toHaveLength(1)
    const [x0, x1] = span(polys[0])
    expect(x1 - x0).toBeGreaterThan(90)
  })

  it('krótkie odgałęzienie (resztka opisu) znika, linia zostaje jedna', () => {
    const m = mask()
    for (let x = 10; x < 110; x++) set(m, x, 40)
    for (let y = 36; y < 40; y++) set(m, 60, y)
    const polys = vectorize(m, W, H)
    expect(polys).toHaveLength(1)
    const [, , y0] = span(polys[0])
    expect(y0).toBeGreaterThan(39)
  })

  it('kropka i krótka kreska bez połączenia znikają', () => {
    const m = mask()
    set(m, 30, 30); set(m, 31, 30); set(m, 30, 31); set(m, 31, 31)
    for (let x = 60; x < 64; x++) set(m, x, 60)
    expect(vectorize(m, W, H)).toHaveLength(0)
  })

  it('maska w połowie rozdzielczości → współrzędne na siatce pełnej (× 2)', () => {
    const m = mask()
    for (let x = 10; x < 110; x++) set(m, x, 40)
    const [x0, x1, y0] = span(vectorize(m, W, H, { scale: 2 })[0])
    expect(x0).toBeLessThan(26)
    expect(x1).toBeGreaterThan(214)
    expect(Math.abs(y0 - 81)).toBeLessThan(1.5)
  })
})

/** Wektor wierny danym serwera: ile pikseli sieci leży ≤ 3 px od narysowanej osi, ile osi leży > 3 px od danych. */
async function fidelity(polys: Polyline[], serverMask: Uint8Array) {
  const W = 1200, H = 750
  const d = polys.map(p => 'M' + p.points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')).join('')
  const drawn = await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`)).extractChannel(3).raw().toBuffer()
  const near = (m: { [i: number]: number }, test: (v: number) => boolean) => {
    const out = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!test(m[y * W + x])) continue
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out[ny * W + nx] = 1
      }
    }
    return out
  }
  const drawnNear = near(drawn, v => v > 64), serverNear = near(serverMask, v => v > 0)
  let server = 0, covered = 0, axis = 0, off = 0
  for (let p = 0; p < W * H; p++) {
    if (serverMask[p]) { server++; if (drawnNear[p]) covered++ }
    if (drawn[p] > 64) { axis++; if (!serverNear[p]) off++ }
  }
  return { coverage: covered / server, offData: off / axis }
}

describe('prawdziwe odpowiedzi KIUT', () => {
  // Pokrycie < 100%: równoległe przewody w jednej ulicy (1–2 px od siebie) stają się jedną osią, a krótkie
  // odgałęzienia (resztki opisów, kreski symboli) znikają. „Poza danymi” mierzy, czy wektor nie dorysowuje sieci.
  it.each([
    ['sobotka', 0.8],
    ['siechnice', 0.75],
    ['milicz', 0.65], // kanalizacja to w większości opisy „kd160” sklejone z linią — odgałęzienia znikają
  ])('%s: wektor pokrywa linie serwera i nie dorysowuje sieci, których nie ma', async (slug, minCoverage) => {
    const nm = networkMasks(await decode(`${slug}-1200.png`), await decode(`${slug}-600.png`), PALETTE)
    for (let i = 0; i < PALETTE.length; i++) {
      const m = nm.native[i]
      if (!m || count(nm.masks[i]) < 2000) continue
      const { coverage, offData } = await fidelity(vectorize(m.mask, m.width, m.height, { scale: m.scale }), nm.masks[i])
      expect(coverage, `${NETWORK_STYLES[i].label} pokrycie`).toBeGreaterThan(minCoverage)
      expect(offData, `${NETWORK_STYLES[i].label} poza danymi`).toBeLessThan(0.01)
    }
  })
})
