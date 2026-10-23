/**
 * Działki testowe z różnych typów lokalizacji. Oczekiwania ustalone ręcznie
 * bezpośrednimi zapytaniami do źródeł (październik 2026) — mogą się zdezaktualizować,
 * gdy gminy uchwalą nowe plany albo rejestry zostaną uzupełnione.
 */
export interface TestParcel {
  id: string
  slug: string
  opis: string
  expect: {
    gminaContains: string
    mpzpCovered?: boolean | null
    pogInForce?: boolean
    inOuz?: boolean
    /** Oznaczenie strefy planu ogólnego o największym udziale. */
    pogZone?: string
    /** Działka w OUZ projektu planu ogólnego (gmina bez planu w mocy). */
    draftOuz?: boolean
    verdict?: string
    flood?: string[]
    natureOnParcel?: boolean
    gesut?: 'ok' | 'not_covered'
  }
}

export const TEST_PARCELS: TestParcel[] = [
  {
    id: '026401_1.0001.2395', slug: 'wroclaw-stare-miasto',
    opis: 'Miasto z MPZP (Wrocław, Rynek) — teren 12UA*UC, strefa konserwatorska',
    expect: { gminaContains: 'Wrocław', mpzpCovered: true, pogInForce: true, inOuz: false, flood: [], natureOnParcel: false, gesut: 'not_covered' },
  },
  {
    id: '026401_1.0054.888', slug: 'wroclaw-lipa-piotrowska',
    opis: 'Miasto bez MPZP, w obszarze uzupełnienia zabudowy planu ogólnego',
    expect: { gminaContains: 'Wrocław', mpzpCovered: false, pogInForce: true, inOuz: true, flood: ['WAL'], natureOnParcel: false, gesut: 'not_covered' },
  },
  {
    id: '026401_1.0041.442', slug: 'wroclaw-pilczyce',
    opis: 'Teren nad Odrą w strefie zagrożenia powodziowego (Q1%) i w obszarze Natura 2000',
    expect: { gminaContains: 'Wrocław', mpzpCovered: false, pogInForce: true, flood: ['Q1', 'Q0.2', 'BUDOWLA'], natureOnParcel: true },
  },
  {
    id: '020802_1.0010.AR_3.27/16', slug: 'klodzko-centrum',
    opis: 'Dolny Śląsk, działka w strefie zagrożenia powodziowego Nysy Kłodzkiej',
    expect: { gminaContains: 'Kłodzko', flood: ['Q1', 'Q0.2'] },
  },
  {
    id: '022302_2.0020.440/1', slug: 'dlugoleka-kielczow',
    opis: 'Dolny Śląsk, gmina podmiejska Wrocławia — MPZP z krajowej integracji, brak POG w rejestrze',
    expect: { gminaContains: 'Długołęka', mpzpCovered: true, pogInForce: false, natureOnParcel: false, gesut: 'ok' },
  },
  {
    id: '060501_2.0004.273/4', slug: 'batorz-wies',
    opis: 'Wieś bez MPZP (Lubelskie), plan ogólny w opracowaniu',
    expect: { gminaContains: 'Batorz', mpzpCovered: false, pogInForce: false, flood: [], gesut: 'ok' },
  },
  {
    id: '021303_4.0001.AR_18.19/9', slug: 'milicz-natura2000',
    opis: 'Działka w obszarze Natura 2000 i Parku Krajobrazowym Dolina Baryczy',
    expect: { gminaContains: 'Milicz', natureOnParcel: true, gesut: 'ok' },
  },
  {
    id: '022308_5.0021.24', slug: 'siechnice-ouz',
    opis: 'Gmina z planem ogólnym w Rejestrze Urbanistycznym, bez MPZP — strefa SJ, w obszarze uzupełnienia zabudowy',
    expect: { gminaContains: 'Siechnice', mpzpCovered: false, pogInForce: true, inOuz: true, pogZone: '685SJ', verdict: 'wz_mozliwe' },
  },
  {
    id: '022308_5.0010.11', slug: 'siechnice-poza-ouz',
    opis: 'Gmina z planem ogólnym (RU), działka poza OUZ, objęta MPZP',
    expect: { gminaContains: 'Siechnice', mpzpCovered: true, pogInForce: true, inOuz: false, pogZone: '1SR', verdict: 'mpzp' },
  },
  {
    id: '146301_1.0180.AR_176.7/2', slug: 'radom-pog',
    opis: 'POG w mocy i nowsza wersja w opracowaniu — wcześniej raport mówił „brak planu ogólnego”',
    expect: { gminaContains: 'Radom', pogInForce: true, inOuz: true, pogZone: '1SJ' },
  },
  {
    id: '101408_2.0021.44/2', slug: 'sieradz-projekt-pog',
    opis: 'Gmina bez planu w mocy, projekt planu ogólnego w RU — OUZ w projekcie (informacyjnie)',
    expect: { gminaContains: 'Sieradz', pogInForce: false, draftOuz: true, verdict: 'wz_niemozliwe_brak_pog' },
  },
  {
    id: '126105_9.0001.580/4', slug: 'krakow-stare-miasto',
    opis: 'Miasto spoza Dolnego Śląska — MPZP z krajowej integracji z symbolem terenu (KP.1)',
    expect: { gminaContains: 'Kraków', mpzpCovered: true, gesut: 'not_covered' },
  },
]
