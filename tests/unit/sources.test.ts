import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseKimpzpHtml } from '@/lib/sources/kimpzp'
import { summarizeIsok } from '@/lib/sources/isok'
import { measure } from '@/lib/sources/gesut'
import { classifyWays } from '@/lib/sources/osm'
import { gfiUrl2180 } from '@/lib/sources/wms'
import { esriRingsToMultiPolygon } from '@/lib/sources/arcgis'
import { fromWgs84, toWgs84, type MultiPolygon } from '@/lib/geo'

const fx = (...p: string[]) => readFileSync(path.join(__dirname, '../fixtures', ...p), 'utf8')

describe('KIMPZP – parser odpowiedzi GetFeatureInfo', () => {
  it('Kraków (ArcGIS, przeznaczenie z symbolem)', () => {
    const r = parseKimpzpHtml(fx('kimpzp', 'krakow.html'))
    expect(r.status).toBe('ok')
    expect(r.plans).toHaveLength(1) // trzy warstwy skali z tym samym terenem → jeden wpis
    expect(r.plans[0]).toMatchObject({ symbol: 'KP.1', przeznaczenie: 'Tereny placów miejskich', tytul: 'STARE MIASTO', uchwala: 'XII/131/11' })
  })

  it('Długołęka/Kiełczów (GeoServer, dane aktu APP)', () => {
    const r = parseKimpzpHtml(fx('kimpzp', 'kielczow.html'))
    expect(r.status).toBe('ok')
    expect(r.plans[0].tytul).toMatch(/Kiełczów/)
    expect(r.plans[0].uchwala).toMatch(/XXXVIII\/664\/2006/)
    expect(r.plans[0].status).toMatch(/Prawnie wiążący/i)
  })

  it('Poznań (ArcGIS, dane aktu APP)', () => {
    const r = parseKimpzpHtml(fx('kimpzp', 'poznan.html'))
    expect(r.status).toBe('ok')
    expect(r.plans[0].tytul).toMatch(/Stare Miasto/)
  })

  it('„brak serwisu” → not_covered (gmina nie w integracji, NIE „brak planu”)', () => {
    expect(parseKimpzpHtml(fx('kimpzp', 'gdansk.html')).status).toBe('not_covered')
  })

  it('„brak wyniku” → no_data', () => {
    expect(parseKimpzpHtml(fx('kimpzp', 'batorz.html')).status).toBe('no_data')
    expect(parseKimpzpHtml(fx('kimpzp', 'wroclaw.html')).status).toBe('no_data')
  })
})

describe('ISOK – interpretacja stref', () => {
  const load = (n: string) => JSON.parse(fx('isok', `${n}.json`)).features

  it('Kozanów: Q1% i Q0,2% + budowla piętrząca → OSZP', () => {
    const r = summarizeIsok(load('kozanow'))
    expect(r.scenarios).toEqual(['Q1', 'Q0.2', 'BUDOWLA'])
    expect(r.oszp).toBe(true)
    expect(r.validTo).toBe('2025-12-21')
  })

  it('Kłodzko: Q10% z wysokim ryzykiem', () => {
    const r = summarizeIsok(load('klodzko'))
    expect(r.scenarios).toContain('Q10')
    expect(r.risk.some(x => x.scenario === 'Q10' && x.level === 'wysokie ryzyko')).toBe(true)
  })

  it('Lipa Piotrowska: tylko scenariusz przerwania wału (z kodu UWZ strefy ryzyka), nie OSZP', () => {
    const r = summarizeIsok(load('lipa'))
    expect(r.scenarios).toEqual(['WAL'])
    expect(r.oszp).toBe(false)
  })

  it('Rynek: brak stref', () => {
    expect(summarizeIsok(load('rynek')).scenarios).toEqual([])
  })
})

describe('WMS GetFeatureInfo w EPSG:2180', () => {
  it('BBOX w kolejności northing,easting', () => {
    const u = new URL(gfiUrl2180('https://x.test/wms', ['a'], [360000, 370000], 'text/html', { half: 5 }))
    expect(u.searchParams.get('BBOX')).toBe('369995,359995,370005,360005')
    expect(u.searchParams.get('CRS')).toBe('EPSG:2180')
  })
})

describe('ArcGIS – pierścienie Esri', () => {
  it('pierścień zgodny z ruchem wskazówek = zewnętrzny, przeciwny = dziura', () => {
    const outerCW = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]
    const holeCCW = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]
    const mp = esriRingsToMultiPolygon([outerCW, holeCCW])
    expect(mp).toHaveLength(1)
    expect(mp[0]).toHaveLength(2)
  })
})

describe('GESUT – odległość z pikseli', () => {
  const sq: MultiPolygon = [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]]
  it('brak pikseli → brak sieci w oknie', () => {
    expect(measure(sq, [])).toEqual({ distanceM: null, crosses: false })
  })
  it('piksel wewnątrz działki → przebiega przez działkę', () => {
    expect(measure(sq, [[5, 5], [30, 30]])).toEqual({ distanceM: 0, crosses: true })
  })
  it('najbliższy piksel decyduje o odległości', () => {
    expect(measure(sq, [[40, 5], [17, 5]]).distanceM).toBe(7)
  })
})

describe('OSM – klasyfikacja linii i odległości', () => {
  it('liczy odległość od granicy działki i odrzuca obiekty dalej niż promień', () => {
    const c = { lat: 51.1, lng: 17.0 }
    const [x, y] = fromWgs84(c)
    const parcel: MultiPolygon = [[[[x, y], [x + 20, y], [x + 20, y + 20], [x, y + 20], [x, y]]]]
    const at = (dx: number, dy: number) => { const p = toWgs84([x + dx, y + dy]); return { lat: p.lat, lon: p.lng } }
    const r = classifyWays([
      { tags: { power: 'line', voltage: '110000' }, geometry: [at(70, -50), at(70, 100)] },
      { tags: { man_made: 'pipeline', substance: 'gas' }, geometry: [at(-1000, 0), at(-1000, 20)] },
    ], parcel)
    expect(r.power).toHaveLength(1)
    expect(r.power[0].distanceM).toBe(50)
    expect(r.power[0].voltage).toBe('110000')
    expect(r.pipelines).toHaveLength(0)
  })
})
