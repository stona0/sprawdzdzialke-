import { NextRequest, NextResponse } from 'next/server'
import { getParcelData } from '@/lib/geoportal'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parcelId = searchParams.get('parcelId')?.trim()
  // gmina jest teraz opcjonalna — parsowana z TERYT w parcelId
  const gmina = searchParams.get('gmina')?.trim()
  const teryt = searchParams.get('teryt')?.trim()

  if (!parcelId) {
    return NextResponse.json({ error: 'Brak parametru parcelId' }, { status: 400 })
  }

  // Jeśli gmina nie została podana, używamy teryt lub wyciągamy z parcelId
  const gminaFallback = gmina || teryt || parcelId.split('.')[0] || 'nieznana'

  try {
    const data = await getParcelData(parcelId, gminaFallback)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
