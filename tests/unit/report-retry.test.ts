/**
 * Ponowienie nieudanego raportu (lib/report-retry.ts) — na mocku Supabase (PGlite ze schematem z repo).
 */
import type { PGlite } from '@electric-sql/pglite'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ParcelNotFoundError } from '@/lib/report/collect'
import { enqueueReport, processNextReportJob } from '@/lib/report-queue'
import { retryFailedReport } from '@/lib/report-retry'
import { createUser } from '../db/test-db.mjs'
import { E2E_USER, startMockSupabase } from '../e2e/mock-supabase.mjs'

const OTHER = { id: '22222222-2222-4222-8222-222222222222', email: 'inny@sprawdzdzialke.test' }

let mock: Awaited<ReturnType<typeof startMockSupabase>>
let svc: SupabaseClient
const pg = () => mock.db() as PGlite
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await pg().query<T>(q, params)).rows

beforeAll(async () => {
  mock = await startMockSupabase()
  svc = createClient(mock.url, 'mock-service-role-key', { auth: { persistSession: false, autoRefreshToken: false } })
  await createUser(pg(), OTHER)
})
afterAll(async () => {
  await mock.close()
})
beforeEach(async () => {
  await pg().exec('DELETE FROM report_jobs; DELETE FROM reports; UPDATE profiles SET free_reports_used = 1')
})

async function newReport({ status = 'generating', paid = true, userId = E2E_USER.id } = {}): Promise<string> {
  const [r] = await sql<{ id: string }>(
    `INSERT INTO reports (user_id, parcel_id, gmina, status, paid) VALUES ($1, '022302_2.0020.440/1', 'Długołęka', $2, $3) RETURNING id`, [userId, status, paid])
  return r.id
}
/** Raport, którego generowanie ostatecznie padło (działka nie istnieje → bez ponowień kolejki). */
async function failedReport(freeSlot: boolean): Promise<string> {
  const id = await newReport()
  await enqueueReport(svc, id, { freeSlot })
  const r = await processNextReportJob(svc, { reportId: id, build: async () => { throw new ParcelNotFoundError('x') } })
  expect(r.outcome).toBe('failed')
  return id
}
const freeUsed = async () => (await sql<{ free_reports_used: number }>('SELECT free_reports_used FROM profiles WHERE user_id = $1', [E2E_USER.id]))[0].free_reports_used
const job = async (id: string) => (await sql<{ status: string; attempts: number; free_slot: boolean }>('SELECT status, attempts, free_slot FROM report_jobs WHERE report_id = $1', [id]))[0]
const reportStatus = async (id: string) => (await sql<{ status: string }>('SELECT status FROM reports WHERE id = $1', [id]))[0].status
const retry = (reportId: string, userId = E2E_USER.id) => retryFailedReport(svc, { reportId, userId })

describe('ponowienie nieudanego raportu', () => {
  it('opłacony raport wraca do kolejki od zera, bez ruszania darmowej puli', async () => {
    const id = await failedReport(false)
    expect(await retry(id)).toEqual({ ok: true })
    expect(await reportStatus(id)).toBe('generating')
    expect(await job(id)).toMatchObject({ status: 'queued', attempts: 0, free_slot: false })
    expect(await freeUsed()).toBe(1)
  })

  it('darmowy raport: zwrócona przy porażce pula zostaje zajęta z powrotem', async () => {
    const id = await failedReport(true)
    expect(await freeUsed()).toBe(0) // kolejka oddała darmowy raport
    expect(await retry(id)).toEqual({ ok: true })
    expect(await freeUsed()).toBe(1)
    expect(await job(id)).toMatchObject({ status: 'queued', free_slot: true })
  })

  it('darmowy raport, pula zużyta w międzyczasie: ponowienie bez opłaty, ale kolejna porażka nie oddaje drugiego darmowego', async () => {
    const id = await failedReport(true)
    await sql('UPDATE profiles SET free_reports_used = 1 WHERE user_id = $1', [E2E_USER.id]) // inny darmowy raport
    expect(await retry(id)).toEqual({ ok: true })
    expect(await job(id)).toMatchObject({ status: 'queued', free_slot: false })

    await sql(`UPDATE report_jobs SET run_after = NOW() - interval '1 second' WHERE report_id = $1`, [id])
    const again = await processNextReportJob(svc, { reportId: id, build: async () => { throw new ParcelNotFoundError('x') } })
    expect(again.outcome).toBe('failed')
    expect(await freeUsed()).toBe(1)
  })

  it('raport w innym stanie niż „failed” → 409', async () => {
    for (const status of ['completed', 'pending']) {
      const id = await newReport({ status, paid: status === 'completed' })
      expect(await retry(id)).toMatchObject({ ok: false, status: 409 })
      expect(await reportStatus(id)).toBe(status)
    }
    const generating = await newReport()
    await enqueueReport(svc, generating, { freeSlot: false })
    expect(await retry(generating)).toMatchObject({ ok: false, status: 409 })
  })

  it('nieopłacony raport ze statusem „failed” → 409', async () => {
    const id = await newReport({ status: 'failed', paid: false })
    expect(await retry(id)).toMatchObject({ ok: false, status: 409 })
  })

  it('cudzy raport → 404', async () => {
    const id = await failedReport(false)
    expect(await retry(id, OTHER.id)).toMatchObject({ ok: false, status: 404 })
    expect(await reportStatus(id)).toBe('failed')
  })

  it('dwa równoczesne kliknięcia → jedno ponowienie', async () => {
    const id = await failedReport(true)
    const results = await Promise.all([retry(id), retry(id)])
    expect(results.filter(r => r.ok)).toHaveLength(1)
    expect(results.find(r => !r.ok)).toMatchObject({ status: 409 })
    expect(await freeUsed()).toBe(1)
    expect(await job(id)).toMatchObject({ status: 'queued', free_slot: true })
  })
})
