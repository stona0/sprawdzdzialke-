/**
 * Staging: bootstrap.sql (jeden plik do SQL Editor nowego projektu Supabase), kontrola
 * schematu (check-schema.sql, tylko odczyt) i sprawdzanie zmiennych stagingu.
 * SQL wykonywany na PGlite z tymi samymi zaślepkami Supabase co reszta testów.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { BOOTSTRAP_PATH, buildBootstrap } from '../../scripts/staging/build-bootstrap.mjs'
import { checkEnv, parseEnv } from '../../scripts/staging/check-env.mjs'
import { migrationFiles, SUPABASE_STUBS } from '../db/test-db.mjs'

const ROOT = path.join(__dirname, '../..')
const CHECK = readFileSync(path.join(ROOT, 'supabase/check-schema.sql'), 'utf8')
type Row = { ok: boolean; kind: string; name: string; plik: string }

async function freshDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  return db
}

describe('bootstrap.sql dla stagingu', () => {
  it('plik w repo jest aktualny (npm run staging:bootstrap)', () => {
    expect(readFileSync(BOOTSTRAP_PATH, 'utf8')).toBe(buildBootstrap())
  })

  it('zakłada cały schemat na pustej bazie; kontrola schematu: wszystko ok', async () => {
    const db = await freshDb()
    await db.exec(readFileSync(BOOTSTRAP_PATH, 'utf8'))
    const applied = (await db.query<{ name: string }>('SELECT name FROM ops.applied_migrations ORDER BY name')).rows.map(r => r.name)
    expect(applied).toEqual(migrationFiles().map(f => path.relative(ROOT, f)).sort())
    const rows = (await db.query<Row>(CHECK)).rows
    expect(rows.filter(r => !r.ok)).toEqual([])
    expect(rows.filter(r => r.kind === 'RLS włączone').map(r => r.name)).toContain('public.report_jobs')
  })

  it('na bazie, która ma już schemat (np. produkcja), przerywa i niczego nie zmienia', async () => {
    const db = await freshDb()
    await db.exec(readFileSync(path.join(ROOT, 'schema.sql'), 'utf8'))
    await expect(db.exec(readFileSync(BOOTSTRAP_PATH, 'utf8'))).rejects.toThrow(/tylko dla nowego, pustego projektu/)
    await db.exec('ROLLBACK')
    expect((await db.query(`SELECT to_regnamespace('ops') AS s, to_regclass('public.report_jobs') AS t`)).rows[0]).toEqual({ s: null, t: null })
  })
})

describe('check-schema.sql na bazie „jak produkcja” (bez migracji z tego brancha)', () => {
  it('wskazuje dokładnie brakujące pliki 20261020, 20261024 i 20261025', async () => {
    const db = await freshDb()
    for (const f of migrationFiles().filter(f => !/2026102[045]_/.test(f))) await db.exec(readFileSync(f, 'utf8'))
    const missing = new Set((await db.query<Row>(CHECK)).rows.filter(r => !r.ok).map(r => r.plik))
    expect([...missing].sort()).toEqual([
      '20261020_source_cache_report_jobs.sql',
      '20261024_power_lines_bucket.sql',
      '20261024_utility_maps_write_policies.sql',
      '20261025_security_definer_functions.sql',
    ])
  })
})

describe('zmienne stagingu', () => {
  const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`
  const prod = { NEXT_PUBLIC_SUPABASE_URL: 'https://prodref.supabase.co', SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: 'prodref', role: 'service_role' }), STRIPE_WEBHOOK_SECRET: 'whsec_prod' }
  const good = {
    NEXT_PUBLIC_APP_URL: 'https://staging--sprawdzdzialke.netlify.app',
    NEXT_PUBLIC_SUPABASE_URL: 'https://stagref.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: 'stagref', role: 'anon' }),
    SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: 'stagref', role: 'service_role' }),
    STRIPE_SECRET_KEY: 'sk_test_abc', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_staging',
    ANTHROPIC_API_KEY: 'sk-ant-xyz', CRON_SECRET: 'a'.repeat(64),
  }
  const failures = (env: Record<string, string>) => checkEnv(env, prod).filter(([ok]) => !ok).map(([, m]) => m)

  it('poprawny zestaw przechodzi', () => {
    expect(failures(good)).toEqual([])
  })

  it('wyłapuje produkcyjną bazę, klucz z innego projektu, klucze live Stripe, adres produkcyjny', () => {
    expect(failures({ ...good, NEXT_PUBLIC_SUPABASE_URL: 'https://prodref.supabase.co' }).join(' ')).toMatch(/PRODUKCYJNY projekt/)
    expect(failures({ ...good, SUPABASE_SERVICE_ROLE_KEY: prod.SUPABASE_SERVICE_ROLE_KEY }).join(' ')).toMatch(/innego projektu/)
    expect(failures({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ ref: 'stagref', role: 'service_role' }) }).join(' ')).toMatch(/rolę „service_role”/)
    expect(failures({ ...good, STRIPE_SECRET_KEY: 'sk_live_abc' }).join(' ')).toMatch(/STRIPE_SECRET_KEY/)
    expect(failures({ ...good, STRIPE_WEBHOOK_SECRET: 'whsec_prod' }).join(' ')).toMatch(/taki sam jak produkcyjny/)
    expect(failures({ ...good, NEXT_PUBLIC_APP_URL: 'https://sprawdzdzialke.com' }).join(' ')).toMatch(/adres produkcyjny/)
    expect(failures({ ...good, CRON_SECRET: 'krotki' }).join(' ')).toMatch(/za krótki/)
    const { ANTHROPIC_API_KEY: _, ...noKey } = good
    expect(failures(noKey).join(' ')).toMatch(/brak zmiennych: ANTHROPIC_API_KEY/)
  })

  it('nowy format kluczy Supabase jest akceptowany bez sprawdzania projektu; parser .env', () => {
    expect(failures({ ...good, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' })).toEqual([])
    expect(parseEnv('# komentarz\nA=1\nB = "dwa"\n  C=\'trzy\'\n')).toEqual({ A: '1', B: 'dwa', C: 'trzy' })
  })
})
