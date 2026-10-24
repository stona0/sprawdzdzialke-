// Sprawdza plik zmiennych STAGINGU, zanim trafią do Netlify: komplet zmiennych,
// inny projekt Supabase niż produkcja (porównanie z .env.local), klucze Supabase
// z tego samego projektu, klucze Stripe testowe, adres inny niż produkcyjny.
// Wypisuje tylko nazwy zmiennych i wynik — nigdy wartości.
//
//   npm run staging:check-env -- .env.staging
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const REQUIRED = [
  'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'ANTHROPIC_API_KEY', 'CRON_SECRET',
]
const PROD_HOSTS = ['sprawdzdzialke.com', 'www.sprawdzdzialke.com', 'sprawdzdzialke.pl', 'www.sprawdzdzialke.pl']

export function parseEnv(text) {
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

const supabaseRef = url => { try { return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null } catch { return null } }
const host = url => { try { return new URL(url).hostname } catch { return null } }
function jwtPayload(token) {
  const part = token?.split('.')[1]
  if (!part) return null
  try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) } catch { return null }
}

/** Klucz Supabase: stary format (JWT z ref i role) albo nowy (sb_publishable_ / sb_secret_). */
function supabaseKey(name, key, ref, role, newPrefix) {
  if (key.startsWith(newPrefix)) return [true, `${name}: nowy format klucza (${newPrefix}…) — zgodności z projektem nie da się sprawdzić offline`]
  const p = jwtPayload(key)
  if (!p) return [false, `${name}: to nie jest klucz Supabase (ani JWT, ani ${newPrefix}…)`]
  if (p.role !== role) return [false, `${name}: klucz ma rolę „${p.role}”, oczekiwano „${role}”`]
  if (p.ref !== ref) return [false, `${name}: klucz należy do innego projektu Supabase niż NEXT_PUBLIC_SUPABASE_URL`]
  return [true, `${name}: rola ${role}, ten sam projekt co URL`]
}

/** Zwraca listę [ok, opis]; prodEnv to zmienne produkcji (.env.local) do porównania. */
export function checkEnv(env, prodEnv = {}) {
  const out = []
  const missing = REQUIRED.filter(k => !env[k])
  out.push(missing.length ? [false, `brak zmiennych: ${missing.join(', ')}`] : [true, `komplet ${REQUIRED.length} zmiennych`])

  const ref = supabaseRef(env.NEXT_PUBLIC_SUPABASE_URL)
  const prodRef = supabaseRef(prodEnv.NEXT_PUBLIC_SUPABASE_URL)
  if (!ref) out.push([false, 'NEXT_PUBLIC_SUPABASE_URL: oczekiwano https://<projekt>.supabase.co'])
  else if (prodRef && ref === prodRef) out.push([false, 'NEXT_PUBLIC_SUPABASE_URL wskazuje PRODUKCYJNY projekt Supabase (ten sam co w .env.local)'])
  else out.push([true, `NEXT_PUBLIC_SUPABASE_URL: projekt inny niż produkcja${prodRef ? '' : ' (brak .env.local do porównania)'}`])
  if (ref && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) out.push(supabaseKey('NEXT_PUBLIC_SUPABASE_ANON_KEY', env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ref, 'anon', 'sb_publishable_'))
  if (ref && env.SUPABASE_SERVICE_ROLE_KEY) out.push(supabaseKey('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY, ref, 'service_role', 'sb_secret_'))
  if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY === prodEnv.SUPABASE_SERVICE_ROLE_KEY) out.push([false, 'SUPABASE_SERVICE_ROLE_KEY jest taki sam jak produkcyjny'])

  const prefix = (name, p, what) => env[name] && out.push(env[name].startsWith(p) ? [true, `${name}: ${what}`] : [false, `${name}: oczekiwano klucza ${what} (${p}…)`])
  prefix('STRIPE_SECRET_KEY', 'sk_test_', 'testowy Stripe')
  prefix('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_', 'testowy Stripe')
  prefix('STRIPE_WEBHOOK_SECRET', 'whsec_', 'sekret webhooka Stripe')
  if (env.STRIPE_WEBHOOK_SECRET && env.STRIPE_WEBHOOK_SECRET === prodEnv.STRIPE_WEBHOOK_SECRET) out.push([false, 'STRIPE_WEBHOOK_SECRET jest taki sam jak produkcyjny — utwórz osobny endpoint w trybie testowym'])

  const h = host(env.NEXT_PUBLIC_APP_URL)
  if (!h || !env.NEXT_PUBLIC_APP_URL.startsWith('https://')) out.push([false, 'NEXT_PUBLIC_APP_URL: oczekiwano adresu https:// stagingu'])
  else if (PROD_HOSTS.includes(h)) out.push([false, 'NEXT_PUBLIC_APP_URL to adres produkcyjny — płatności wracałyby na produkcję'])
  else out.push([true, 'NEXT_PUBLIC_APP_URL: adres https inny niż produkcyjny'])
  if (env.NEXT_PUBLIC_APP_URL?.endsWith('/')) out.push([false, 'NEXT_PUBLIC_APP_URL: bez ukośnika na końcu (adresy powrotu z płatności miałyby //)'])

  if (env.CRON_SECRET) out.push(env.CRON_SECRET.length >= 32 ? [true, 'CRON_SECRET: co najmniej 32 znaki'] : [false, 'CRON_SECRET: za krótki (min. 32 znaki, np. openssl rand -hex 32)'])
  if (env.ANTHROPIC_API_KEY) out.push(env.ANTHROPIC_API_KEY.startsWith('sk-ant-') ? [true, 'ANTHROPIC_API_KEY: format klucza Anthropic'] : [false, 'ANTHROPIC_API_KEY: oczekiwano sk-ant-…'])
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2]
  if (!file || !existsSync(file)) {
    console.error('użycie: npm run staging:check-env -- <plik ze zmiennymi stagingu, np. .env.staging>')
    process.exit(2)
  }
  const prod = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {}
  const results = checkEnv(parseEnv(readFileSync(file, 'utf8')), prod)
  for (const [ok, msg] of results) console.log(`${ok ? '✔' : '✘'} ${msg}`)
  const failed = results.filter(([ok]) => !ok).length
  console.log(failed ? `\n${failed} problem(y) — popraw przed wpisaniem do Netlify.` : '\nWszystko się zgadza.')
  process.exit(failed ? 1 : 0)
}
