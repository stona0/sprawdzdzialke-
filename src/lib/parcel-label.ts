export interface ParcelIdParts {
  numer: string
  obreb: string | null
  arkusz: string | null
}

/**
 * Części identyfikatora EGB (jednostka.obręb[.AR_arkusz].numer) do wyświetlenia, np.
 *   "022302_2.0020.440/1"      → numer 440/1, obręb 0020
 *   "021303_4.0001.AR_18.19/9" → numer 19/9, obręb 0001, arkusz 18
 * Identyfikator w innym formacie zwraca w całości jako numer.
 */
export function describeParcelId(id: string): ParcelIdParts {
  const parts = id.trim().split('.')
  if (parts.length < 3) return { numer: id.trim(), obreb: null, arkusz: null }
  const rest = parts.slice(2)
  if (rest.length > 1 && /^AR_/i.test(rest[0])) {
    return { numer: rest.slice(1).join('.'), obreb: parts[1], arkusz: rest[0].slice(3) }
  }
  return { numer: rest.join('.'), obreb: parts[1], arkusz: null }
}
