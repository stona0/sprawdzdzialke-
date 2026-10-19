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
    id: '126105_9.0001.580/4', slug: 'krakow-stare-miasto',
    opis: 'Miasto spoza Dolnego Śląska — MPZP z krajowej integracji z symbolem terenu (KP.1)',
    expect: { gminaContains: 'Kraków', mpzpCovered: true, gesut: 'not_covered' },
  },
]
