// MOCK — lokalny zamiennik Supabase (Auth + PostgREST + Storage) dla testów e2e.
// Dane trzyma Postgres w procesie (PGlite) ze schematem z repo (schema.sql + migracje),
// więc zapytania aplikacji i funkcje SQL kolejki działają jak na prawdziwej bazie.
// Nigdy nie łączy się z prawdziwym projektem Supabase.
// Obsługuje tylko podzbiór API używany przez aplikację. RLS nie jest egzekwowane
// (PGlite działa jako superuser — jak klucz service role).
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createTestDb, createUser } from '../db/test-db.mjs'

// Dane testowe (lokalne, nieprawdziwe konto).
export const E2E_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'e2e@sprawdzdzialke.test', password: 'e2e-haslo-testowe' }

const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwtFor(user) {
  const now = Math.floor(Date.now() / 1000)
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600, session_id: randomUUID() })}.mock-signature`
}
const publicUser = u => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
})
const session = u => ({
  access_token: jwtFor(u), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: `refresh-${u.id}`, user: publicUser(u),
})

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body)
  res.writeHead(status, { 'Content-Type': isBuf ? headers['Content-Type'] ?? 'application/octet-stream' : 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', ...headers })
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body))
}
const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))) })
const readJson = async (req, empty) => JSON.parse((await readBody(req)).toString() || empty)

// ─── PostgREST → SQL ──────────────────────────────────────────────────────────
const IDENT = /^[a-z_][a-z0-9_]*$/
function ident(name) {
  if (!IDENT.test(name)) throw new Error(`mock: niedozwolona nazwa ${name}`)
  return `"${name}"`
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])
const OPS = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' }

function where(params, args) {
  const conds = []
  for (const [k, v] of params) {
    if (RESERVED.has(k)) continue
    const [op, ...rest] = v.split('.')
    const val = rest.join('.')
    const col = ident(k)
    if (OPS[op]) { args.push(val); conds.push(`${col} ${OPS[op]} $${args.length}`) }
    else if (op === 'ilike' || op === 'like') { args.push(val.replace(/\*/g, '%')); conds.push(`${col}::text ${op.toUpperCase()} $${args.length}`) }
    else if (op === 'is') {
      if (!['null', 'true', 'false'].includes(val)) throw new Error(`mock: is.${val}`)
      conds.push(`${col} IS ${val.toUpperCase()}`)
    } else if (op === 'in') {
      const items = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
      conds.push(`${col} IN (${items.map(it => { args.push(it); return `$${args.length}` }).join(', ')})`)
    } else throw new Error(`mock: nieobsługiwany operator ${op}`)
  }
  return conds.length ? ` WHERE ${conds.join(' AND ')}` : ''
}
function columns(select) {
  if (!select || select.trim() === '*') return '*'
  return select.split(',').map(s => ident(s.trim())).join(', ')
}
function orderLimit(params) {
  let sql = ''
  const order = params.get('order')
  if (order) sql += ` ORDER BY ${order.split(',').map(o => { const [c, dir] = o.split('.'); return `${ident(c)} ${dir === 'desc' ? 'DESC' : 'ASC'}` }).join(', ')}`
  if (params.get('limit')) sql += ` LIMIT ${Number(params.get('limit'))}`
  if (params.get('offset')) sql += ` OFFSET ${Number(params.get('offset'))}`
  return sql
}

let db
const colTypes = new Map()
async function typesOf(table) {
  if (!colTypes.has(table)) {
    const r = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table])
    if (!r.rows.length) return null
    colTypes.set(table, Object.fromEntries(r.rows.map(x => [x.column_name, x.data_type])))
  }
  return colTypes.get(table)
}
const param = (type, v) => (v !== null && typeof v === 'object' && (type === 'jsonb' || type === 'json') ? JSON.stringify(v) : v)

function respondRows(req, res, rows, status = 200) {
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  if (wantsObject) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null })
    return send(res, status, rows[0])
  }
  send(res, status, rows)
}
const pgError = (res, e) => send(res, e.code?.startsWith('23') ? 409 : 400, { code: e.code ?? 'MOCK', message: e.message, details: e.detail ?? null, hint: null })

async function rest(req, res, table, params) {
  const types = await typesOf(table)
  if (!types) return send(res, 404, { code: '42P01', message: `mock: brak tabeli ${table}` })
  const t = `public.${ident(table)}`
  const prefer = req.headers.prefer ?? ''
  const returning = prefer.includes('return=representation') ? ` RETURNING ${columns(params.get('select'))}` : ''
  const args = []
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const r = await db.query(`SELECT ${columns(params.get('select'))} FROM ${t}${where(params, args)}${orderLimit(params)}`, args)
      return respondRows(req, res, r.rows)
    }
    if (req.method === 'POST') {
      const body = await readJson(req, '[]')
      const items = Array.isArray(body) ? body : [body]
      const cols = [...new Set(items.flatMap(Object.keys))]
      const values = items.map(it => `(${cols.map(c => (c in it ? (args.push(param(types[c], it[c])), `$${args.length}`) : 'DEFAULT')).join(', ')})`)
      let conflict = ''
      if (prefer.includes('resolution=')) {
        const target = params.get('on_conflict')
          ?? (await db.query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`, [`public.${table}`])).rows.map(r => r.attname).join(',')
        const targetCols = target.split(',').map(c => ident(c.trim()))
        conflict = prefer.includes('resolution=ignore-duplicates')
          ? ` ON CONFLICT (${targetCols.join(', ')}) DO NOTHING`
          : ` ON CONFLICT (${targetCols.join(', ')}) DO UPDATE SET ${cols.map(c => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ')}`
      }
      const r = await db.query(`INSERT INTO ${t} (${cols.map(ident).join(', ')}) VALUES ${values.join(', ')}${conflict}${returning}`, args)
      return returning ? respondRows(req, res, r.rows, 201) : send(res, 201, undefined)
    }
    if (req.method === 'PATCH') {
      const patch = await readJson(req, '{}')
      const sets = Object.keys(patch).map(c => { args.push(param(types[c], patch[c])); return `${ident(c)} = $${args.length}` })
      const r = await db.query(`UPDATE ${t} SET ${sets.join(', ')}${where(params, args)}${returning}`, args)
      return returning ? respondRows(req, res, r.rows) : send(res, 204, undefined)
    }
    if (req.method === 'DELETE') {
      const r = await db.query(`DELETE FROM ${t}${where(params, args)}${returning}`, args)
      return returning ? respondRows(req, res, r.rows) : send(res, 204, undefined)
    }
  } catch (e) {
    return pgError(res, e)
  }
  send(res, 405, { message: 'mock: metoda nieobsługiwana' })
}

async function rpc(req, res, fn) {
  const meta = (await db.query(
    `SELECT p.proretset, t.typtype FROM pg_proc p JOIN pg_type t ON t.oid = p.prorettype JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = $1`, [fn])).rows[0]
  if (!meta) return send(res, 404, { code: 'PGRST202', message: `mock: brak funkcji ${fn}` })
  const body = await readJson(req, '{}')
  const args = []
  const named = Object.entries(body).map(([k, v]) => { args.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v); return `${ident(k)} => $${args.length}` }).join(', ')
  try {
    if (meta.proretset || meta.typtype === 'c') {
      const r = await db.query(`SELECT * FROM public.${ident(fn)}(${named})`, args)
      return meta.proretset ? respondRows(req, res, r.rows) : send(res, 200, r.rows[0] ?? null)
    }
    const r = await db.query(`SELECT public.${ident(fn)}(${named}) AS v`, args)
    return send(res, 200, r.rows[0]?.v ?? null)
  } catch (e) {
    return pgError(res, e)
  }
}

// ─── Stan ─────────────────────────────────────────────────────────────────────
const users = []
const storage = new Map()

async function reset() {
  const fresh = await createTestDb()
  await createUser(fresh, E2E_USER)
  const old = db
  db = fresh
  colTypes.clear()
  users.splice(0, users.length, { ...E2E_USER })
  storage.clear()
  await old?.close()
}

async function dump() {
  const tables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)).rows.map(r => r.tablename)
  const out = {}
  for (const t of tables) {
    const hasCreated = (await typesOf(t))?.created_at
    out[t] = (await db.query(`SELECT * FROM public.${ident(t)}${hasCreated ? ' ORDER BY created_at' : ''}`)).rows
  }
  return out
}

function userFromAuth(req) {
  const tok = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  try {
    const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString())
    return users.find(u => u.id === p.sub) ?? null
  } catch { return null }
}

// ─── Serwer ───────────────────────────────────────────────────────────────────
async function handle(req, res, port) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  const p = url.pathname
  if (req.method === 'OPTIONS') return send(res, 204, undefined)

  if (p === '/__mock/db') return send(res, 200, await dump())
  if (p === '/__mock/reset') { await reset(); return send(res, 200, { ok: true }) }
  // Do testów: np. przesunięcie dzierżawy zadania w przeszłość zamiast czekania.
  if (p === '/__mock/sql' && req.method === 'POST') {
    const { sql, params = [] } = await readJson(req, '{}')
    try { return send(res, 200, (await db.query(sql, params)).rows) } catch (e) { return pgError(res, e) }
  }

  if (p === '/auth/v1/token') {
    const body = await readJson(req, '{}')
    const grant = url.searchParams.get('grant_type')
    const user = grant === 'password'
      ? users.find(u => u.email === body.email && u.password === body.password)
      : users.find(u => `refresh-${u.id}` === body.refresh_token)
    if (!user) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' })
    return send(res, 200, session(user))
  }
  if (p === '/auth/v1/user') {
    const u = userFromAuth(req)
    return u ? send(res, 200, publicUser(u)) : send(res, 401, { code: 401, msg: 'invalid JWT', error_code: 'bad_jwt' })
  }
  if (p === '/auth/v1/logout') return send(res, 204, undefined)

  const rpcMatch = p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)
  if (rpcMatch) return rpc(req, res, rpcMatch[1])
  const restMatch = p.match(/^\/rest\/v1\/([a-z_]+)$/)
  if (restMatch) return rest(req, res, restMatch[1], url.searchParams)

  if (p.startsWith('/storage/v1/object/list/')) return send(res, 200, [])
  const pub = p.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (pub) {
    const f = storage.get(`${pub[1]}/${decodeURIComponent(pub[2])}`)
    return f ? send(res, 200, f.data, { 'Content-Type': f.type }) : send(res, 404, { message: 'not found' })
  }
  const up = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)
  if (up && (req.method === 'POST' || req.method === 'PUT')) {
    const key = `${up[1]}/${decodeURIComponent(up[2])}`
    storage.set(key, { data: await readBody(req), type: req.headers['content-type'] ?? 'application/octet-stream' })
    return send(res, 200, { Key: key, Id: randomUUID() })
  }
  send(res, 404, { message: `mock: nieobsługiwana ścieżka ${req.method} ${p}` })
}

/** Uruchamia mock; port 0 = dowolny wolny port. */
export async function startMockSupabase({ port = 0 } = {}) {
  await reset()
  const server = http.createServer((req, res) => {
    handle(req, res, server.address().port).catch(e => send(res, 500, { message: String(e?.message ?? e) }))
  })
  await new Promise(r => server.listen(port, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`
  return { url, db: () => db, close: () => new Promise(r => server.close(() => db.close().then(r))) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startMockSupabase({ port: Number(process.env.MOCK_SUPABASE_PORT ?? 54329) })
  console.log(`[mock-supabase] ${url}`)
}
