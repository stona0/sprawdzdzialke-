/**
 * Worker kolejki i status raportu — przez supabase-js na mocku Supabase
 * (PGlite ze schematem z repo). Generator raportu jest podstawiony, bez sieci.
 */
import type { PGlite } from '@electric-sql/pglite'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ParcelNotFoundError } from '@/lib/report/collect'
import type { BuiltReport } from '@/lib/report-generator'
import { DEGRADED_RETRY_S, enqueueReport, processNextReportJob, RETRY_DELAYS_S } from '@/lib/report-queue'
import { resolveReportStatus } from '@/lib/report-status'
import { E2E_USER, startMockSupabase } from '../e2e/mock-supabase.mjs'

let mock: Awaited<ReturnType<typeof startMockSupabase>>
let svc: SupabaseClient
const pg = () => mock.db() as PGlite
const sql = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await pg().query<T>(q, params)).rows

beforeAll(async () => {
  mock = await startMockSupabase()
  svc = createClient(mock.url, 'mock-service-role-key', { auth: { persistSession: false, autoRefreshToken: false } })
})
afterAll(async () => {
  await mock.close()
})
beforeEach(async () => {
  await pg().exec('DELETE FROM report_jobs; DELETE FROM reports; UPDATE profiles SET free_reports_used = 1')
})

async function newReport(): Promise<string> {
  const [r] = await sql<{ id: string }>(
    `INSERT INTO reports (user_id, parcel_id, gmina, status, paid) VALUES ($1, '022302_2.0020.440/1', 'Długołęka', 'generating', true) RETURNING id`, [E2E_USER.id])
  return r.id
}
const built = (over: { mpzp?: string; pogInForce?: boolean | null } = {}) =>
  ({ data: { mpzp: { status: over.mpzp ?? 'ok' }, pog: { inForce: over.pogInForce === undefined ? true : over.pogInForce, planStatus: 'ok' } }, insights: {}, html: '<html>raport</html>' }) as unknown as BuiltReport
const job = async (reportId: string) => (await sql<{ status: string; attempts: number; run_after: Date; last_error: string | null }>('SELECT * FROM report_jobs WHERE report_id = $1', [reportId]))[0]
const report = async (id: string) => (await sql<{ status: string; html_content: string | null }>('SELECT status, html_content FROM reports WHERE id = $1', [id]))[0]
const makeDue = (reportId: string) => sql(`UPDATE report_jobs SET run_after = NOW() - interval '1 second' WHERE report_id = $1`, [reportId])

describe('worker kolejki', () => {
  it('udana próba zapisuje raport i zamyka zadanie', async () => {
    const id = await newReport()
    await enqueueReport(svc, id, { freeSlot: true })
    const build = vi.fn(async () => built())
    const r = await processNextReportJob(svc, { reportId: id, build })
    expect(r.outcome).toBe('done')
    expect(build).toHaveBeenCalledWith('022302_2.0020.440/1', 'Długołęka', svc)
    expect(await report(id)).toEqual({ status: 'completed', html_content: '<html>raport</html>' })
    expect(await job(id)).toMatchObject({ status: 'done', attempts: 1 })
    expect(await processNextReportJob(svc, { reportId: id, build })).toMatchObject({ outcome: 'none' })
  })

  it('błąd przejściowy → ponowienie; druga próba kończy raport', async () => {
    const id = await newReport()
    await enqueueReport(svc, id, { freeSlot: true })
    const first = await processNextReportJob(svc, { reportId: id, build: async () => { throw new Error('ULDK: HTTP 503') } })
    expect(first.outcome).toBe('retry')
    const j = await job(id)
    expect(j).toMatchObject({ status: 'queued', attempts: 1, last_error: 'ULDK: HTTP 503' })
    expect(j.run_after.getTime() - Date.now()).toBeGreaterThan((RETRY_DELAYS_S[0] - 2) * 1000)
    expect((await resolveReportStatus(svc, { id, status: 'generating', created_at: new Date().toISOString() })).kick).toBe(false)

    await makeDue(id)
    expect((await resolveReportStatus(svc, { id, status: 'generating', created_at: new Date().toISOString() }))).toEqual({ status: 'generating', kick: true })
    expect((await processNextReportJob(svc, { reportId: id, build: async () => built() })).outcome).toBe('done')
    expect((await report(id)).status).toBe('completed')
    expect((await job(id)).attempts).toBe(2)
  })

  it('nieistniejąca działka → porażka bez ponowień i zwrot darmowego raportu', async () => {
    const id = await newReport()
    await enqueueReport(svc, id, { freeSlot: true })
    const r = await processNextReportJob(svc, { reportId: id, build: async () => { throw new ParcelNotFoundError('x') } })
    expect(r.outcome).toBe('failed')
    expect((await report(id)).status).toBe('failed')
    expect((await sql<{ free_reports_used: number }>('SELECT free_reports_used FROM profiles'))[0].free_reports_used).toBe(0)
    expect(await resolveReportStatus(svc, { id, status: 'failed', created_at: new Date().toISOString() })).toEqual({ status: 'failed', kick: false })
  })

  it('brak kluczowego źródła → jedna dodatkowa próba, potem raport mimo braków', async () => {
    const id = await newReport()
    await enqueueReport(svc, id, { freeSlot: false })
    const degraded = async () => built({ mpzp: 'error' })
    expect((await processNextReportJob(svc, { reportId: id, build: degraded })).outcome).toBe('retry')
    const j = await job(id)
    expect(j.run_after.getTime() - Date.now()).toBeLessThanOrEqual(DEGRADED_RETRY_S * 1000)
    await makeDue(id)
    expect((await processNextReportJob(svc, { reportId: id, build: degraded })).outcome).toBe('done')
    expect((await report(id)).status).toBe('completed')
  })

  it('przerwana funkcja: po wygaśnięciu dzierżawy polling wznawia zadanie', async () => {
    const id = await newReport()
    await enqueueReport(svc, id, { freeSlot: false })
    await svc.rpc('claim_report_job', { p_report_id: id, p_lease_seconds: 90 }) // worker, który „umarł”
    const state = () => resolveReportStatus(svc, { id, status: 'generating', created_at: new Date().toISOString() })
    expect(await state()).toEqual({ status: 'generating', kick: false })
    await sql(`UPDATE report_jobs SET locked_until = NOW() - interval '1 second' WHERE report_id = $1`, [id])
    expect(await state()).toEqual({ status: 'generating', kick: true })
    expect((await processNextReportJob(svc, { reportId: id, build: async () => built() })).outcome).toBe('done')
  })

  it('raport sprzed kolejki (bez zadania) wisi najwyżej 5 min', async () => {
    const id = await newReport()
    const old = new Date(Date.now() - 6 * 60_000).toISOString()
    expect(await resolveReportStatus(svc, { id, status: 'generating', created_at: old })).toEqual({ status: 'failed', kick: false })
    expect((await report(id)).status).toBe('failed')
  })
})
