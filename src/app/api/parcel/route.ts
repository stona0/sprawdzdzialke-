import { NextRequest, NextResponse } from 'next/server'
import { getParcelData } from '@/lib/geoportal'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parcelId = searchParams.get('parcelId')?.trim()
  const gmina = searchParams.get('gmina')?.trim()

  if (!parcelId || !gmina) {
    return NextResponse.json({ error: 'Brak parametrów parcelId i gmina' }, { status: 400 })
  }

  try {
    const data = await getParcelData(parcelId, gmina)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
