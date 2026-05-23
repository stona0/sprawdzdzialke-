import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { MPZPResult } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
  }

  const body: { result: MPZPResult; gmina_teryt: string; source_pdf_url?: string } =
    await request.json()

  const { result, gmina_teryt, source_pdf_url } = body

  if (!result?.tereny?.length || !gmina_teryt) {
    return NextResponse.json({ error: 'Brak danych do zapisu' }, { status: 400 })
  }

  const supabaseService = await createServiceClient()

  // Upsert – jeden wiersz na symbol terenu
  const rows = result.tereny.map(t => ({
    gmina_teryt,
    symbol_terenu: t.symbol,
    przeznaczenie: t.przeznaczenie_podstawowe ?? null,
    wysokosc_max: t.wysokosc_max_m ?? null,
    pbc_min: t.powierzchnia_biologicznie_czynna_min_procent ?? null,
    typ_dachu: t.typ_dachu ?? null,
    source_pdf_url: source_pdf_url ?? null,
    parsed_at: new Date().toISOString(),
  }))

  const { error } = await supabaseService
    .from('mpzp_cache')
    .upsert(rows, { onConflict: 'gmina_teryt,symbol_terenu' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: rows.length })
}
