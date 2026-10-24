import Stripe from 'stripe'
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
  userEmail: string
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
    metadata: {
      userId,
      parcelId,
      gmina,
      reportId,
    },
  })

  return { id: session.id, url: session.url! }
}

export const stripeCheckout: CheckoutStripe = {
  retrieve: async id => {
    const s = await stripe.checkout.sessions.retrieve(id)
    return { status: s.status, url: s.url }
  },
  create: ({ userId, parcelId, gmina, reportId, email }) => createCheckoutSession(userId, parcelId, gmina, reportId, email),
}

export async function verifyPayment(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  return {
    paid: session.payment_status === 'paid',
    metadata: session.metadata,
  }
}
