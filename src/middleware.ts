import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware – auth guard + token refresh.
 *
 * Logika:
 * 1. Tworzy Supabase client z cookies (anon key) → odświeża JWT jeśli wygasł.
 * 2. Ścieżki publiczne (/login, /register, /forgot-password, /, /pricing, /api/payments/webhook)
 *    → przepuszcza bez sprawdzania sesji.
 * 3. Wszystko inne (/dashboard/*, /report/*, /admin/*, /api/*) → wymaga zalogowania.
 *    Jeśli brak sesji → redirect na /login.
 */

// Ścieżki ZAWSZE publiczne — nie wymagają sesji
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/pricing',
]

// Prefixy które są zawsze publiczne
const PUBLIC_PREFIXES = [
  '/api/payments/webhook', // Stripe webhook — no cookies, signature-verified
  '/_next',               // Next.js assets
  '/favicon',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  // Static files
  if (pathname.match(/\.\w{2,5}$/)) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Publiczne ścieżki — nie ruszaj
  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // ──────────────────────────────────────────────
  // Supabase token refresh + auth check
  // ──────────────────────────────────────────────
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Ustaw cookies na request (forward do Server Components)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          // Ustaw cookies na response (wyślij do przeglądarki)
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getUser() weryfikuje JWT server-side (nie ufa tylko cookie)
  // i odświeża token jeśli wygasł
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Niezalogowany → redirect na /login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)',
  ],
}
