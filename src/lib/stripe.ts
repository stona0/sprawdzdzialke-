import Stripe from 'stripe'
import { TERMS_VERSION } from '@/lib/legal'
import type { CheckoutStripe } from './checkout'
import { REPORT_PRICE_GROSZ } from './pricing'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'placeholder', {
  apiVersion: '2026-04-22.dahlia',
})

export async function createCheckoutSession(
  userId: string,
  parcelId: string,
  gmina: string,
  reportId: string,
  userEmail: string,
  consentAt: Date,
): Promise<{ id: string; url: string }> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'blik', 'p24'],
    line_items: [
      {
        price_data: {
          currency: 'pln',
          product_data: {
            name: `Raport działki ${parcelId}`,
            description: `Analiza planistyczna działki ${parcelId} w gminie ${gmina}`,
          },
          unit_amount: REPORT_PRICE_GROSZ,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer_email: userEmail,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&report=${reportId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=cancelled`,
    // Zgoda na regulamin i utratę prawa odstąpienia zapisana po stronie serwera, przy sesji płatności
    metadata: {
      userId,
      parcelId,
      gmina,
      reportId,
      terms_version: TERMS_VERSION,
      withdrawal_waiver_at: consentAt.toISOString(),
    },
  })

  return { id: session.id, url: session.url! }
}

export const stripeCheckout: CheckoutStripe = {
  retrieve: async id => {
    const s = await stripe.checkout.sessions.retrieve(id)
    return { status: s.status, url: s.url }
  },
  // Sesję tworzy tylko trasa create-checkout, i to dopiero po sprawdzeniu zgody na utratę prawa
  // odstąpienia — chwila utworzenia sesji jest więc chwilą zgody.
  create: ({ userId, parcelId, gmina, reportId, email }) => createCheckoutSession(userId, parcelId, gmina, reportId, email, new Date()),
}

export async function verifyPayment(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  return {
    paid: session.payment_status === 'paid',
    metadata: session.metadata,
  }
}
