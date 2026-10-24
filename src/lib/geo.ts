import proj4 from 'proj4'
import polygonClipping from 'polygon-clipping'

// PUWG 1992 (EPSG:2180) — układ, w którym ULDK zwraca geometrie działek.
const EPSG_2180 =
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
const to4326 = proj4(EPSG_2180, 'EPSG:4326')

/** [x, y] — w EPSG:2180 to (easting, northing) w metrach. */
export type Pt = [number, number]
export type Ring = Pt[]
/** Pierścień zewnętrzny + ewentualne dziury. */
export type Polygon = Ring[]
export type MultiPolygon = Polygon[]

export interface LatLng {
  lat: number
  lng: number
}

export function toWgs84([x, y]: Pt): LatLng {
  const [lng, lat] = to4326.forward([x, y])
  return { lat, lng }
}

export function fromWgs84({ lat, lng }: LatLng): Pt {
  const [x, y] = to4326.inverse([lng, lat])
  return [x, y]
}

// ─── WKT ──────────────────────────────────────────────────────────────────────

type Nested = string | Nested[]

function parseNested(s: string, pos: { i: number }): Nested[] {
  const out: Nested[] = []
  let token = ''
  while (pos.i < s.length) {
    const ch = s[pos.i++]
    if (ch === '(') {
      out.push(parseNested(s, pos))
    } else if (ch === ')') {
      if (token.trim()) out.push(token.trim())
      return out
    } else if (ch === ',') {
      if (token.trim()) out.push(token.trim())
      token = ''
    } else {
      token += ch
    }
  }
  if (token.trim()) out.push(token.trim())
  return out
}

function toRing(coords: Nested[]): Ring {
  return coords.map(c => {
    const [x, y] = String(c).split(/\s+/).map(Number)
    return [x, y] as Pt
  })
}

/** Parsuje POLYGON / MULTIPOLYGON (opcjonalnie z prefiksem SRID=...;). */
export function parseWkt(wkt: string): MultiPolygon {
  const body = wkt.replace(/^SRID=\d+;/i, '').trim()
  const m = body.match(/^(MULTIPOLYGON|POLYGON)\s*(\([\s\S]*\))\s*$/i)
  if (!m) return []
  const tree = parseNested(m[2], { i: 1 })
  if (m[1].toUpperCase() === 'POLYGON') {
    return [tree.map(r => toRing(r as Nested[]))]
  }
  return tree.map(poly => (poly as Nested[]).map(r => toRing(r as Nested[])))
}

// ─── Pomiary ──────────────────────────────────────────────────────────────────

function signedRingArea(ring: Ring): number {
  let a = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

export function polygonArea(poly: Polygon): number {
  if (!poly.length) return 0
  const [outer, ...holes] = poly
  return Math.abs(signedRingArea(outer)) - holes.reduce((s, h) => s + Math.abs(signedRingArea(h)), 0)
}

export function area(mp: MultiPolygon): number {
  return mp.reduce((s, p) => s + polygonArea(p), 0)
}

function ringCentroid(ring: Ring): { c: Pt; a: number } {
  let cx = 0, cy = 0
  const a = signedRingArea(ring)
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    const f = x1 * y2 - x2 * y1
    cx += (x1 + x2) * f
    cy += (y1 + y2) * f
  }
  return a === 0 ? { c: ring[0], a: 0 } : { c: [cx / (6 * a), cy / (6 * a)], a }
}

/** Środek ciężkości (ważony polem; dziury odejmowane). */
export function centroid(mp: MultiPolygon): Pt {
  let sx = 0, sy = 0, sa = 0
  for (const poly of mp) {
    poly.forEach((ring, idx) => {
      const { c, a } = ringCentroid(ring)
      const w = idx === 0 ? Math.abs(a) : -Math.abs(a)
      sx += c[0] * w
      sy += c[1] * w
      sa += w
    })
  }
  if (sa === 0) return mp[0]?.[0]?.[0] ?? [0, 0]
  return [sx / sa, sy / sa]
}

function pointInRing([x, y]: Pt, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function pointInMultiPolygon(pt: Pt, mp: MultiPolygon): boolean {
  return mp.some(([outer, ...holes]) => pointInRing(pt, outer) && !holes.some(h => pointInRing(pt, h)))
}

export function bbox(mp: MultiPolygon): [number, number, number, number] {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    if (x < minx) minx = x
    if (y < miny) miny = y
    if (x > maxx) maxx = x
    if (y > maxy) maxy = y
  }
  return [minx, miny, maxx, maxy]
}

/**
 * Punkt na pewno leżący wewnątrz działki. Centroid działki w kształcie litery L
 * albo podkowy potrafi wypaść poza nią — wtedy zapytanie o strefę dotyczyłoby sąsiada.
 */
export function interiorPoint(mp: MultiPolygon): Pt {
  const c = centroid(mp)
  if (pointInMultiPolygon(c, mp)) return c
  const largest = [...mp].sort((a, b) => polygonArea(b) - polygonArea(a))[0]
  const [minx, miny, maxx, maxy] = bbox([largest])
  let best: { p: Pt; w: number } | null = null
  for (let k = 1; k < 20; k++) {
    const y = miny + ((maxy - miny) * k) / 20
    const xs: number[] = []
    for (const ring of largest) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
      }
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i]
      if (!best || w > best.w) best = { p: [(xs[i] + xs[i + 1]) / 2, y], w }
    }
  }
  return best?.p ?? [(minx + maxx) / 2, (miny + maxy) / 2]
}

/** Kilka punktów rozłożonych wewnątrz działki (do usług WMS, które odpowiadają tylko dla punktu). */
export function samplePoints(mp: MultiPolygon, max = 9): Pt[] {
  const pts: Pt[] = [interiorPoint(mp)]
  const [minx, miny, maxx, maxy] = bbox(mp)
  const n = 4
  for (let i = 1; i < n && pts.length < max; i++) {
    for (let j = 1; j < n && pts.length < max; j++) {
      const p: Pt = [minx + ((maxx - minx) * i) / n, miny + ((maxy - miny) * j) / n]
      if (pointInMultiPolygon(p, mp)) pts.push(p)
    }
  }
  return pts
}

export function intersectionArea(a: MultiPolygon, b: MultiPolygon): number {
  if (!a.length || !b.length) return 0
  const res = polygonClipping.intersection(a, b)
  return area(res as MultiPolygon)
}

function distPointSegment([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)
}

/** Odległość (m, EPSG:2180) od granicy działki do linii; 0 gdy linia przecina działkę lub leży w niej. */
export function distanceToLine(mp: MultiPolygon, line: Pt[]): number {
  if (line.some(p => pointInMultiPolygon(p, mp))) return 0
  let best = Infinity
  for (const poly of mp) for (const ring of poly) {
    for (let i = 0; i + 1 < ring.length; i++) {
      for (let j = 0; j + 1 < line.length; j++) {
        if (segmentsIntersect(ring[i], ring[i + 1], line[j], line[j + 1])) return 0
        best = Math.min(
          best,
          distPointSegment(ring[i], line[j], line[j + 1]),
          distPointSegment(line[j], ring[i], ring[i + 1]),
        )
      }
      if (line.length === 1) best = Math.min(best, distPointSegment(line[0], ring[i], ring[i + 1]))
    }
  }
  return best
}

export function toWktPolygon2180(mp: MultiPolygon): string {
  const ring = (r: Ring) => `(${r.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(',')})`
  if (mp.length === 1) return `POLYGON(${mp[0].map(ring).join(',')})`
  return `MULTIPOLYGON(${mp.map(p => `(${p.map(ring).join(',')})`).join(',')})`
}
