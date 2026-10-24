// /auth/callback na Netlify dostaje request.url z hostem wdrożenia (<id>--testdzialki.netlify.app).
// Przekierowanie po zalogowaniu nie może prowadzić na ten host — tam nie ma cookies sesji.
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const exchange = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { exchangeCodeForSession: exchange } }) }))

import { GET } from '@/app/auth/callback/route'

const DEPLOY_HOST = 'https://6adc5efdf61227b31d2f99d5--testdzialki.netlify.app'
const get = (query: string) => GET(new NextRequest(`${DEPLOY_HOST}/auth/callback${query}`))

describe('/auth/callback: przekierowania względne', () => {
  it('po udanej wymianie kodu przechodzi do next bez zmiany hosta', async () => {
    exchange.mockResolvedValueOnce({ error: null })
    const res = await get('?code=abc&next=%2Freport%2F1')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('/report/1')
  })

  it('domyślnie /dashboard', async () => {
    exchange.mockResolvedValueOnce({ error: null })
    expect((await get('?code=abc')).headers.get('location')).toBe('/dashboard')
  })

  it('błędy prowadzą na /login na tym samym hoście', async () => {
    exchange.mockResolvedValueOnce({ error: { code: 'flow_state_not_found', message: 'x' } })
    expect((await get('?code=abc')).headers.get('location')).toBe('/login?error=flow_state_not_found')
    expect((await get('?error=access_denied')).headers.get('location')).toBe('/login?error=access_denied')
    expect((await get('')).headers.get('location')).toBe('/login?error=auth_callback_failed')
  })
})
