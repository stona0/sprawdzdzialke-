// Zgoda na utratę prawa odstąpienia (art. 38 ust. 1 pkt 13 upk) musi poprzedzić sesję płatności
// i zostać przy niej zapisana. Stripe jest zamockowany — żadna sesja Checkout nie powstaje.
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'jan@example.com' } } }) },
  }),
}))

import { POST } from '@/app/api/payments/create-checkout/route'
import * as stripeLib from '@/lib/stripe'
import { TERMS_VERSION } from '@/lib/legal'

const body = { parcelId: '022302_2.0020.440/1', gmina: 'Długołęka', reportId: 'report-1' }
const post = (data: object) =>
  POST(new NextRequest('http://localhost/api/payments/create-checkout', { method: 'POST', body: JSON.stringify(data) }))

afterEach(() => vi.restoreAllMocks())

describe('create-checkout: zgoda przed płatnością', () => {
  it('bez zgody odrzuca żądanie i nie tworzy sesji Stripe', async () => {
    const create = vi.spyOn(stripeLib.stripe.checkout.sessions, 'create')
    for (const consent of [undefined, false, 'true']) {
      const res = await post({ ...body, withdrawalConsent: consent })
      expect(res.status).toBe(400)
    }
    expect(create).not.toHaveBeenCalled()
  })

  it('ze zgodą zapisuje wersję regulaminu i chwilę zgody w metadanych sesji', async () => {
    const create = vi.spyOn(stripeLib.stripe.checkout.sessions, 'create')
      .mockResolvedValue({ url: 'https://checkout.stripe.test/s' } as never)
    const before = Date.now()

    const res = await post({ ...body, withdrawalConsent: true })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    const metadata = create.mock.calls[0][0]!.metadata!
    expect(metadata).toMatchObject({ userId: 'user-1', reportId: 'report-1', terms_version: TERMS_VERSION })
    const at = Date.parse(String(metadata.withdrawal_waiver_at))
    expect(at).toBeGreaterThanOrEqual(before)
    expect(at).toBeLessThanOrEqual(Date.now())
  })
})
