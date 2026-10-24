// Baza testowa: Postgres w procesie (PGlite) ze schematem z repo — schema.sql
// i wszystkie supabase/migrations/*.sql w kolejności nazw. Używana przez testy SQL
// i przez mock Supabase w e2e, więc zapytania aplikacji trafiają na prawdziwy schemat.
// Nigdy nie łączy się z żadnym zdalnym projektem Supabase.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Minimalne odpowiedniki tego, co Supabase ma poza schematem public.
// auth.uid() zwraca NULL — PGlite działa jako superuser, więc RLS i tak nie jest
// egzekwowane (jak przy kluczu service role).
export const SUPABASE_STUBS = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::uuid';
  CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql AS 'SELECT ''service_role''::text';
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id TEXT PRIMARY KEY, name TEXT, public BOOLEAN, file_size_limit BIGINT, allowed_mime_types TEXT[]);
  CREATE TABLE storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT, name TEXT);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
`

export function migrationFiles() {
  const dir = path.join(ROOT, 'supabase/migrations')
  return [path.join(ROOT, 'schema.sql'), ...readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => path.join(dir, f))]
}

export async function createTestDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUBS)
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(file, 'utf8'))
    } catch (e) {
      throw new Error(`Migracja ${path.relative(ROOT, file)} nie przeszła: ${e.message}`)
    }
  }
  return db
}

/** Użytkownik w auth.users; trigger ze schema.sql zakłada mu profil. */
export async function createUser(db, { id, email, role = 'user', freeReportsUsed = 0 }) {
  await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, email])
  await db.query('UPDATE public.profiles SET role = $2, free_reports_used = $3 WHERE user_id = $1', [id, role, freeReportsUsed])
}
