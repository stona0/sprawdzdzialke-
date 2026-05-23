import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
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

  const supabaseService = await createServiceClient()

  // Pobierz liczbę symboli i datę ostatniej aktualizacji dla każdej gminy
  const { data, error } = await supabaseService
    .from('mpzp_cache')
    .select('gmina_teryt, parsed_at')
    .order('gmina_teryt')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Grupuj po gmina_teryt
  const grouped: Record<string, { symbole: number; last_updated: string | null }> = {}

  for (const row of data ?? []) {
    const teryt = row.gmina_teryt
    if (!grouped[teryt]) {
      grouped[teryt] = { symbole: 0, last_updated: null }
    }
    grouped[teryt].symbole++
    if (!grouped[teryt].last_updated || row.parsed_at > grouped[teryt].last_updated!) {
      grouped[teryt].last_updated = row.parsed_at
    }
  }

  const result = Object.entries(grouped).map(([teryt, stats]) => ({
    teryt,
    symbole: stats.symbole,
    last_updated: stats.last_updated,
  }))

  return NextResponse.json(result)
}
