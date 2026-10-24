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
  report_jobs: Array<{ report_id: string; status: string; attempts: number; free_slot: boolean }>
  source_cache: Array<{ key: string }>
}
const mockDb = async (): Promise<MockDb> => (await fetch(`${MOCK}/__mock/db`)).json()
const mockSql = async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
  const res = await fetch(`${MOCK}/__mock/sql`, { method: 'POST', body: JSON.stringify({ sql, params }) })
  if (!res.ok) throw new Error(`mock sql: ${await res.text()}`)
  return res.json()
}

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
  // tytuł sekcji — „Podsumowanie” występuje też w „Podstawa: …” przy rekomendacjach
  await expect(report.locator('.section-title', { hasText: 'Podsumowanie' })).toBeVisible()
  await expect(report.getByText('Działka objęta miejscowym planem (MPZP)')).toBeVisible()
  await expect(report.getByText('Źródła danych i ich status')).toBeVisible()

  let db = await mockDb()
  expect(db.profiles[0].free_reports_used).toBe(1)
  expect(db.reports).toHaveLength(1)
  expect(db.reports[0]).toMatchObject({ parcel_id: FREE_PARCEL, status: 'completed', paid: true })
  // Raport przeszedł przez kolejkę, a wyniki źródeł trafiły do trwałego cache
  expect(db.report_jobs).toEqual([expect.objectContaining({ report_id: db.reports[0].id, status: 'done', attempts: 1, free_slot: true })])
  const keys = db.source_cache.map(c => c.key)
  expect(keys).toEqual(expect.arrayContaining([`v1:uldk:${FREE_PARCEL}`, `v1:kimpzp:${FREE_PARCEL}`, `v1:gdos:${FREE_PARCEL}`, `v1:isok:${FREE_PARCEL}`]))

  // 3. Drugi raport wymaga płatności
  await page.goto('/dashboard')
  await expect(page.getByText('Każdy raport kosztuje 29 zł.')).toBeVisible()
  await searchParcel(page, PAID_PARCEL)
  await page.getByRole('button', { name: 'Kup raport — 29 zł' }).click()
  await expect(page.getByRole('dialog').getByText('Kup raport – 29 zł')).toBeVisible()
  // Bez zgody na utratę prawa odstąpienia nie da się przejść do płatności
  const pay = page.getByRole('dialog').getByRole('button', { name: 'Zapłać 29 zł' })
  await expect(pay).toBeDisabled()
  await page.getByRole('dialog').getByRole('checkbox').check()
  await expect(pay).toBeEnabled()
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
  expect((await mockDb()).report_jobs.find(j => j.report_id === pending.id)).toMatchObject({ status: 'done', free_slot: false })

  // Ponowny webhook (Stripe ponawia) nie generuje raportu drugi raz
  const again = await request.post('/api/payments/webhook', { data: payload, headers: { 'stripe-signature': signature, 'content-type': 'application/json' } })
  expect(again.status()).toBe(200)
  expect((await mockDb()).payments).toHaveLength(1)

  await page.goto(`/report/${pending.id}`)
  const paidReport = page.frameLocator('iframe')
  await expect(paidReport.getByText(/Dolina Baryczy/).first()).toBeVisible()
  await expect(paidReport.locator('.section-title', { hasText: 'Ochrona przyrody' })).toBeVisible()
})

test('moje raporty: „Zapłać” przy raporcie bez płatności, bez drugiej płatności za gotowy, „Spróbuj ponownie” przy błędzie', async ({ page }) => {
  await login(page)
  const insert = async (parcelId: string, gmina: string, status: string, paid: boolean) =>
    (await mockSql<{ id: string }>(
      'INSERT INTO reports (user_id, parcel_id, gmina, status, paid) VALUES ($1, $2, $3, $4, $5) RETURNING id', [USER.id, parcelId, gmina, status, paid]))[0].id
  await insert(PAID_PARCEL, 'Milicz', 'pending', false)
  const completed = await insert(PAID_PARCEL, 'Milicz', 'completed', true)
  const failed = await insert(FREE_PARCEL, 'Długołęka', 'failed', true)
  await page.goto('/dashboard')

  // „Zapłać” otwiera ten sam dialog co przy nowym raporcie (bez sesji Stripe — klucz w e2e jest fałszywy)
  const pendingItem = page.getByRole('listitem').filter({ hasText: 'Czeka na płatność' })
  await pendingItem.getByRole('button', { name: 'Zapłać 29 zł' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Anuluj' }).click()

  // Serwer nie zaczyna płatności za raport, który już jest gotowy
  const again = await page.request.post('/api/payments/create-checkout', { data: { reportId: completed } })
  expect(again.status()).toBe(409)

  // Ponowienie nieudanego raportu — bez opłaty, raport przechodzi przez kolejkę od nowa
  await page.getByRole('listitem').filter({ hasText: 'Nie udało się' }).getByRole('button', { name: 'Spróbuj ponownie' }).click()
  await page.waitForURL(`**/report/${failed}`)
  expect((await waitForReport(failed)).status).toBe('completed')
  expect((await mockDb()).report_jobs.find(j => j.report_id === failed)).toMatchObject({ status: 'done', free_slot: false })
})

/** Raport „w trakcie”, którego worker zginął: zadanie zajęte, dzierżawa już wygasła. */
async function orphanedReport(parcelId: string): Promise<string> {
  const [r] = await mockSql<{ id: string }>(
    `INSERT INTO reports (user_id, parcel_id, gmina, status, paid) VALUES ($1, $2, 'Długołęka', 'generating', true) RETURNING id`, [USER.id, parcelId])
  await mockSql('SELECT enqueue_report_job($1, false)', [r.id])
  await mockSql('SELECT claim_report_job($1, 90)', [r.id])
  await mockSql(`UPDATE report_jobs SET locked_until = NOW() - interval '1 second' WHERE report_id = $1`, [r.id])
  return r.id
}

test('przerwane generowanie: strona raportu wznawia zadanie, dane źródeł z cache', async ({ page }) => {
  await login(page)
  const id = await orphanedReport(FREE_PARCEL)
  const t0 = Date.now()
  await page.goto(`/report/${id}`) // render strony wykrywa zadanie bez workera i uruchamia je w after()
  const done = await waitForReport(id, 120_000)
  const ms = Date.now() - t0
  console.log(`[e2e] wznowiony raport gotowy po ${ms} ms`)
  expect(done.status).toBe('completed')
  expect((await mockDb()).report_jobs.find(j => j.report_id === id)).toMatchObject({ status: 'done', attempts: 2 })
  await expect(page.frameLocator('iframe').getByText('Źródła danych i ich status')).toBeVisible({ timeout: 30_000 })
})

test('cron: bez sekretu 401, z sekretem wykonuje zaległe zadania', async ({ request }) => {
  expect((await request.get('/api/cron/report-jobs')).status()).toBe(401)
  expect((await request.get('/api/cron/report-jobs', { headers: { authorization: 'Bearer zly' } })).status()).toBe(401)

  const id = await orphanedReport(FREE_PARCEL)
  const res = await request.get('/api/cron/report-jobs', { headers: { authorization: 'Bearer e2e-cron-secret' } })
  expect(res.status()).toBe(200)
  expect((await waitForReport(id, 120_000)).status).toBe('completed')
})
