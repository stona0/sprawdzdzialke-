/**
 * Plan ogólny gminy (POG) w kształcie wspólnym dla wszystkich źródeł
 * (GIS UM Wrocławia, Rejestr Urbanistyczny) — z tego korzysta ocena zabudowy i raport.
 */

export interface PogStrefa {
  oznaczenie: string
  symbol: string | null
  nazwa: string | null
  maks_intensywnosc: number | null
  maks_udzial_zabudowy: number | null
  maks_wysokosc: number | null
  min_pbc: number | null
  profil_podstawowy: string[]
  profil_dodatkowy: string[]
  sharePct: number
}

export interface Pog {
  /** Strefy planistyczne przecinające działkę, od największego udziału. */
  strefy: PogStrefa[]
  /** Oznaczenie OUZ, gdy działka (choćby częściowo) w nim leży. */
  obszar_uzupelnienia_zabudowy: string | null
  ouzSharePct: number
  obszar_zabudowy_srodmiejskiej: string | null
  obowiazuje_od: string | null
  uchwala: string | null
  zrodlo: string
  /** Link do planu w źródle (np. karta planu w Rejestrze Urbanistycznym). */
  url?: string | null
}
