import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import {
  area, centroid, distanceToLine, fromWgs84, interiorPoint, intersectionArea, parseWkt,
  pointInMultiPolygon, samplePoints, toWgs84, type MultiPolygon,
} from '@/lib/geo'
import { parseULDKResponse } from '@/lib/geoportal'

const FIX = path.join(__dirname, '../fixtures/uldk')
const metersBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180))

describe('EPSG:2180 → WGS84', () => {
  // Dla każdej działki porównujemy naszą transformację z geometrią, którą ULDK sam
  // zwraca w EPSG:4326 (srid=4326). Stara formuła myliła się o ~19–25 km.
  const ids = readdirSync(FIX).filter(f => f.endsWith('.2180.txt')).map(f => f.replace('.2180.txt', ''))

  it.each(ids)('%s: każdy wierzchołek zgodny z ULDK z dokładnością < 1 m', id => {
    const g2180 = parseWkt(readFileSync(path.join(FIX, `${id}.2180.txt`), 'utf8').split('\n')[1].split('|')[0])
    const g4326 = parseWkt(readFileSync(path.join(FIX, `${id}.4326.txt`), 'utf8').split('\n')[1])
    const ours = g2180[0][0].map(toWgs84)
    const ref = g4326[0][0].map(([lng, lat]) => ({ lat, lng }))
    expect(ours.length).toBe(ref.length)
    for (let i = 0; i < ours.length; i++) expect(metersBetween(ours[i], ref[i])).toBeLessThan(1)
  })

  it('transformacja odwrotna wraca do punktu wyjścia', () => {
    const p = { lat: 51.11, lng: 17.032 }
    const back = toWgs84(fromWgs84(p))
    expect(metersBetween(p, back)).toBeLessThan(0.01)
  })
})

describe('parseWkt', () => {
  it('POLYGON z dziurą', () => {
    const mp = parseWkt('SRID=2180;POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,4 2,4 4,2 4,2 2))')
    expect(mp).toHaveLength(1)
    expect(mp[0]).toHaveLength(2)
    expect(area(mp)).toBeCloseTo(96)
  })

  it('MULTIPOLYGON', () => {
    const mp = parseWkt('MULTIPOLYGON(((0 0,1 0,1 1,0 1,0 0)),((5 5,7 5,7 7,5 7,5 5)))')
    expect(mp).toHaveLength(2)
    expect(area(mp)).toBeCloseTo(5)
  })

  it('niepoprawny WKT → pusta geometria', () => {
    expect(parseWkt('LINESTRING(0 0,1 1)')).toEqual([])
  })
})

describe('punkt wewnętrzny', () => {
  // Litera „U”: centroid wypada w wycięciu, poza działką.
  const U: MultiPolygon = [[[[0, 0], [30, 0], [30, 30], [20, 30], [20, 10], [10, 10], [10, 30], [0, 30], [0, 0]]]]

  it('centroid działki w kształcie U leży poza nią', () => {
    expect(pointInMultiPolygon(centroid(U), U)).toBe(false)
  })

  it('interiorPoint zawsze leży wewnątrz', () => {
    expect(pointInMultiPolygon(interiorPoint(U), U)).toBe(true)
  })

  it('samplePoints zwraca tylko punkty wewnątrz', () => {
    const pts = samplePoints(U)
    expect(pts.length).toBeGreaterThan(1)
    for (const p of pts) expect(pointInMultiPolygon(p, U)).toBe(true)
  })
})

describe('intersectionArea / distanceToLine', () => {
  const sq: MultiPolygon = [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]]

  it('udział strefy w działce', () => {
    const half: MultiPolygon = [[[[5, -5], [20, -5], [20, 20], [5, 20], [5, -5]]]]
    expect(intersectionArea(sq, half)).toBeCloseTo(50)
  })

  it('odległość do linii obok działki', () => {
    expect(distanceToLine(sq, [[15, -5], [15, 20]])).toBeCloseTo(5)
  })

  it('linia przecinająca działkę → 0', () => {
    expect(distanceToLine(sq, [[-5, 5], [20, 5]])).toBe(0)
  })
})

describe('parseULDKResponse', () => {
  it('parsuje działkę i liczy punkt wewnątrz niej', () => {
    const txt = readFileSync(path.join(FIX, '026401_1_0054_888.2180.txt'), 'utf8')
    const p = parseULDKResponse(txt, '026401_1.0054.888', '')
    expect(p.found).toBe(true)
    expect(p.gmina).toMatch(/Wrocław/)
    expect(p.terc).toBe('026401')
    expect(p.teryt).toBe('026401_1')
    expect(p.powierzchnia).toBeGreaterThan(1000)
    expect(p.wspolrzedne!.lat).toBeGreaterThan(51.16)
    expect(p.wspolrzedne!.lat).toBeLessThan(51.18)
    expect(pointInMultiPolygon(fromWgs84(p.wspolrzedne!), p.geom!)).toBe(true)
  })

  it('„-1 brak wyników” → found=false (druga linia to komunikat, nie dane)', () => {
    const txt = readFileSync(path.join(FIX, 'notfound.txt'), 'utf8')
    expect(parseULDKResponse(txt, '999999_9.9999.1', 'X').found).toBe(false)
  })
})
