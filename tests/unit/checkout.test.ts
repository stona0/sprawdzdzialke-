/**
 * Rozpoczęcie płatności (lib/checkout.ts) — bez podwójnego obciążenia. Mock Supabase (PGlite),
 * Stripe podstawiony; żadnych połączeń z prawdziwym Stripe.
 */
import type { PGlite } from '@electric-sql/pglite'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startCheckout, type CheckoutStripe } from '@/lib/checkout'
import { createUser } from '../db/test-db.mjs'
import { E2E_USER, startMockSupabase } from '../e2e/mock-supabase.mjs'

const OTHER = { id: '33333333-3333-4333-8333-333333333333', email: 'drugi@sprawdzdzialke.test' }
const PARCEL = '021303_4.0001.AR_18.19/9'

let mock: Awaited<ReturnType<typeof startMockSupabase>>
let svc: SupabaseClient
const pg = () => mock.db() as PGlite
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await pg().query<T>(q, params)).rows

let stripe: { retrieve: ReturnType<typeof vi.fn<CheckoutStripe['retrieve']>>; create: ReturnType<typeof vi.fn<CheckoutStripe['create']>> }
let seq = 0

beforeAll(async () => {
  mock = await startMockSupabase()
  svc = createClient(mock.url, 'mock-service-role-key', { auth: { persistSession: false, autoRefreshToken: false } })
  await createUser(pg(), OTHER)
})
afterAll(async () => {
  await mock.close()
})
beforeEach(async () => {
  await pg().exec('DELETE FROM payments; DELETE FROM reports')
  stripe = {
    retrieve: vi.fn<CheckoutStripe['retrieve']>(),
    create: vi.fn<CheckoutStripe['create']>(async () => { seq++; return { id: `cs_test_${seq}`, url: `https://checkout.test/${seq}` } }),
  }
})

async function newReport({ status = 'pending', paid = false, userId = E2E_USER.id } = {}): Promise<string> {
  const [r] = await sql<{ id: string }>(
    `INSERT INTO reports (user_id, parcel_id, gmina, status, paid) VALUES ($1, $2, 'Milicz', $3, $4) RETURNING id`, [userId, PARCEL, status, paid])
  return r.id
}
const start = (reportId: string, userId = E2E_USER.id) => startCheckout(svc, stripe, { userId, email: E2E_USER.email, reportId })
const payments = async (reportId: string) => sql<{ stripe_session_id: string; status: string; amount: string }>(
  'SELECT stripe_session_id, status, amount FROM payments WHERE report_id = $1 ORDER BY created_at', [reportId])

describe('płatność za raport', () => {
  it('pierwsza płatność tworzy sesję z danymi raportu z bazy i zapisuje ją jako „pending”', async () => {
    const id = await newReport()
    const r = await start(id)
    expect(r).toMatchObject({ ok: true, reused: false })
    expect(stripe.create).toHaveBeenCalledWith({ userId: E2E_USER.id, parcelId: PARCEL, gmina: 'Milicz', reportId: id, email: E2E_USER.email })
    expect(await payments(id)).toEqual([expect.objectContaining({ status: 'pending', amount: '29' })])
  })

  it('otwarta sesja jest używana ponownie — drugie kliknięcie nie tworzy drugiej', async () => {
    const id = await newReport()
    const first = await start(id)
    stripe.retrieve.mockResolvedValue({ status: 'open', url: first.ok ? first.url : null })
    const second = await start(id)
    expect(second).toEqual({ ok: true, url: first.ok && first.url, reused: true })
    expect(stripe.create).toHaveBeenCalledTimes(1)
    expect(await payments(id)).toHaveLength(1)
  })

  it('sesja opłacona, webhook jeszcze nie doszedł → 409, bez nowej sesji', async () => {
    const id = await newReport()
    await start(id)
    stripe.retrieve.mockResolvedValue({ status: 'complete', url: null })
    expect(await start(id)).toMatchObject({ ok: false, status: 409 })
    expect(stripe.create).toHaveBeenCalledTimes(1)
  })

  it('wygasła sesja → oznaczona jako nieudana, nowa sesja', async () => {
    const id = await newReport()
    await start(id)
    stripe.retrieve.mockResolvedValue({ status: 'expired', url: null })
    expect(await start(id)).toMatchObject({ ok: true, reused: false })
    expect((await payments(id)).map(p => p.status)).toEqual(['failed', 'pending'])
  })

  it('błąd Stripe przy sprawdzaniu poprzedniej sesji → 502, bez nowej sesji', async () => {
    const id = await newReport()
    await start(id)
    stripe.retrieve.mockRejectedValue(new Error('Stripe: timeout'))
    expect(await start(id)).toMatchObject({ ok: false, status: 502 })
    expect(stripe.create).toHaveBeenCalledTimes(1)
  })

  it('płatność już zapisana przez webhook → 409, bez pytania Stripe', async () => {
    const id = await newReport()
    await sql(`INSERT INTO payments (user_id, report_id, stripe_session_id, amount, status) VALUES ($1, $2, 'cs_paid', 29, 'paid')`, [E2E_USER.id, id])
    expect(await start(id)).toMatchObject({ ok: false, status: 409 })
    expect(stripe.retrieve).not.toHaveBeenCalled()
    expect(stripe.create).not.toHaveBeenCalled()
  })

  it('raport gotowy, generowany albo opłacony → 409; cudzy → 404', async () => {
    for (const [status, paid] of [['completed', true], ['generating', true], ['pending', true]] as const) {
      expect(await start(await newReport({ status, paid }))).toMatchObject({ ok: false, status: 409 })
    }
    expect(await start(await newReport({ userId: OTHER.id }))).toMatchObject({ ok: false, status: 404 })
    expect(stripe.create).not.toHaveBeenCalled()
  })
})
