/**
 * Plan ogólny z Rejestru Urbanistycznego: wybór wpisu gminy.
 */
import { describe, expect, it } from 'vitest'
import { IN_FORCE_STATUS, selectRuEntries } from '@/lib/sources/rejestr-urbanistyczny'

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
