import { defineConfig } from '@playwright/test'

const PORT = 3100
const MOCK = 54329

/**
 * E2E na lokalnym mocku Supabase (tests/e2e/mock-supabase.mjs) i fałszywych kluczach
 * Stripe — test nie dotyka produkcyjnej bazy ani konta Stripe. Usługi państwowe
 * (ULDK, GDOŚ, ISOK, KIUT…) i Claude są wołane naprawdę.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: 'node tests/e2e/mock-supabase.mjs',
      url: `http://127.0.0.1:${MOCK}/__mock/db`,
      env: { MOCK_SUPABASE_PORT: String(MOCK) },
      reuseExistingServer: false,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
        STRIPE_SECRET_KEY: 'sk_test_mock_e2e',
        STRIPE_WEBHOOK_SECRET: 'whsec_e2e_mock',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_e2e',
        NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
        CRON_SECRET: 'e2e-cron-secret',
      },
    },
  ],
})

export const MOCK_URL = `http://127.0.0.1:${MOCK}`
