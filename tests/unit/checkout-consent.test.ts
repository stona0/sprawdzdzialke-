// Zgoda na utratę prawa odstąpienia (art. 38 ust. 1 pkt 13 upk) musi poprzedzić sesję płatności
// i zostać przy niej zapisana. Stripe i baza są zamockowane — żadna sesja Checkout nie powstaje.
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const startCheckout = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'jan@example.com' } } }) },
  }),
  createServiceClient: async () => ({}),
}))
vi.mock('@/lib/checkout', () => ({ startCheckout: (...args: unknown[]) => startCheckout(...args) }))

import { POST } from '@/app/api/payments/create-checkout/route'
import * as stripeLib from '@/lib/stripe'
import { TERMS_VERSION } from '@/lib/legal'

const post = (data: object) =>
  POST(new NextRequest('http://localhost/api/payments/create-checkout', { method: 'POST', body: JSON.stringify(data) }))

afterEach(() => {
  vi.restoreAllMocks()
  startCheckout.mockReset()
})

describe('create-checkout: zgoda przed płatnością', () => {
  it('bez zgody odrzuca żądanie i nie zaczyna płatności', async () => {
    for (const consent of [undefined, false, 'true']) {
      const res = await post({ reportId: 'report-1', withdrawalConsent: consent })
      expect(res.status).toBe(400)
    }
    expect(startCheckout).not.toHaveBeenCalled()
  })

  it('ze zgodą przekazuje raport do startCheckout', async () => {
    startCheckout.mockResolvedValue({ ok: true, url: 'https://checkout.stripe.test/s', reused: false })

    const res = await post({ reportId: 'report-1', withdrawalConsent: true })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    expect(startCheckout.mock.calls[0][2]).toEqual({ userId: 'user-1', email: 'jan@example.com', reportId: 'report-1' })
  })
})

describe('stripeCheckout.create: ślad zgody w sesji Stripe', () => {
  it('zapisuje wersję regulaminu i chwilę zgody w metadanych', async () => {
    const create = vi.spyOn(stripeLib.stripe.checkout.sessions, 'create')
      .mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.test/s' } as never)
    const before = Date.now()

    await stripeLib.stripeCheckout.create({ userId: 'user-1', parcelId: '022302_2.0020.440/1', gmina: 'Długołęka', reportId: 'report-1', email: 'jan@example.com' })

    const metadata = create.mock.calls[0][0]!.metadata!
    expect(metadata).toMatchObject({ userId: 'user-1', reportId: 'report-1', terms_version: TERMS_VERSION })
    const at = Date.parse(String(metadata.withdrawal_waiver_at))
    expect(at).toBeGreaterThanOrEqual(before)
    expect(at).toBeLessThanOrEqual(Date.now())
  })
})
