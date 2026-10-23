/**
 * Linie napowietrzne i rurociągi z BDOT10k: parser paczek, kafle, odległości od działki,
 * reguły ustaleń. Fixture'y: fragmenty prawdziwych plików OT_SULN_L (powiat wrocławski)
 * i OT_SUPR_L (Kraków), kafel 33_33 z ETL i działka 022307_4.0003.541 (Sobótka) pod linią 110 kV.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseULDKResponse } from '@/lib/geoportal'
import { clearCache } from '@/lib/http'
import { addToTiles, parseBdotXml, tilesForBbox, type PowerTile, type TileFeature } from '@/lib/power-lines'
import { powerLineFindings } from '@/lib/report/collect'
import { measureFeatures, queryPowerLines, type PowerLinesResult } from '@/lib/sources/power-lines'
import { uploadPowerLines } from '../../scripts/etl/upload-power-lines.mjs'
import { startMockSupabase } from '../e2e/mock-supabase.mjs'

const FIX = path.join(__dirname, '../fixtures')
const read = (p: string) => readFileSync(path.join(FIX, p), 'utf8')
const SOBOTKA = '022307_4.0003.541'
const sobotka = parseULDKResponse(read(`uldk/${SOBOTKA.replace(/[./]/g, '_')}.2180.txt`), SOBOTKA, '').geom!

describe('parser BDOT10k', () => {
  it('linie: klasa napięcia z atrybutu rodzaj, nieznane rodzaje pomijane', () => {
    const { features, skipped } = parseBdotXml(read('bdot/OT_SULN_L.xml'), 'SULN', '0223')
    expect(features.map(f => f.t)).toEqual(['MV', 'HV'])
    expect(skipped).toBe(1)
    expect(features[0]).toMatchObject({ p: '0223' })
    expect(features[0].i).toMatch(/^[0-9A-F-]{36}$/)
    expect(features[0].s).toBeUndefined() // „eksploatowany” nie jest zapisywany
    // współrzędne EPSG:2180 (x = wschód), okolice Wrocławia
    expect(features[0].c[0]).toBeGreaterThan(300_000)
    expect(features[0].c[0]).toBeLessThan(420_000)
    expect(features[0].c.length % 2).toBe(0)
  })

  it('rurociągi: rodzaj i status inny niż eksploatowany', () => {
    const { features } = parseBdotXml(read('bdot/OT_SUPR_L.xml'), 'SUPR', '1261')
    expect(features).toHaveLength(2)
    expect(features[0]).toMatchObject({ t: 'PIPE', s: 'nieczynny' })
    expect(features[1]).toMatchObject({ t: 'PIPE', r: 'benzynowy' })
  })

  it('obiekt na granicy kafli trafia do obu', () => {
    const f: TileFeature = { i: 'x', t: 'HV', p: '0223', c: [19_990, 5_000, 20_010, 5_000] }
    const tiles = new Map<string, TileFeature[]>()
    addToTiles(tiles, [f])
    expect([...tiles.keys()].sort()).toEqual(['1_0', '2_0'])
    expect(tilesForBbox([9_999, 9_999, 10_001, 10_001])).toEqual(['0_0', '0_1', '1_0', '1_1'])
  })
})

describe('odległość linii od działki', () => {
  const tile = JSON.parse(read('bdot/tiles/v1/33_33.json')) as PowerTile

  it('Sobótka: linia 110 kV przez działkę; z odcinków jednej klasy zostaje najbliższy', () => {
    const { lines } = measureFeatures(sobotka, tile.f)
    expect(lines.map(l => l.klasa)).toEqual(['HV', 'MV'])
    expect(lines[0]).toMatchObject({ klasa: 'HV', crosses: true, distanceM: 0 })
    expect(lines[1].distanceM).toBeGreaterThan(0)
    expect(lines[1].distanceM).toBeLessThan(10)
  })

  it('obiekty dalej niż promień są pomijane', () => {
    const far: TileFeature = { i: 'far', t: 'EHV', p: '0223', c: [338_000, 339_000, 338_000, 339_100] } // ~1 km na zachód
    expect(measureFeatures(sobotka, [far]).lines).toEqual([])
  })
})

describe('źródło: kafle z magazynu', () => {
  const env = process.env.POWER_LINES_URL
  beforeEach(() => {
    clearCache()
    process.env.POWER_LINES_URL = './tests/fixtures/bdot/tiles'
  })
  afterEach(() => {
    if (env === undefined) delete process.env.POWER_LINES_URL
    else process.env.POWER_LINES_URL = env
  })

  it('działka w zbiorze → linie, data danych powiatu, wersja', async () => {
    const r = await queryPowerLines(SOBOTKA, sobotka)
    expect(r.status).toBe('ok')
    expect(r.data).toMatchObject({ dataDate: '2023-11-08', datasetVersion: 'v1', radiusM: 300 })
    expect(r.data!.lines[0]).toMatchObject({ klasa: 'HV', crosses: true })
  })

  it('powiat spoza zbioru → not_covered bez czasu (raport użyje OSM)', async () => {
    const r = await queryPowerLines('1261_1.0001.1', sobotka)
    expect(r).toMatchObject({ status: 'not_covered', ms: 0 })
  })

  it('brak danych w magazynie → not_covered', async () => {
    process.env.POWER_LINES_URL = './tests/fixtures/bdot/brak'
    expect((await queryPowerLines(SOBOTKA, sobotka)).status).toBe('not_covered')
  })

  it('kafel jest w manifeście, a pliku brak → błąd, nie „brak linii”', async () => {
    const inMissingTile = [[[[335_000, 345_000], [335_100, 345_000], [335_100, 345_100], [335_000, 345_100], [335_000, 345_000]]]] as typeof sobotka
    const r = await queryPowerLines('022307_4.0003.999', inMissingTile)
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/33_34/)
  })
})

describe('ustalenia z linii BDOT10k', () => {
  const pl = (over: Partial<PowerLinesResult>): PowerLinesResult => ({ lines: [], pipelines: [], radiusM: 300, dataDate: '2023-11-08', datasetVersion: 'v1', ...over })
  const line = (klasa: 'EHV' | 'HV' | 'MV', distanceM: number) => ({ klasa, distanceM, crosses: distanceM === 0, status: null })
  const pipe = (rodzaj: string, distanceM: number) => ({ rodzaj, distanceM, crosses: distanceM === 0, status: null })

  it('linia NN w pasie → ryzyko; WN do 100 m → uwaga; dalej → nic', () => {
    expect(powerLineFindings(pl({ lines: [line('EHV', 30)] }))).toEqual([expect.objectContaining({ level: 'ryzyko' })])
    expect(powerLineFindings(pl({ lines: [line('HV', 60)] }))).toEqual([expect.objectContaining({ level: 'uwaga' })])
    expect(powerLineFindings(pl({ lines: [line('HV', 150)] }))).toEqual([])
  })

  it('SN przez działkę → uwaga o służebności', () => {
    const [f] = powerLineFindings(pl({ lines: [line('MV', 0)] }))
    expect(f).toMatchObject({ level: 'uwaga' })
    expect(f.text).toMatch(/przebiega przez działkę/)
  })

  it('rurociąg: gazowy blisko → uwaga; ciepłowniczy obok (nie przez działkę) → nic', () => {
    expect(powerLineFindings(pl({ pipelines: [pipe('gazowy', 15)] }))).toHaveLength(1)
    expect(powerLineFindings(pl({ pipelines: [pipe('ciepłowniczy', 15)] }))).toHaveLength(0)
    expect(powerLineFindings(pl({ pipelines: [pipe('ciepłowniczy', 0)] }))).toHaveLength(1)
  })
})

describe('upload do Storage i odczyt kafli przez HTTP (mock Supabase)', () => {
  let mock: Awaited<ReturnType<typeof startMockSupabase>>
  let dir: string
  const env = process.env.POWER_LINES_URL
  beforeAll(async () => {
    mock = await startMockSupabase()
    // komplet do wgrania: kafel 33_33 i manifest bez brakującego kafla 33_34
    dir = mkdtempSync(path.join(tmpdir(), 'power-lines-'))
    cpSync(path.join(FIX, 'bdot/tiles'), dir, { recursive: true })
    const m = JSON.parse(readFileSync(path.join(dir, 'current.json'), 'utf8'))
    writeFileSync(path.join(dir, 'current.json'), JSON.stringify({ ...m, tiles: ['33_33'] }))
  })
  afterAll(async () => {
    await mock.close()
    rmSync(dir, { recursive: true, force: true })
    if (env === undefined) delete process.env.POWER_LINES_URL
    else process.env.POWER_LINES_URL = env
  })

  it('przed wgraniem: brak current.json → not_covered; po wgraniu: linie z publicznego URL', async () => {
    process.env.POWER_LINES_URL = `${mock.url}/storage/v1/object/public/power-lines`
    clearCache()
    expect((await queryPowerLines(SOBOTKA, sobotka)).status).toBe('not_covered')

    const svc = createClient(mock.url, 'mock-service-role-key', { auth: { persistSession: false } })
    expect(await uploadPowerLines(svc, dir, { log: () => {} })).toEqual({ version: 'v1', files: 2 })

    clearCache()
    const r = await queryPowerLines(SOBOTKA, sobotka)
    expect(r.status).toBe('ok')
    expect(r.data!.lines[0]).toMatchObject({ klasa: 'HV', crosses: true })
  })
})

