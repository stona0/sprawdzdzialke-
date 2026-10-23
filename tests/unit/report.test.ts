import { describe, expect, it } from 'vitest'
import { assessBuildability, type AssessmentInput } from '@/lib/report/assessment'
import { buildFacts, generateInsights, ruleBasedInsights, validateItems } from '@/lib/report/ai'
import { buildFindings, type ReportData } from '@/lib/report/collect'
import { BASIS_LABEL, buildReportHtml, esc } from '@/lib/report/html'
import type Anthropic from '@anthropic-ai/sdk'

const base: AssessmentInput = {
  mpzpCovered: false, pogInForce: true, pogSource: 'GIS', pogStatusText: null, inOuz: true, ouzSharePct: 100, asOf: '2026-10-19',
}

describe('ocena ścieżki do zabudowy (stan po 1.09.2026)', () => {
  it('MPZP ma pierwszeństwo przed WZ', () => {
    expect(assessBuildability({ ...base, mpzpCovered: true, inOuz: false }).verdict).toBe('mpzp')
  })
  it('bez MPZP, POG obowiązuje, w OUZ → WZ możliwe', () => {
    expect(assessBuildability(base).verdict).toBe('wz_mozliwe')
  })
  it('częściowo w OUZ → podaje udział', () => {
    expect(assessBuildability({ ...base, ouzSharePct: 40 }).text).toMatch(/40%/)
  })
  it('bez MPZP, POG obowiązuje, poza OUZ → WZ niemożliwe', () => {
    expect(assessBuildability({ ...base, inOuz: false }).verdict).toBe('wz_niemozliwe_poza_ouz')
  })
  it('gmina bez POG → WZ niemożliwe, z zastrzeżeniem o opóźnieniu rejestru', () => {
    const a = assessBuildability({ ...base, pogInForce: false, inOuz: null, pogSource: 'Rejestru Urbanistycznego', pogStatusText: 'w opracowaniu' })
    expect(a.verdict).toBe('wz_niemozliwe_brak_pog')
    expect(a.text).toMatch(/w opracowaniu/)
    expect(a.text).toMatch(/opóźniony/)
  })
  it('POG obowiązuje, ale brak geometrii OUZ → nieustalone, niska pewność', () => {
    const a = assessBuildability({ ...base, inOuz: null })
    expect(a.verdict).toBe('nieustalone')
    expect(a.confidence).toBe('niska')
  })
  it('nic nie wiadomo → nieustalone', () => {
    expect(assessBuildability({ ...base, mpzpCovered: null, pogInForce: null, inOuz: null }).verdict).toBe('nieustalone')
  })
})

function makeData(over: Partial<ReportData> = {}): ReportData {
  const findings = buildFindings({
    wMpzp: null,
    isok: { scenarios: ['Q1'], oszp: true, risk: [], validTo: '2025-12-21' },
    gdos: { onParcel: [{ type: 'Natura 2000 – obszar specjalnej ochrony ptaków (OSO)', name: 'Dolina Baryczy' }], nearby: [] },
    gesut: { energia: { distanceM: 0, crosses: true }, woda: { distanceM: 12, crosses: false }, kanalizacja: { distanceM: null, crosses: false }, gaz: { distanceM: null, crosses: false } },
    osm: null, ru: null, plan: null, draft: null,
  })
  return {
    version: 2,
    parcelId: '021303_4.0001.AR_18.19/9',
    generatedAt: '2026-10-19T10:00:00.000Z',
    parcel: {
      parcelId: '021303_4.0001.AR_18.19/9', numer: '19/9', powierzchnia: 2970, obreb: 'Milicz', gmina: 'Milicz',
      teryt: '021303_4', terc: '021303', powiat: 'milicki', wojewodztwo: 'dolnośląskie',
      wspolrzedne: { lat: 51.53, lng: 17.27 }, geomWkt: null, found: true,
    },
    mpzp: { covered: false, wroclaw: null, kimpzp: [], status: 'no_data' },
    pog: { plan: null, planStatus: 'not_covered', draft: null, ru: { entry: null, inForce: false, draft: null }, inForce: false, source: 'Rejestru Urbanistycznego' },
    assessment: assessBuildability({ ...base, pogInForce: false, inOuz: null }),
    flood: { scenarios: ['Q1'], oszp: true, risk: [], validTo: '2025-12-21' },
    nature: { onParcel: [{ type: 'Natura 2000 – obszar specjalnej ochrony ptaków (OSO)', name: 'Dolina Baryczy' }], nearby: [] },
    gesut: { energia: { distanceM: 0, crosses: true }, woda: { distanceM: 12, crosses: false }, kanalizacja: { distanceM: null, crosses: false }, gaz: { distanceM: null, crosses: false } },
    gesutStatus: 'ok',
    osm: null,
    powerLines: null,
    sip: null,
    utilityMapUrl: null,
    findings,
    sources: [{ source: 'Linie i rurociągi – OpenStreetMap', status: 'error', error: 'timeout', ms: 15000, fetchedAt: '2026-10-19T10:00:00.000Z' }],
    ...over,
  }
}

describe('kluczowe ustalenia (reguły)', () => {
  it('powódź, Natura 2000 na działce i sieć przez działkę', () => {
    const f = makeData().findings
    expect(f.find(x => x.basis === 'powodz')?.level).toBe('ryzyko')
    expect(f.find(x => x.basis === 'przyroda')?.text).toMatch(/Dolina Baryczy/)
    expect(f.find(x => x.basis === 'uzbrojenie')?.text).toMatch(/sieć elektroenergetyczna/)
  })
})

describe('AI – tylko fakty z danych', () => {
  const facts = buildFacts(makeData())

  it('odrzuca punkt z liczbą, której nie ma w danych', () => {
    const r = validateItems([
      { tekst: 'Wodociąg jest 12 m od granicy — wystąp o warunki przyłączenia.', podstawa: ['uzbrojenie'] },
      { tekst: 'Maksymalna wysokość zabudowy to 9 m.', podstawa: ['mpzp'] },
    ], facts)
    expect(r.ok).toHaveLength(1)
    expect(r.rejected).toBe(1)
  })

  it('numer działki jako odwołanie przechodzi, jako wartość nie', () => {
    const r = validateItems([
      { tekst: 'Zamów wypis i wyrys z planu ogólnego dla działki 19/9.', podstawa: ['plan_ogolny'] },
      { tekst: 'Sprawdź księgę wieczystą działki nr 19/9 w obrębie Milicz.', podstawa: ['dzialka'] },
      { tekst: 'Zapytaj operatora o pas ochronny sieci na działce 19/9.', podstawa: ['uzbrojenie'] },
      { tekst: 'Linia przebiega 9 m od granicy.', podstawa: ['uzbrojenie'] },
      { tekst: 'Działka 19/9 ha jest duża.', podstawa: ['dzialka'] },
    ], facts)
    expect(r.ok).toHaveLength(3)
    expect(r.rejected).toBe(2)
  })

  it('data ISO w faktach odpowiada dacie słownie i ISO w tekście', () => {
    const f = { ...facts, plan_ogolny: { stan_rejestru: '2026-10-23' } }
    const r = validateItems([
      { tekst: 'Rejestr Urbanistyczny z 23 października 2026 nie wykazuje planu ogólnego.', podstawa: ['plan_ogolny'] },
      { tekst: 'Stan rejestru na 2026-10-23 może być nieaktualny.', podstawa: ['plan_ogolny'] },
      { tekst: 'Rejestr z 24 października 2026 nie wykazuje planu.', podstawa: ['plan_ogolny'] },
    ], f)
    expect(r.ok).toHaveLength(2)
    expect(r.rejected).toBe(1)
  })

  it('data słownie odpowiada dacie z faktów (1.09.2026)', () => {
    expect(facts.ocena_zabudowy).toMatchObject({ opis: expect.stringContaining('1.09.2026') })
    const r = validateItems([
      { tekst: 'Od 1 września 2026 r. decyzję WZ można wydać tylko w obszarze uzupełnienia zabudowy.', podstawa: ['ocena_zabudowy'] },
      { tekst: 'Od września 2026 gmina bez planu ogólnego nie wyda WZ.', podstawa: ['ocena_zabudowy'] },
      { tekst: 'Od 1 marca 2026 obowiązują nowe zasady.', podstawa: ['ocena_zabudowy'] },
    ], facts)
    expect(r.ok).toHaveLength(2)
    expect(r.rejected).toBe(1)
  })

  it('odrzuca punkt bez podstawy', () => {
    expect(validateItems([{ tekst: 'Coś.', podstawa: [] }], facts).rejected).toBe(1)
  })

  it('brak klucza API → rekomendacje regułowe, bez wywołania modelu', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const r = await generateInsights(makeData())
    process.env.ANTHROPIC_API_KEY = prev
    expect(r.model).toBeNull()
    expect(r.rekomendacje.length).toBeGreaterThan(0)
    expect(r.ryzyka.map(i => i.tekst).join(' ')).toMatch(/powodzi/)
  })

  it('odpowiedź modelu z halucynacją jest filtrowana; gdy nic nie zostaje → reguły', async () => {
    const fake = {
      messages: {
        create: async () => ({
          model: 'claude-haiku-4-5', stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify({ rekomendacje: [{ tekst: 'Wybuduj dom o wysokości 12,5 m.', podstawa: ['mpzp'] }], ryzyka: [] }) }],
        }),
      },
    } as unknown as Anthropic
    const r = await generateInsights(makeData(), fake)
    expect(r.model).toBeNull()
    expect(r.odrzucone).toBe(1)
  })

  it('poprawna odpowiedź modelu przechodzi', async () => {
    const fake = {
      messages: {
        create: async () => ({
          model: 'claude-haiku-4-5', stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify({
            rekomendacje: [{ tekst: 'Uzgodnij z RDOŚ możliwość zabudowy w obszarze Natura 2000 Dolina Baryczy.', podstawa: ['przyroda'] }],
            ryzyka: [{ tekst: 'Działka w strefie Q1% — droższe ubezpieczenie.', podstawa: ['powodz'] }],
          }) }],
        }),
      },
    } as unknown as Anthropic
    const r = await generateInsights(makeData(), fake)
    expect(r.model).toBe('claude-haiku-4-5')
    expect(r.rekomendacje).toEqual([{ tekst: expect.stringMatching(/RDOŚ/), podstawa: ['przyroda'] }])
    expect(r.ryzyka).toEqual([{ tekst: expect.stringMatching(/Q1%/), podstawa: ['powodz'] }])
  })

  it('reguły zalecają weryfikację, gdy brak POG', () => {
    expect(ruleBasedInsights(makeData()).rekomendacje[0].tekst).toMatch(/urzędzie gminy/)
  })

  it('reguły podają podstawę: ocena zabudowy, uzbrojenie, ustalenia; księga wieczysta bez podstawy w danych', () => {
    const r = ruleBasedInsights(makeData())
    expect(r.rekomendacje.map(i => i.podstawa)).toEqual([['ocena_zabudowy'], ['uzbrojenie'], []])
    expect(r.ryzyka.map(i => i.podstawa)).toEqual([['powodz'], ['przyroda'], ['uzbrojenie']])
  })
})

describe('HTML raportu', () => {
  it('escapuje dane z zewnętrznych źródeł (XSS)', () => {
    const d = makeData()
    d.parcel.obreb = '<script>alert(1)</script>'
    d.nature = { onParcel: [{ type: 'X', name: '<img src=x onerror=alert(1)>' }], nearby: [] }
    const html = buildReportHtml(d, { rekomendacje: [{ tekst: '<b>x</b>', podstawa: ['mpzp'] }], ryzyka: [], model: null, odrzucone: 0 })
    expect(html).not.toMatch(/<script>alert/)
    expect(html).not.toMatch(/<img src=x/)
    expect(html).toContain('&lt;script&gt;')
  })

  it('przy każdym punkcie podaje podstawę — nazwę sekcji raportu, w której jest fakt', () => {
    const html = buildReportHtml(makeData(), {
      rekomendacje: [
        { tekst: 'Zapytaj RDOŚ o uzgodnienia.', podstawa: ['przyroda', 'ocena_zabudowy', 'przyroda'] },
        { tekst: 'Sprawdź księgę wieczystą.', podstawa: [] },
      ],
      ryzyka: [{ tekst: 'Działka w strefie Q1%.', podstawa: ['powodz'] }],
      model: 'claude-haiku-5-5', odrzucone: 0,
    })
    expect(html).toContain('Zapytaj RDOŚ o uzgodnienia.<span class="ai-basis">Podstawa: Ochrona przyrody · Podsumowanie</span>')
    expect(html).toContain('Sprawdź księgę wieczystą.<span class="ai-basis">Podstawa: ogólna dobra praktyka przy zakupie działki</span>')
    expect(html).toContain('Działka w strefie Q1%.<span class="ai-basis">Podstawa: Zagrożenie powodziowe</span>')
    // każda etykieta podstawy to nazwa sekcji lub podsekcji, która jest w raporcie
    for (const label of Object.values(BASIS_LABEL)) expect(html).toContain(`${esc(label)}</div>`)
  })

  it('pokazuje status źródeł i informuje, że błąd źródła ≠ brak problemu', () => {
    const html = buildReportHtml(makeData(), { rekomendacje: [], ryzyka: [], model: null, odrzucone: 0 })
    expect(html).toContain('Źródła danych i ich status')
    expect(html).toContain('źródło niedostępne')
    expect(html).toContain('Brak obowiązującego planu ogólnego gminy')
  })

  it('linie z BDOT10k zastępują blok OSM: klasa, odległość, data danych powiatu', () => {
    const d = makeData({
      powerLines: {
        lines: [{ klasa: 'HV', distanceM: 0, crosses: true, status: null }, { klasa: 'MV', distanceM: 3, crosses: false, status: null }],
        pipelines: [], radiusM: 300, dataDate: '2023-11-08', datasetVersion: 'v1',
      },
    })
    const html = buildReportHtml(d, { rekomendacje: [], ryzyka: [], model: null, odrzucone: 0 })
    expect(html).toContain('Linie napowietrzne i rurociągi w BDOT10k')
    expect(html).toContain('Linia wysokiego napięcia (110 kV)')
    expect(html).toContain('przez działkę')
    expect(html).toContain('dane powiatu z 8.11.2023')
    expect(html).not.toContain('OpenStreetMap: źródło niedostępne')
  })

  it('esc', () => {
    expect(esc('a&b"<>')).toBe('a&amp;b&quot;&lt;&gt;')
    expect(esc(null)).toBe('')
  })
})
