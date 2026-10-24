import { expect, test, type Page } from '@playwright/test'

/** Logowanie bez usług zewnętrznych: mock Supabase (tests/e2e/mock-supabase.mjs), Google wyłączony jak na stagingu. */
const USER = { email: 'e2e@sprawdzdzialke.test', password: 'e2e-haslo-testowe' }
// Next ma własny pusty role="alert" (ogłaszanie zmiany trasy) — komunikat formularza to <p>.
const alert = (page: Page) => page.locator('p[role="alert"]')

test('błędne hasło → komunikat po polsku', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(USER.email)
  await page.locator('input[type="password"]').fill('zle-haslo')
  await page.locator('form button[type="submit"]').click()
  await expect(alert(page)).toHaveText('Nieprawidłowy e-mail lub hasło.')
})

test('po zalogowaniu wraca na stronę z ?redirectTo=, a nie zawsze do panelu', async ({ page }) => {
  await page.goto('/login?redirectTo=%2Fpricing')
  await page.locator('input[type="email"]').fill(USER.email)
  await page.locator('input[type="password"]').fill(USER.password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL('**/pricing')
})

test('?redirectTo= na obcą domenę jest ignorowane', async ({ page }) => {
  await page.goto('/login?redirectTo=%2F%2Fevil.example')
  await page.locator('input[type="email"]').fill(USER.email)
  await page.locator('input[type="password"]').fill(USER.password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL('**/dashboard')
  expect(new URL(page.url()).host).toBe('localhost:3100')
})

test('Google wyłączony w Supabase → komunikat zamiast surowego błędu na supabase.co', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Kontynuuj z Google' }).click()
  await expect(alert(page)).toContainText('Logowanie przez Google jest chwilowo niedostępne')
  expect(new URL(page.url()).host).toBe('localhost:3100')
})

test('callback z błędem od dostawcy (anulowana zgoda) → /login z komunikatem', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=The+user+denied+access')
  await expect(page).toHaveURL(/\/login\?error=access_denied$/)
  await expect(alert(page)).toHaveText('Logowanie przez Google zostało przerwane.')
})

test('callback z ?next= na obcą domenę zostaje w serwisie', async ({ request }) => {
  const res = await request.get('/auth/callback?code=nieprawidlowy&next=%2F%2Fevil.example', { maxRedirects: 0 })
  expect(res.status()).toBe(307)
  const location = new URL(res.headers().location)
  expect(location.host).toBe('localhost:3100')
  expect(location.pathname).toBe('/login')
})

test('reset hasła bez sesji (link wygasł) → prośba o nowy link', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(alert(page)).toContainText('Poproś o nowy link')
  await expect(page.getByRole('link', { name: 'Wyślij nowy link' })).toHaveAttribute('href', '/forgot-password')
})
