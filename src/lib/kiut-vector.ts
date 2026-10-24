/**
 * Maska sieci z KIUT (kiut-raster.ts) → polilinie do narysowania jako wektor.
 *
 * Pogrubianie rastra (rozmycie + próg) dawało „koraliki”, plamy i schodki: geometria z obrazu 600×375
 * była powiększana blokami 2×2, a każdy resztkowy piksel opisu puchł razem z linią. Tutaj linia ma
 * jedną szerokość niezależnie od jakości rastra:
 *   1. szkielet 1 px (Zhang–Suen),
 *   2. graf: końce, skrzyżowania (skupiska pikseli o ≥ 3 sąsiadach), łańcuchy między nimi,
 *   3. porządki: krótkie odgałęzienia (resztki opisów, kreski), kropki i krótkie samotne odcinki
 *      znikają, przerwy między końcami o zgodnym kierunku (linie przerywane) są mostkowane,
 *   4. łańcuchy przez węzły stopnia 2 są sklejane, wygładzane średnią ruchomą i upraszczane (Douglas–Peucker).
 * Współrzędne wyniku: siatka wyjściowa (pełna rozdzielczość), środek piksela maski × `scale`.
 */

export type Point = [number, number]
export interface Polyline {
  points: Point[]
  closed: boolean
}

export interface VectorizeOptions {
  /** Ile pikseli siatki wyjściowej przypada na piksel maski (2 dla obrazu w połowie rozdzielczości). */
  scale?: number
  /** Odgałęzienia krótsze (px siatki wyjściowej) wychodzące ze skrzyżowania są usuwane. */
  spur?: number
  /** Samotne odcinki krótsze (px siatki wyjściowej) są usuwane. */
  minIsolated?: number
  /** Największa mostkowana przerwa (px siatki wyjściowej). */
  gap?: number
  /** Tolerancja uproszczenia Douglas–Peucker (px siatki wyjściowej). */
  epsilon?: number
}

const N8: Array<[number, number]> = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

/** Szkielet 1 px (Zhang–Suen). Wejście: piksel ≠ 0 = linia. */
export function thin(mask: Uint8Array, width: number, height: number): Uint8Array {
  const img = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) img[i] = mask[i] ? 1 : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : img[y * width + x])
  const del: number[] = []
  let changed = true
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      del.length = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!img[y * width + x]) continue
          // P2..P9 zgodnie z ruchem wskazówek zegara od góry
          const p = N8.map(([dx, dy]) => at(x + dx, y + dy))
          const b = p.reduce((s, v) => s + v, 0)
          if (b < 2 || b > 6) continue
          let a = 0
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++
          if (a !== 1) continue
          if (step === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6] : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]) continue
          del.push(y * width + x)
        }
      }
      for (const i of del) img[i] = 0
      if (del.length) changed = true
    }
  }
  return img
}

function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1
        }
      }
    }
  }
  return out
}

interface Edge {
  a: number
  b: number
  path: number[]
  removed?: boolean
}

/** Polilinie z maski sieci (w pikselach siatki wyjściowej). */
export function vectorize(mask: Uint8Array, width: number, height: number, opts: VectorizeOptions = {}): Polyline[] {
  const scale = opts.scale ?? 1
  // progi podane w px siatki wyjściowej → piksele maski
  const spur = (opts.spur ?? 8) / scale
  const minIsolated = (opts.minIsolated ?? 8) / scale
  const gap = (opts.gap ?? 8) / scale
  const epsilon = (opts.epsilon ?? 0.8) / scale

  // Ukośna linia 1 px z wygładzonymi krawędziami ma w masce przerwy (piksele o małej alfie odpadają),
  // więc przed szkieletem domykamy je poszerzeniem o 1 px — szkielet i tak wraca do osi linii.
  const sk = thin(dilate(mask, width, height), width, height)
  const n = width * height
  const nbrs = (p: number): number[] => {
    const x = p % width, y = (p - x) / width
    const out: number[] = []
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && sk[ny * width + nx]) out.push(ny * width + nx)
    }
    return out
  }
  const deg = new Uint8Array(n)
  for (let p = 0; p < n; p++) if (sk[p]) deg[p] = nbrs(p).length

  // Węzły: końce (stopień 1) i skupiska pikseli o stopniu ≥ 3 (skrzyżowania i schodki szkieletu).
  const nodeOf = new Int32Array(n).fill(-1)
  const nodes: number[][] = []
  for (let p = 0; p < n; p++) {
    if (!sk[p] || deg[p] === 2 || deg[p] === 0 || nodeOf[p] >= 0) continue
    const id = nodes.length
    const px = [p]
    nodeOf[p] = id
    if (deg[p] >= 3) {
      for (let i = 0; i < px.length; i++) {
        for (const q of nbrs(px[i])) if (deg[q] >= 3 && nodeOf[q] < 0) { nodeOf[q] = id; px.push(q) }
      }
    }
    nodes.push(px)
  }

  // Krawędzie: łańcuchy pikseli stopnia 2 między węzłami.
  const edges: Edge[] = []
  const visited = new Uint8Array(n)
  const direct = new Set<number>()
  for (let id = 0; id < nodes.length; id++) {
    for (const q of nodes[id]) {
      for (const r of nbrs(q)) {
        if (nodeOf[r] === id) continue
        if (nodeOf[r] >= 0) {
          const key = Math.min(q, r) * n + Math.max(q, r)
          if (!direct.has(key)) { direct.add(key); edges.push({ a: id, b: nodeOf[r], path: [q, r] }) }
          continue
        }
        if (visited[r]) continue
        const path = [q, r]
        visited[r] = 1
        let prev = q, cur = r
        let end = -1
        for (;;) {
          const next = nbrs(cur).find(s => s !== prev)
          if (next === undefined) break
          if (nodeOf[next] >= 0) { path.push(next); end = nodeOf[next]; break }
          if (visited[next]) break
          visited[next] = 1
          path.push(next)
          prev = cur; cur = next
        }
        if (end >= 0) edges.push({ a: id, b: end, path })
      }
    }
  }
  // Pętle bez węzłów (zamknięte obwody).
  const loops: number[][] = []
  for (let p = 0; p < n; p++) {
    if (!sk[p] || deg[p] !== 2 || visited[p]) continue
    const path = [p]
    visited[p] = 1
    let prev = -1, cur = p
    for (;;) {
      const next = nbrs(cur).find(s => s !== prev && (!visited[s] || (s === p && path.length > 2)))
      if (next === undefined || next === p) break
      visited[next] = 1
      path.push(next)
      prev = cur; cur = next
    }
    if (path.length * 1 >= minIsolated) loops.push(path)
  }

  const xy = (p: number): Point => [p % width, Math.floor(p / width)]
  const centroid = (id: number): Point => {
    const px = nodes[id]
    let sx = 0, sy = 0
    for (const p of px) { const [x, y] = xy(p); sx += x; sy += y }
    return [sx / px.length, sy / px.length]
  }
  const length = (path: number[]) => {
    let s = 0
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = xy(path[i - 1]), [x1, y1] = xy(path[i])
      s += Math.hypot(x1 - x0, y1 - y0)
    }
    return s
  }
  const edgeDeg = () => {
    const d = new Int32Array(nodes.length)
    for (const e of edges) if (!e.removed) { d[e.a]++; d[e.b]++ }
    return d
  }

  // Odgałęzienia ze skrzyżowań (resztki opisów, kreski symboli) — kilka przebiegów, bo po usunięciu
  // jednego odgałęzienia skrzyżowanie może stać się zwykłym punktem linii.
  for (let pass = 0; pass < 3; pass++) {
    const d = edgeDeg()
    let removed = false
    for (const e of edges) {
      if (e.removed) continue
      // mała pętla przy skrzyżowaniu: „o” z opisu albo schodek szkieletu
      if (e.a === e.b) { if (length(e.path) < 2 * spur) { e.removed = true; removed = true } continue }
      const leaf = (d[e.a] === 1 && d[e.b] >= 3) || (d[e.b] === 1 && d[e.a] >= 3)
      if (leaf && length(e.path) < spur) { e.removed = true; removed = true }
    }
    if (!removed) break
  }
  // Mostkowanie przerw: dwa końce blisko siebie, skierowane ku sobie.
  {
    const d = edgeDeg()
    const ends: Array<{ node: number; at: Point; dir: Point; edge: Edge }> = []
    for (const e of edges) {
      if (e.removed) continue
      for (const [node, seq] of [[e.a, e.path], [e.b, [...e.path].reverse()]] as const) {
        if (d[node] !== 1) continue
        const tip = xy(seq[0]), back = xy(seq[Math.min(6, seq.length - 1)])
        const len = Math.hypot(tip[0] - back[0], tip[1] - back[1]) || 1
        ends.push({ node, at: tip, dir: [(tip[0] - back[0]) / len, (tip[1] - back[1]) / len], edge: e })
      }
    }
    const pairs: Array<{ i: number; j: number; dist: number }> = []
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        if (ends[i].edge === ends[j].edge) continue
        const vx = ends[j].at[0] - ends[i].at[0], vy = ends[j].at[1] - ends[i].at[1]
        const dist = Math.hypot(vx, vy)
        if (dist > gap) continue
        const ok = dist <= 2 || (
          (ends[i].dir[0] * vx + ends[i].dir[1] * vy) / dist >= 0.8 &&
          (-ends[j].dir[0] * vx - ends[j].dir[1] * vy) / dist >= 0.8
        )
        if (ok) pairs.push({ i, j, dist })
      }
    }
    pairs.sort((p, q) => p.dist - q.dist)
    const used = new Set<number>()
    for (const { i, j } of pairs) {
      if (used.has(i) || used.has(j)) continue
      used.add(i); used.add(j)
      edges.push({ a: ends[i].node, b: ends[j].node, path: [nodes[ends[i].node][0], nodes[ends[j].node][0]] })
    }
  }

  // Sklejanie łańcuchów przez węzły stopnia 2.
  const live = edges.filter(e => !e.removed)
  const d = edgeDeg()
  const incident: number[][] = nodes.map(() => [])
  live.forEach((e, k) => { incident[e.a].push(k); incident[e.b].push(k) })
  const usedEdge = new Uint8Array(live.length)
  const toPoints = (e: Edge, from: number): Point[] => {
    const seq = from === e.a ? e.path : [...e.path].reverse()
    const pts = seq.map(xy)
    // koniec w skupisku pikseli skrzyżowania → środek skupiska, żeby linie spotykały się w jednym punkcie
    const start = from, end = from === e.a ? e.b : e.a
    if (nodes[start].length > 1) pts[0] = centroid(start)
    if (nodes[end].length > 1) pts[pts.length - 1] = centroid(end)
    return pts
  }
  const chains: Polyline[] = []
  const walk = (startNode: number, k: number): Polyline => {
    const pts: Point[] = []
    let node = startNode, edge = k
    for (;;) {
      usedEdge[edge] = 1
      const e = live[edge]
      const seg = toPoints(e, node)
      pts.push(...(pts.length ? seg.slice(1) : seg))
      node = node === e.a ? e.b : e.a
      if (d[node] !== 2 || node === startNode) break
      const nextEdge = incident[node].find(x => !usedEdge[x])
      if (nextEdge === undefined) break
      edge = nextEdge
    }
    return { points: pts, closed: node === startNode && pts.length > 2 }
  }
  for (let id = 0; id < nodes.length; id++) {
    if (d[id] === 2) continue
    for (const k of incident[id]) if (!usedEdge[k]) chains.push(walk(id, k))
  }
  for (let k = 0; k < live.length; k++) if (!usedEdge[k]) chains.push(walk(live[k].a, k))
  for (const path of loops) chains.push({ points: path.map(xy), closed: true })

  // Samotne krótkie odcinki (kropki, kreski symboli, resztki opisów) — liczone po sklejeniu i mostkowaniu,
  // żeby nie usuwać kawałków linii przerywanej, zanim zostaną połączone.
  const polyLength = (pts: Point[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
  return chains
    .filter(c => polyLength(c.points) >= minIsolated)
    .map(c => ({ closed: c.closed, points: simplify(smooth(c.points, c.closed), epsilon, c.closed).map(([x, y]) => [(x + 0.5) * scale, (y + 0.5) * scale] as Point) }))
    .filter(c => c.points.length >= 2)
}

/** Średnia ruchoma (promień 2) — usuwa schodki rastra; końce otwartych linii zostają na miejscu. */
function smooth(pts: Point[], closed: boolean): Point[] {
  if (pts.length < 5) return pts
  const n = pts.length
  return pts.map((p, i) => {
    if (!closed && (i === 0 || i === n - 1)) return p
    let sx = 0, sy = 0, k = 0
    for (let j = i - 2; j <= i + 2; j++) {
      const q = closed ? pts[(j + n) % n] : pts[Math.max(0, Math.min(n - 1, j))]
      sx += q[0]; sy += q[1]; k++
    }
    return [sx / k, sy / k]
  })
}

/** Douglas–Peucker. */
export function simplify(pts: Point[], epsilon: number, closed = false): Point[] {
  if (pts.length <= 2) return pts
  if (closed) {
    // zamknięta linia: dzielimy w najdalszym punkcie od początku
    let far = 0, best = -1
    for (let i = 1; i < pts.length; i++) {
      const dd = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2
      if (dd > best) { best = dd; far = i }
    }
    const a = simplify(pts.slice(0, far + 1), epsilon)
    const b = simplify([...pts.slice(far), pts[0]], epsilon)
    return [...a, ...b.slice(1, -1)]
  }
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: Array<[number, number]> = [[0, pts.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    const [x0, y0] = pts[s], [x1, y1] = pts[e]
    const len = Math.hypot(x1 - x0, y1 - y0)
    let far = -1, best = epsilon
    for (let i = s + 1; i < e; i++) {
      const [x, y] = pts[i]
      const dist = len === 0 ? Math.hypot(x - x0, y - y0) : Math.abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / len
      if (dist > best) { best = dist; far = i }
    }
    if (far >= 0) { keep[far] = 1; stack.push([s, far], [far, e]) }
  }
  return pts.filter((_, i) => keep[i])
}
