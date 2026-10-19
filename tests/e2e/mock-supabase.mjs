// MOCK — lokalny zamiennik Supabase (Auth + PostgREST + Storage) dla testów e2e.
// Trzyma dane w pamięci; nigdy nie łączy się z prawdziwym projektem Supabase.
// Obsługuje tylko podzbiór API używany przez aplikację.
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54329)

// Dane testowe (lokalne, nieprawdziwe konto).
export const E2E_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'e2e@sprawdzdzialke.test', password: 'e2e-haslo-testowe' }

let db
function reset() {
  db = {
    users: [{ ...E2E_USER }],
    profiles: [{ user_id: E2E_USER.id, email: E2E_USER.email, role: 'user', free_reports_used: 0, created_at: new Date().toISOString() }],
    reports: [],
    payments: [],
    sip_layers: [],
    mpzp_cache: [],
  }
  storage.clear()
}
const storage = new Map()
reset()

const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwtFor(user) {
  const now = Math.floor(Date.now() / 1000)
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600, session_id: randomUUID() })}.mock-signature`
}
function userFromAuth(req) {
  const t = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  try {
    const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())
    return db.users.find(u => u.id === p.sub) ?? null
  } catch { return null }
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

// ─── PostgREST ────────────────────────────────────────────────────────────────
function applyFilters(rows, params) {
  let out = rows
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue
    const [op, ...rest] = v.split('.')
    const val = rest.join('.')
    if (op === 'eq') out = out.filter(r => String(r[k]) === val)
    else if (op === 'ilike') {
      const re = new RegExp(`^${val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, 'i')
      out = out.filter(r => re.test(String(r[k] ?? '')))
    } else throw new Error(`mock: nieobsługiwany operator ${op}`)
  }
  const order = params.get('order')
  if (order) {
    const [col, dir] = order.split('.')
    out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === 'desc' ? -1 : 1))
  }
  const limit = params.get('limit')
  if (limit) out = out.slice(0, Number(limit))
  return out
}
function project(rows, select) {
  if (!select || select === '*') return rows
  const cols = select.split(',').map(s => s.trim())
  return rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])))
}
function respondRows(req, res, rows, status = 200) {
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  if (wantsObject) {
    if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null })
    return send(res, status, rows[0])
  }
  send(res, status, rows)
}
const DEFAULTS = {
  reports: () => ({ id: randomUUID(), status: 'pending', html_content: null, paid: false, created_at: new Date().toISOString() }),
  payments: () => ({ id: randomUUID(), status: 'pending', created_at: new Date().toISOString() }),
  profiles: () => ({ role: 'user', free_reports_used: 0, created_at: new Date().toISOString() }),
}

async function rest(req, res, table, params) {
  if (!(table in db)) return send(res, 404, { message: `mock: brak tabeli ${table}` })
  const prefer = req.headers.prefer ?? ''
  const returnRep = prefer.includes('return=representation')
  if (req.method === 'GET') return respondRows(req, res, project(applyFilters(db[table], params), params.get('select')))
  if (req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString() || '[]')
    const items = (Array.isArray(body) ? body : [body]).map(x => ({ ...(DEFAULTS[table]?.() ?? {}), ...x }))
    db[table].push(...items)
    return returnRep ? respondRows(req, res, project(items, params.get('select')), 201) : send(res, 201, undefined)
  }
  if (req.method === 'PATCH') {
    const patch = JSON.parse((await readBody(req)).toString() || '{}')
    const hit = applyFilters(db[table], params)
    hit.forEach(r => Object.assign(r, patch))
    return returnRep ? respondRows(req, res, project(hit, params.get('select'))) : send(res, 204, undefined)
  }
  if (req.method === 'DELETE') {
    const hit = new Set(applyFilters(db[table], params))
    db[table] = db[table].filter(r => !hit.has(r))
    return send(res, 204, undefined)
  }
  send(res, 405, { message: 'mock: metoda nieobsługiwana' })
}

// ─── Serwer ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
    const p = url.pathname
    if (req.method === 'OPTIONS') return send(res, 204, undefined)

    if (p === '/__mock/db') return send(res, 200, db)
    if (p === '/__mock/reset') { reset(); return send(res, 200, { ok: true }) }

    if (p === '/auth/v1/token') {
      const body = JSON.parse((await readBody(req)).toString() || '{}')
      const grant = url.searchParams.get('grant_type')
      const user = grant === 'password'
        ? db.users.find(u => u.email === body.email && u.password === body.password)
        : db.users.find(u => `refresh-${u.id}` === body.refresh_token)
      if (!user) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return send(res, 200, session(user))
    }
    if (p === '/auth/v1/user') {
      const u = userFromAuth(req)
      return u ? send(res, 200, publicUser(u)) : send(res, 401, { code: 401, msg: 'invalid JWT', error_code: 'bad_jwt' })
    }
    if (p === '/auth/v1/logout') return send(res, 204, undefined)

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
  } catch (e) {
    send(res, 500, { message: String(e?.message ?? e) })
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`[mock-supabase] http://127.0.0.1:${PORT}`))
