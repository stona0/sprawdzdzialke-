/**
 * Plan ogólny z Rejestru Urbanistycznego: wybór wpisu gminy i strefy/OUZ na działce
 * (fixture: geometria POG Siechnic, act 2336, przycięta do okolicy dwóch działek).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseULDKResponse } from '@/lib/geoportal'
import { IN_FORCE_STATUS, parseHeight, pogFromRu, selectRuEntries, type ApiGeometries, type ApiZoneDetails } from '@/lib/sources/rejestr-urbanistyczny'

const FIX = path.join(__dirname, '../fixtures')
const geometries = JSON.parse(readFileSync(path.join(FIX, 'ru/siechnice-2336-geometries.json'), 'utf8'))[0] as ApiGeometries
const parcel = (id: string) => {
  const p = parseULDKResponse(readFileSync(path.join(FIX, `uldk/${id.replace(/[./]/g, '_')}.2180.txt`), 'utf8'), id, '')
  if (!p.geom) throw new Error(`brak geometrii ${id}`)
  return p.geom
}
const details = new Map<string, ApiZoneDetails>([
  ['685SJ', { designation: '685SJ', basicProfiles: ['teren zabudowy mieszkaniowej jednorodzinnej'], additionalProfiles: [], maxAboveGroundDevelopmentIntensity: 0.6, maxDevelopmentAreaPart: 30, maxDevelopmentHeight: '12 m', minBiologicallyActiveAreaPart: 50 }],
])
const meta = { uchwala: 'Uchwała nr XXXI/447/26', url: 'https://rejestr-urbanistyczny.gov.pl/published/pog/2336', zrodlo: 'Rejestr Urbanistyczny' }

const act = (id: number, terc: string, status: string, publishDate: string) =>
  ({ publishedActId: id, title: `Plan ${id}`, spatialPlanningActStatus: status, validFrom: publishDate, publishDate, tercCode: terc, commune: 'X' })

describe('wybór wpisu gminy w Rejestrze Urbanistycznym', () => {
  it('plan w mocy ma pierwszeństwo przed nowszym projektem (Radom, 23.10.2026)', () => {
    const r = selectRuEntries([
      act(3777, '146301', 'w opracowaniu', '2026-10-05'),
      act(84, '146301', IN_FORCE_STATUS, '2026-07-15'),
    ], '146301')
    expect(r.inForce).toBe(true)
    expect(r.entry?.actId).toBe(84)
    expect(r.draft?.actId).toBe(3777)
  })

  it('starszy projekt niż plan w mocy nie jest pokazywany jako projekt', () => {
    const r = selectRuEntries([act(932, '226301', IN_FORCE_STATUS, '2026-08-13'), act(295, '226301', 'w opracowaniu', '2026-07-20')], '226301')
    expect(r.entry?.actId).toBe(932)
    expect(r.draft).toBeNull()
  })

  it('gmina tylko z projektem: brak planu w mocy, projekt informacyjnie', () => {
    const r = selectRuEntries([act(5725, '101408', 'w opracowaniu', '2026-10-23')], '101408')
    expect(r).toMatchObject({ inForce: false, entry: { actId: 5725 }, draft: { actId: 5725 } })
  })

  it('wpisy innych gmin i nieznane statusy są pomijane', () => {
    const r = selectRuEntries([act(1, '026401', IN_FORCE_STATUS, '2026-10-01'), act(2, '022308', 'archiwalny', '2026-10-01')], '022308')
    expect(r).toMatchObject({ inForce: false, draft: null, entry: { actId: 2 } })
  })
})

describe('strefy planu ogólnego na działce (geometria RU)', () => {
  it('działka w strefie SJ i w obszarze uzupełnienia zabudowy', () => {
    const p = pogFromRu(parcel('022308_5.0021.24'), geometries, details, meta)!
    expect(p.strefy).toHaveLength(1)
    expect(p.strefy[0]).toMatchObject({ oznaczenie: '685SJ', symbol: 'SJ', maks_wysokosc: 12, min_pbc: 50, maks_intensywnosc: 0.6 })
    expect(p.strefy[0].sharePct).toBeGreaterThan(99)
    expect(p.obszar_uzupelnienia_zabudowy).toBe('1OUZ')
    expect(p.ouzSharePct).toBeGreaterThan(70)
    expect(p.ouzSharePct).toBeLessThan(80)
    expect(p).toMatchObject({ obowiazuje_od: '2026-09-24', zrodlo: 'Rejestr Urbanistyczny', url: meta.url })
  })

  it('działka poza OUZ, w dwóch strefach; brak parametrów → null, nie zgadujemy', () => {
    const p = pogFromRu(parcel('022308_5.0010.11'), geometries, details, meta)!
    expect(p.strefy.map(s => s.oznaczenie)).toEqual(['1SR', '68SO'])
    expect(p.strefy.reduce((s, z) => s + z.sharePct, 0)).toBeCloseTo(100, 0)
    expect(p.strefy[0].maks_wysokosc).toBeNull()
    expect(p.obszar_uzupelnienia_zabudowy).toBeNull()
    expect(p.ouzSharePct).toBe(0)
  })

  it('działka poza zasięgiem geometrii planu → null', () => {
    expect(pogFromRu(parcel('022302_2.0020.440/1'), geometries, details, meta)).toBeNull()
  })

  it('wysokość z tekstu RU', () => {
    expect(parseHeight('12 m')).toBe(12)
    expect(parseHeight('12,5 m')).toBe(12.5)
    expect(parseHeight(null)).toBeNull()
    expect(parseHeight('bez ograniczeń')).toBeNull()
  })
})
