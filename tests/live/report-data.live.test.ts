/**
 * Testy na ŻYWYCH usługach państwowych (GUGiK, GDOŚ, ISOK, Rejestr Urbanistyczny, UM Wrocławia).
 * Uruchamiane osobno: `npm run test:live`. Mogą zawieść, gdy usługa leży albo gmina
 * zmieni plan — wtedy najpierw sprawdź źródło ręcznie, potem aktualizuj tests/parcels.ts.
 */
import { describe, expect, it } from 'vitest'
import { collectReportData } from '@/lib/report/collect'
import { TEST_PARCELS } from '../parcels'

// OpenStreetMap (publiczne Overpass) bywa przeciążone — jego błąd nie blokuje raportu.
// Linie BDOT10k: z POWER_LINES_URL wskazującym wynik ETL, np.
//   npm run etl:power-lines -- --powiaty 0223,0264,0208,0213,1261,1463,1014,0605
//   POWER_LINES_URL=./data/power-lines npm run test:live
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
    if (exp.inOuz !== undefined) expect(!!d.pog.plan?.obszar_uzupelnienia_zabudowy).toBe(exp.inOuz)
    if (exp.pogZone !== undefined) expect(d.pog.plan?.strefy[0]?.oznaczenie).toBe(exp.pogZone)
    if (exp.draftOuz !== undefined) expect(!!d.pog.draft?.obszar_uzupelnienia_zabudowy).toBe(exp.draftOuz)
    if (exp.verdict !== undefined) expect(d.assessment.verdict).toBe(exp.verdict)
    // Kafle BDOT10k są wynikiem ETL (npm run etl:power-lines) — bez nich raport używa OSM.
    if (exp.powerLineCrosses !== undefined && process.env.POWER_LINES_URL) {
      expect(d.powerLines?.lines.find(l => l.crosses)?.klasa).toBe(exp.powerLineCrosses)
    }
    if (exp.flood !== undefined) expect(d.flood?.scenarios).toEqual(exp.flood)
    if (exp.natureOnParcel !== undefined) expect((d.nature?.onParcel.length ?? 0) > 0).toBe(exp.natureOnParcel)
    if (exp.gesut !== undefined) expect(d.gesutStatus).toBe(exp.gesut)
  }, 120_000)
})
