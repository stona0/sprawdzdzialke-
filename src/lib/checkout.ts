/**
 * Rozpoczęcie płatności za raport — tak, żeby ten sam raport nie został opłacony dwa razy.
 *
 * Każdą utworzoną sesję Stripe Checkout zapisujemy w `payments` ze statusem „pending”
 * (webhook zmienia go na „paid”). Przed utworzeniem nowej sesji sprawdzamy poprzednie:
 *  - otwarta → oddajemy jej adres (dwa kliknięcia albo dwie karty = jedna sesja),
 *  - zakończona, a webhook jeszcze nie doszedł → nie pozwalamy płacić drugi raz,
 *  - wygasła → można utworzyć nową.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { REPORT_PRICE_PLN } from './pricing'

/** Wycinek API Stripe potrzebny tutaj — w testach podstawiany. */
export interface CheckoutStripe {
  retrieve(sessionId: string): Promise<{ status: 'open' | 'complete' | 'expired' | null; url: string | null }>
  create(input: { userId: string; parcelId: string; gmina: string; reportId: string; email: string }): Promise<{ id: string; url: string }>
}

export type CheckoutResult =
  | { ok: true; url: string; reused: boolean }
  | { ok: false; status: 404 | 409 | 502; error: string }

const PAID_MESSAGE = 'Płatność za ten raport została już przyjęta — raport zacznie się generować automatycznie.'

export async function startCheckout(
  svc: SupabaseClient,
  stripe: CheckoutStripe,
  { userId, email, reportId }: { userId: string; email: string; reportId: string },
): Promise<CheckoutResult> {
  const { data: report } = await svc
    .from('reports')
    .select('id, parcel_id, gmina, status, paid')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!report) return { ok: false, status: 404, error: 'Nie znaleziono raportu' }
  if (report.status === 'completed') return { ok: false, status: 409, error: 'Ten raport jest już gotowy.' }
  if (report.paid || report.status === 'generating') return { ok: false, status: 409, error: PAID_MESSAGE }
  if (report.status !== 'pending') return { ok: false, status: 409, error: 'Ten raport nie czeka na płatność.' }

  const { data: payments } = await svc
    .from('payments')
    .select('stripe_session_id, status')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
  if (payments?.some(p => p.status === 'paid')) return { ok: false, status: 409, error: PAID_MESSAGE }

  for (const p of payments?.filter(x => x.status === 'pending') ?? []) {
    let session: Awaited<ReturnType<CheckoutStripe['retrieve']>>
    try {
      session = await stripe.retrieve(p.stripe_session_id)
    } catch (err) {
      // Bez pewności, że poprzednia sesja nie została opłacona, nie tworzymy nowej.
      console.error('[checkout] nie udało się sprawdzić sesji', p.stripe_session_id, err)
      return { ok: false, status: 502, error: 'Nie udało się sprawdzić wcześniejszej płatności. Spróbuj za chwilę.' }
    }
    if (session.status === 'complete') {
      return { ok: false, status: 409, error: 'Płatność przyjęta — czekamy na potwierdzenie od operatora. Raport ruszy automatycznie.' }
    }
    if (session.status === 'open' && session.url) return { ok: true, url: session.url, reused: true }
    if (session.status === 'expired') {
      await svc.from('payments').update({ status: 'failed' }).eq('stripe_session_id', p.stripe_session_id).eq('status', 'pending')
    }
  }

  const created = await stripe.create({ userId, parcelId: report.parcel_id, gmina: report.gmina, reportId, email })
  const { error } = await svc.from('payments').insert({
    user_id: userId,
    report_id: reportId,
    stripe_session_id: created.id,
    amount: REPORT_PRICE_PLN,
    status: 'pending',
  })
  // Sesja już istnieje — użytkownik może zapłacić; tracimy tylko ochronę przed drugą sesją.
  if (error) console.error('[checkout] nie zapisano sesji w payments:', error.message)
  return { ok: true, url: created.url, reused: false }
}
