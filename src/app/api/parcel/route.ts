import { NextRequest, NextResponse } from 'next/server'
import { getParcelData } from '@/lib/geoportal'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { validateParcelId, sanitize } from '@/lib/validation'
import { createClient } from '@/lib/supabase/server'

// Rate limit: 20 wyszukiwań / minutę per user/IP
const RL_MAX = 20
const RL_WINDOW = 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parcelIdRaw = searchParams.get('parcelId')?.trim()
  const terytRaw = searchParams.get('teryt')?.trim()

  // Validation
  const parcelIdErr = validateParcelId(parcelIdRaw)
  if (parcelIdErr) {
    return NextResponse.json({ error: parcelIdErr }, { status: 400 })
  }

  const parcelId = sanitize(parcelIdRaw as string, 60)

  // TERYT z parcelId lub z parametru
  let gmina = ''
  if (terytRaw) {
    gmina = sanitize(terytRaw, 20)
  } else {
    const dotIdx = parcelId.indexOf('.')
    if (dotIdx > 0) gmina = parcelId.substring(0, dotIdx)
  }

  if (!gmina) {
    return NextResponse.json({ error: 'Nie udało się rozpoznać gminy. Podaj parametr teryt.' }, { status: 400 })
  }

  // Rate limit (try user, fallback IP)
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* anonymous OK */ }

  const rl = checkRateLimit(getRateLimitKey(userId, request), RL_MAX, RL_WINDOW)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zbyt wiele zapytań. Poczekaj chwilę.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const data = await getParcelData(parcelId, gmina)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
