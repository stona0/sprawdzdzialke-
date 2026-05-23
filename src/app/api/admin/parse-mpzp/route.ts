import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseMPZP } from '@/lib/anthropic'

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

  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File
    const gmina = formData.get('gmina') as string

    if (!file || !gmina) {
      return NextResponse.json({ error: 'Brak pliku PDF lub nazwy gminy' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const pdfBase64 = Buffer.from(buffer).toString('base64')

    const result = await parseMPZP(pdfBase64, gmina)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd parsowania'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
