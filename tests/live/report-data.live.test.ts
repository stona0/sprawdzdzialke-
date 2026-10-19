/**
 * Testy na ŻYWYCH usługach państwowych (GUGiK, GDOŚ, ISOK, Rejestr Urbanistyczny, UM Wrocławia).
 * Uruchamiane osobno: `npm run test:live`. Mogą zawieść, gdy usługa leży albo gmina
 * zmieni plan — wtedy najpierw sprawdź źródło ręcznie, potem aktualizuj tests/parcels.ts.
 */
import { describe, expect, it } from 'vitest'
import { collectReportData } from '@/lib/report/collect'
import { TEST_PARCELS } from '../parcels'

// OpenStreetMap (publiczne Overpass) bywa przeciążone — jego błąd nie blokuje raportu.
const OPTIONAL = ['Linie i rurociągi – OpenStreetMap']

describe.each(TEST_PARCELS)('$slug — $opis', ({ id, expect: exp }) => {
  it('zbiera dane ze wszystkich źródeł i zgadza się z ręczną weryfikacją', async () => {
    const d = await collectReportData(id, '')

    expect(d.parcel.gmina).toContain(exp.gminaContains)
    expect(d.parcel.wspolrzedne).not.toBeNull()

    for (const s of d.sources) {
      if (!OPTIONAL.includes(s.source)) expect(s.status, `${s.source}: ${s.error}`).not.toBe('error')
    }

    if (exp.mpzpCovered !== undefined) expect(d.mpzp.covered).toBe(exp.mpzpCovered)
    if (exp.pogInForce !== undefined) expect(d.pog.inForce).toBe(exp.pogInForce)
    if (exp.inOuz !== undefined) expect(!!d.pog.wroclaw?.obszar_uzupelnienia_zabudowy).toBe(exp.inOuz)
    if (exp.flood !== undefined) expect(d.flood?.scenarios).toEqual(exp.flood)
    if (exp.natureOnParcel !== undefined) expect((d.nature?.onParcel.length ?? 0) > 0).toBe(exp.natureOnParcel)
    if (exp.gesut !== undefined) expect(d.gesutStatus).toBe(exp.gesut)
  }, 120_000)
})
