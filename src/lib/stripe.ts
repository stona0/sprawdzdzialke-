import Stripe from 'stripe'
import { TERMS_VERSION } from '@/lib/legal'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'placeholder', {
  apiVersion: '2026-04-22.dahlia',
})

export const REPORT_PRICE_PLN = 29
export const REPORT_PRICE_GROSZ = REPORT_PRICE_PLN * 100

export async function createCheckoutSession(
  userId: string,
  parcelId: string,
  gmina: string,
  reportId: string,
  userEmail: string,
  consentAt: Date,
): Promise<string> {
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

  return session.url!
}

export async function verifyPayment(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  return {
    paid: session.payment_status === 'paid',
    metadata: session.metadata,
  }
}
