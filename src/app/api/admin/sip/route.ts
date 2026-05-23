import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = await createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return profile?.role === 'admin' ? service : null
}

export async function GET() {
  const service = await assertAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await service
    .from('sip_layers')
    .select('*')
    .order('gmina_nazwa')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const service = await assertAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const payload = await request.json()
  const { error } = await service.from('sip_layers').insert(payload)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PUT(request: NextRequest) {
  const service = await assertAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...payload } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await service.from('sip_layers').update(payload).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const service = await assertAdmin()
  if (!service) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await service.from('sip_layers').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
