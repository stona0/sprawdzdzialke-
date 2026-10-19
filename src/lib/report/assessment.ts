/**
 * Ocena ścieżki do zabudowy po reformie planistycznej (ustawa z 7.07.2023 z późn. zm.).
 * Od 1.09.2026 studia straciły moc, a nową decyzję o warunkach zabudowy (WZ) można
 * co do zasady wydać tylko w gminie z obowiązującym planem ogólnym (POG) i tylko
 * w wyznaczonym w nim obszarze uzupełnienia zabudowy (OUZ). Wyjątki (np. postępowania
 * wszczęte przed utratą mocy studium, część inwestycji infrastrukturalnych) wymagają
 * analizy prawnej — raport ich nie rozstrzyga.
 */

export type Verdict =
  | 'mpzp'
  | 'wz_mozliwe'
  | 'wz_niemozliwe_poza_ouz'
  | 'wz_niemozliwe_brak_pog'
  | 'nieustalone'

export interface AssessmentInput {
  /** true = MPZP obejmuje działkę, false = źródło potwierdza brak MPZP, null = nie wiadomo. */
  mpzpCovered: boolean | null
  /** true/false = wiadomo, czy w gminie obowiązuje POG; null = nie wiadomo. */
  pogInForce: boolean | null
  /** Skąd wiemy o POG (do treści raportu). */
  pogSource: string | null
  pogStatusText: string | null
  /** true/false = wiadomo, czy działka jest w OUZ; null = nie wiadomo. */
  inOuz: boolean | null
  ouzSharePct: number | null
  asOf: string
}

export interface Assessment {
  verdict: Verdict
  title: string
  text: string
  /** Na ile pewne są dane wejściowe. */
  confidence: 'wysoka' | 'srednia' | 'niska'
}

const VERIFY = 'Przed zakupem potwierdź to w urzędzie gminy (wypis i wyrys z planu / zaświadczenie).'

export function assessBuildability(i: AssessmentInput): Assessment {
  if (i.mpzpCovered === true) {
    return {
      verdict: 'mpzp',
      title: 'Działka objęta miejscowym planem (MPZP)',
      text:
        'O tym, co i jak można zbudować, decydują ustalenia obowiązującego MPZP — dla terenów objętych planem ' +
        'nie wydaje się decyzji o warunkach zabudowy. ' + VERIFY,
      confidence: 'wysoka',
    }
  }

  const mpzpNote = i.mpzpCovered === null
    ? 'Nie udało się ustalić, czy działkę obejmuje MPZP. Jeżeli plan obowiązuje, to on rozstrzyga o zabudowie. '
    : ''

  if (i.pogInForce === true) {
    if (i.inOuz === true) {
      const part = i.ouzSharePct !== null && i.ouzSharePct < 99
        ? `W obszarze uzupełnienia zabudowy leży ok. ${Math.round(i.ouzSharePct)}% działki. `
        : 'Działka leży w obszarze uzupełnienia zabudowy wyznaczonym w planie ogólnym. '
      return {
        verdict: 'wz_mozliwe',
        title: 'Możliwa decyzja o warunkach zabudowy (działka w OUZ)',
        text:
          mpzpNote + part +
          'Można ubiegać się o decyzję WZ; jej ustalenia muszą być zgodne z planem ogólnym (strefa, parametry). ' +
          'Decyzja WZ wydana po 1.01.2026 wygasa po 5 latach od uprawomocnienia. ' + VERIFY,
        confidence: i.mpzpCovered === false ? 'wysoka' : 'srednia',
      }
    }
    if (i.inOuz === false) {
      return {
        verdict: 'wz_niemozliwe_poza_ouz',
        title: 'Nowa decyzja WZ co do zasady niemożliwa (poza OUZ)',
        text:
          mpzpNote +
          'Gmina ma obowiązujący plan ogólny, ale działka nie leży w obszarze uzupełnienia zabudowy. ' +
          'Od 1.09.2026 nowej decyzji o warunkach zabudowy dla budynków co do zasady nie można tu uzyskać — ' +
          'zabudowa wymaga uchwalenia miejscowego planu. ' + VERIFY,
        confidence: i.mpzpCovered === false ? 'wysoka' : 'srednia',
      }
    }
    return {
      verdict: 'nieustalone',
      title: 'Gmina ma plan ogólny — nie ustalono, czy działka jest w OUZ',
      text:
        mpzpNote +
        `Według ${i.pogSource ?? 'dostępnych danych'} w gminie obowiązuje plan ogólny, ale nie mamy jego geometrii ` +
        'dla tej gminy. Sprawdź w geoportalu gminy lub w urzędzie, czy działka leży w obszarze uzupełnienia ' +
        'zabudowy — tylko tam można uzyskać decyzję WZ. ' + VERIFY,
      confidence: 'niska',
    }
  }

  if (i.pogInForce === false) {
    return {
      verdict: 'wz_niemozliwe_brak_pog',
      title: 'Brak obowiązującego planu ogólnego gminy',
      text:
        mpzpNote +
        `Według ${i.pogSource ?? 'Rejestru Urbanistycznego'} (stan na ${i.asOf}) gmina nie ma obowiązującego planu ` +
        `ogólnego${i.pogStatusText ? ` (status: ${i.pogStatusText})` : ''}. Jeśli to aktualne, od 1.09.2026 nie można ` +
        'w niej uzyskać nowej decyzji o warunkach zabudowy, a zabudowa terenu bez MPZP wymaga uchwalenia planu. ' +
        'Rejestr bywa opóźniony względem uchwał gmin — koniecznie potwierdź stan w urzędzie gminy.',
      confidence: 'srednia',
    }
  }

  return {
    verdict: 'nieustalone',
    title: 'Nie udało się ustalić ścieżki do zabudowy',
    text:
      mpzpNote +
      'Nie udało się pobrać informacji o planie ogólnym gminy. Od 1.09.2026 decyzję WZ można wydać tylko w gminie ' +
      'z obowiązującym planem ogólnym i tylko w obszarze uzupełnienia zabudowy. ' + VERIFY,
    confidence: 'niska',
  }
}
