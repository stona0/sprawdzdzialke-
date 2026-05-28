import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
  }

  const supabaseService = await createServiceClient()
  const { data: report } = await supabaseService
    .from('reports')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Nie znaleziono raportu' }, { status: 404 })
  }

  return NextResponse.json({ reportId: report.id, status: report.status })
}
