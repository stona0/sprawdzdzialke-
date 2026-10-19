import { expect, test, type Page } from '@playwright/test'
import Stripe from 'stripe'

const MOCK = 'http://127.0.0.1:54329'
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'e2e@sprawdzdzialke.test', password: 'e2e-haslo-testowe' }
const FREE_PARCEL = '022302_2.0020.440/1'      // Długołęka / Kiełczów
const PAID_PARCEL = '021303_4.0001.AR_18.19/9'  // Milicz — Natura 2000

interface MockDb {
  profiles: Array<{ user_id: string; free_reports_used: number }>
  reports: Array<{ id: string; parcel_id: string; gmina: string; status: string; paid: boolean; html_content: string | null }>
  payments: Array<{ report_id: string; stripe_session_id: string }>
}
const mockDb = async (): Promise<MockDb> => (await fetch(`${MOCK}/__mock/db`)).json()

async function waitForReport(reportId: string, timeoutMs = 180_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const r = (await mockDb()).reports.find(x => x.id === reportId)
    if (r && (r.status === 'completed' || r.status === 'failed')) return r
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`Raport ${reportId} nie zakończył się w ${timeoutMs} ms`)
}

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(USER.email)
  await page.locator('input[type="password"]').fill(USER.password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL('**/dashboard')
}

async function searchParcel(page: Page, id: string) {
  await page.getByLabel('Identyfikator działki (EGB)').fill(id)
  await page.getByRole('button', { name: 'Sprawdź działkę' }).click()
  await expect(page.getByText('Działka znaleziona w Geoportal')).toBeVisible({ timeout: 30_000 })
}

test.beforeAll(async () => {
  await fetch(`${MOCK}/__mock/reset`)
})

test('niezalogowany użytkownik jest przekierowany na logowanie', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/)
})

test('błędny identyfikator działki → czytelny komunikat', async ({ page }) => {
  await login(page)
  await page.getByLabel('Identyfikator działki (EGB)').fill('bez-kropek')
  await page.getByRole('button', { name: 'Sprawdź działkę' }).click()
  await expect(page.getByText(/Musi zawierać kropki/)).toBeVisible()
  await page.getByLabel('Identyfikator działki (EGB)').fill('999999_9.9999.1')
  await page.getByRole('button', { name: 'Sprawdź działkę' }).click()
  await expect(page.getByText(/Nie znaleziono działki/)).toBeVisible({ timeout: 30_000 })
})

test('pełna ścieżka: logowanie → działka → darmowy raport → płatny raport po webhooku Stripe', async ({ page, request }) => {
  await login(page)
  await expect(page.getByText('Masz 1 darmowy raport')).toBeVisible()

  // 1. Wyszukanie działki w ULDK i podgląd
  await searchParcel(page, FREE_PARCEL)
  await expect(page.getByText('Długołęka').first()).toBeVisible()
  await expect(page.getByText('Kiełczów').first()).toBeVisible()

  // 2. Darmowy raport generowany w tle (after()), klient polluje status
  await page.getByRole('button', { name: 'Generuj darmowy raport' }).click()
  await page.waitForURL(/\/report\/[0-9a-f-]{36}$/, { timeout: 200_000 })
  const report = page.frameLocator('iframe')
  await expect(report.getByText('Podsumowanie')).toBeVisible()
  await expect(report.getByText('Działka objęta miejscowym planem (MPZP)')).toBeVisible()
  await expect(report.getByText('Źródła danych i ich status')).toBeVisible()

  let db = await mockDb()
  expect(db.profiles[0].free_reports_used).toBe(1)
  expect(db.reports).toHaveLength(1)
  expect(db.reports[0]).toMatchObject({ parcel_id: FREE_PARCEL, status: 'completed', paid: true })

  // 3. Drugi raport wymaga płatności
  await page.goto('/dashboard')
  await expect(page.getByText('Każdy raport kosztuje 29 PLN.')).toBeVisible()
  await searchParcel(page, PAID_PARCEL)
  await page.getByRole('button', { name: 'Kup raport — 29 PLN' }).click()
  await expect(page.getByRole('dialog').getByText('Kup raport – 29 PLN')).toBeVisible()
  await page.getByRole('button', { name: 'Anuluj' }).click()

  db = await mockDb()
  const pending = db.reports.find(r => r.parcel_id === PAID_PARCEL)!
  expect(pending).toMatchObject({ status: 'pending', paid: false, html_content: null })

  // 4. Webhook Stripe: zła sygnatura odrzucona, poprawna uruchamia generowanie
  const payload = JSON.stringify({
    id: 'evt_e2e_1', object: 'event', type: 'checkout.session.completed', api_version: '2026-04-22.dahlia',
    data: { object: { id: 'cs_test_e2e_1', object: 'checkout.session', amount_total: 2900, payment_status: 'paid',
      metadata: { userId: USER.id, parcelId: PAID_PARCEL, gmina: pending.gmina, reportId: pending.id } } },
  })
  const bad = await request.post('/api/payments/webhook', { data: payload, headers: { 'stripe-signature': 't=1,v1=bad', 'content-type': 'application/json' } })
  expect(bad.status()).toBe(400)

  const signature = new Stripe('sk_test_mock_e2e').webhooks.generateTestHeaderString({ payload, secret: 'whsec_e2e_mock' })
  const ok = await request.post('/api/payments/webhook', { data: payload, headers: { 'stripe-signature': signature, 'content-type': 'application/json' } })
  expect(ok.status()).toBe(200)

  const paid = await waitForReport(pending.id)
  expect(paid.status).toBe('completed')
  expect((await mockDb()).payments.map(p => p.stripe_session_id)).toContain('cs_test_e2e_1')

  // Ponowny webhook (Stripe ponawia) nie generuje raportu drugi raz
  const again = await request.post('/api/payments/webhook', { data: payload, headers: { 'stripe-signature': signature, 'content-type': 'application/json' } })
  expect(again.status()).toBe(200)
  expect((await mockDb()).payments).toHaveLength(1)

  await page.goto(`/report/${pending.id}`)
  const paidReport = page.frameLocator('iframe')
  await expect(paidReport.getByText(/Dolina Baryczy/).first()).toBeVisible()
  await expect(paidReport.locator('.section-title', { hasText: 'Ochrona przyrody' })).toBeVisible()
})
