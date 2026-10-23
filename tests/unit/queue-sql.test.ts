/**
 * Funkcje SQL kolejki (supabase/migrations/20261020_source_cache_report_jobs.sql)
 * na prawdziwym Postgresie (PGlite) ze schematem z repo.
 */
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb, createUser } from '../db/test-db.mjs'

interface Job {
  id: string
  report_id: string
  status: string
  attempts: number
  max_attempts: number
  lock_token: string | null
  locked_until: Date | null
  run_after: Date
  last_error: string | null
}

let db: PGlite
const USER = '22222222-2222-4222-8222-222222222222'

async function newReport(status = 'generating'): Promise<string> {
  const id = randomUUID()
  await db.query(`INSERT INTO reports (id, user_id, parcel_id, gmina, status, paid) VALUES ($1, $2, '026401_1.0001.1', 'Wrocław', $3, true)`, [id, USER, status])
  return id
}
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
const enqueue = (reportId: string, free = false) => one<Job>('SELECT * FROM enqueue_report_job($1, $2)', [reportId, free])
const claim = (reportId: string | null = null, lease = 90) => one<Job | undefined>('SELECT * FROM claim_report_job($1, $2)', [reportId, lease])
const fail = (job: Job, retry: number | null) =>
  one<{ fail_report_job: string }>('SELECT fail_report_job($1, $2, $3, $4)', [job.id, job.lock_token, 'błąd testowy', retry]).then(r => r.fail_report_job)
const reportStatus = (id: string) => one<{ status: string; html_content: string | null }>('SELECT status, html_content FROM reports WHERE id = $1', [id])
const freeUsed = () => one<{ free_reports_used: number }>('SELECT free_reports_used FROM profiles WHERE user_id = $1', [USER]).then(r => r.free_reports_used)
/** Przesuwa czas zadania w przeszłość zamiast czekać. */
const expireLease = (jobId: string) => db.query(`UPDATE report_jobs SET locked_until = NOW() - interval '1 second' WHERE id = $1`, [jobId])
const makeDue = (jobId: string) => db.query(`UPDATE report_jobs SET run_after = NOW() - interval '1 second' WHERE id = $1`, [jobId])

beforeEach(async () => {
  db = await createTestDb()
  await createUser(db, { id: USER, email: 'kolejka@sprawdzdzialke.test', freeReportsUsed: 1 })
})

describe('migracje', () => {
  it('schema.sql + wszystkie migracje przechodzą na czystym Postgresie', async () => {
    const tables = (await db.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)).rows.map(r => r.tablename)
    expect(tables).toEqual(expect.arrayContaining(['reports', 'profiles', 'payments', 'source_cache', 'report_jobs']))
  })

  it('Storage: utility-maps bez polityk zapisu dla wszystkich ról', async () => {
    const policies = (await db.query<{ policyname: string; cmd: string }>(`SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY 1`)).rows
    expect(policies).toEqual([{ policyname: 'Public read utility-maps', cmd: 'SELECT' }])
  })

  it('anon i authenticated nie mogą wywołać funkcji kolejki', async () => {
    const r = await one<{ anon: boolean; auth: boolean; svc: boolean }>(`SELECT
      has_function_privilege('anon', 'claim_report_job(uuid, integer)', 'EXECUTE') AS anon,
      has_function_privilege('authenticated', 'complete_report_job(uuid, uuid, text)', 'EXECUTE') AS auth,
      has_function_privilege('service_role', 'claim_report_job(uuid, integer)', 'EXECUTE') AS svc`)
    expect(r).toEqual({ anon: false, auth: false, svc: true })
  })
})

describe('kolejka raportów', () => {
  it('enqueue jest idempotentny', async () => {
    const r = await newReport()
    const a = await enqueue(r)
    const b = await enqueue(r)
    expect(b.id).toBe(a.id)
    expect((await db.query('SELECT 1 FROM report_jobs')).rows).toHaveLength(1)
  })

  it('claim zajmuje zadanie na czas dzierżawy; drugi worker nic nie dostaje', async () => {
    const r = await newReport()
    await enqueue(r)
    const job = await claim()
    expect(job).toMatchObject({ report_id: r, status: 'running', attempts: 1 })
    expect(job!.lock_token).toBeTruthy()
    expect(await claim()).toBeUndefined()
  })

  it('claim z report_id bierze tylko zadanie tego raportu', async () => {
    const r1 = await newReport()
    const r2 = await newReport()
    await enqueue(r1)
    await enqueue(r2)
    expect((await claim(r2))!.report_id).toBe(r2)
  })

  it('complete zapisuje HTML i status raportu atomowo', async () => {
    const r = await newReport()
    await enqueue(r)
    const job = (await claim())!
    const ok = await one<{ complete_report_job: boolean }>('SELECT complete_report_job($1, $2, $3)', [job.id, job.lock_token, '<html>ok</html>'])
    expect(ok.complete_report_job).toBe(true)
    expect(await reportStatus(r)).toEqual({ status: 'completed', html_content: '<html>ok</html>' })
    expect((await one<Job>('SELECT * FROM report_jobs WHERE id = $1', [job.id])).status).toBe('done')
  })

  it('worker, któremu przepadła dzierżawa, nie nadpisuje wyniku', async () => {
    const r = await newReport()
    await enqueue(r)
    const stale = (await claim())!
    await expireLease(stale.id)
    const fresh = (await claim())!
    expect(fresh.attempts).toBe(2)
    const late = await one<{ complete_report_job: boolean }>('SELECT complete_report_job($1, $2, $3)', [stale.id, stale.lock_token, 'stary'])
    expect(late.complete_report_job).toBe(false)
    expect(await fail(stale, 10)).toBe('lost')
    expect((await reportStatus(r)).status).toBe('generating')
  })

  it('błąd przejściowy → ponowienie z opóźnieniem', async () => {
    const r = await newReport()
    await enqueue(r)
    const job = (await claim())!
    expect(await fail(job, 30)).toBe('queued')
    const after = await one<Job>('SELECT * FROM report_jobs WHERE id = $1', [job.id])
    expect(after).toMatchObject({ status: 'queued', lock_token: null, last_error: 'błąd testowy' })
    expect(after.run_after.getTime()).toBeGreaterThan(Date.now() + 20_000)
    expect(await claim()).toBeUndefined() // jeszcze nie pora
    await makeDue(job.id)
    expect((await claim())!.attempts).toBe(2)
  })

  it('błąd trwały → raport failed i zwrot darmowego raportu', async () => {
    const r = await newReport()
    await enqueue(r, true)
    const job = (await claim())!
    expect(await fail(job, null)).toBe('failed')
    expect((await reportStatus(r)).status).toBe('failed')
    expect(await freeUsed()).toBe(0)
  })

  it('raport płatny nie zwraca darmowego raportu przy porażce', async () => {
    const r = await newReport()
    await enqueue(r, false)
    expect(await fail((await claim())!, null)).toBe('failed')
    expect(await freeUsed()).toBe(1)
  })

  it('po wyczerpaniu prób kolejny błąd jest ostateczny', async () => {
    const r = await newReport()
    await enqueue(r)
    for (let i = 1; i <= 3; i++) {
      const job = (await claim())!
      expect(job.attempts).toBe(i)
      expect(await fail(job, 1)).toBe('queued')
      await makeDue(job.id)
    }
    const last = (await claim())!
    expect(last.attempts).toBe(4)
    expect(await fail(last, 1)).toBe('failed')
    expect((await reportStatus(r)).status).toBe('failed')
  })

  it('ostatnia próba zabita przez platformę → claim domyka zadanie i raport', async () => {
    const r = await newReport()
    await enqueue(r, true)
    await db.query('UPDATE report_jobs SET attempts = max_attempts - 1')
    const job = (await claim())!
    expect(job.attempts).toBe(4)
    await expireLease(job.id) // funkcja nie wróciła
    expect(await claim()).toBeUndefined()
    expect((await one<Job>('SELECT * FROM report_jobs WHERE id = $1', [job.id])).status).toBe('failed')
    expect((await reportStatus(r)).status).toBe('failed')
    expect(await freeUsed()).toBe(0)
  })

  it('ponowne enqueue zadania, które padło, uruchamia je od nowa (ponowiony webhook)', async () => {
    const r = await newReport()
    await enqueue(r)
    await fail((await claim())!, null)
    await db.query(`UPDATE reports SET status = 'generating' WHERE id = $1`, [r])
    const again = await enqueue(r)
    expect(again).toMatchObject({ status: 'queued', attempts: 0 })
    expect((await claim())!.report_id).toBe(r)
  })
})
