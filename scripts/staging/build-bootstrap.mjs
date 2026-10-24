// Składa jeden plik SQL zakładający bazę STAGINGU w nowym projekcie Supabase (SQL Editor):
// schema.sql + supabase/migrations/*.sql w tej samej kolejności co testy
// (tests/db/test-db.mjs), w jednej transakcji, z rejestrem zastosowanych plików w ops.
// Plik wynikowy jest w repo (supabase/staging/bootstrap.sql); test pilnuje, że jest aktualny.
//
//   npm run staging:bootstrap
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrationFiles } from '../../tests/db/test-db.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const BOOTSTRAP_PATH = path.join(ROOT, 'supabase/staging/bootstrap.sql')

const HEADER = `-- ============================================================
-- STAGING: pełny schemat aplikacji dla NOWEGO, pustego projektu Supabase.
-- Wygenerowane przez: npm run staging:bootstrap — nie edytuj ręcznie.
-- Wklej całość w Supabase → SQL Editor projektu STAGINGU i uruchom.
-- Działa w jednej transakcji: przy błędzie nic nie zostaje zmienione.
-- NIE uruchamiaj na produkcji — tam stosuje się tylko brakujące migracje (docs/STAGING.md).
-- ============================================================`

// Blokada: produkcja (i każda baza po wcześniejszym bootstrapie) ma już public.profiles.
const GUARD = `DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'Ta baza ma już tabelę public.profiles. Skrypt jest tylko dla nowego, pustego projektu (staging). Przerwano, nic nie zmieniono.';
  END IF;
END $$;

-- Rejestr zastosowanych plików; schemat ops nie jest wystawiony przez API Supabase.
CREATE SCHEMA ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;
CREATE TABLE ops.applied_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`

export function buildBootstrap() {
  const parts = migrationFiles().map(f => {
    const rel = path.relative(ROOT, f)
    return `-- ── ${rel} ${'─'.repeat(Math.max(0, 56 - rel.length))}\n${readFileSync(f, 'utf8').trim()}\n\nINSERT INTO ops.applied_migrations (name) VALUES ('${rel}');`
  })
  return [HEADER, '', 'BEGIN;', '', GUARD, '', ...parts.flatMap(p => [p, '']), 'COMMIT;', ''].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(path.dirname(BOOTSTRAP_PATH), { recursive: true })
  writeFileSync(BOOTSTRAP_PATH, buildBootstrap())
  console.log(`zapisano ${path.relative(ROOT, BOOTSTRAP_PATH)} (${migrationFiles().length} plików SQL)`)
}
