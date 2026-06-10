import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Proxy – auth guard + token refresh.
 *
 * Logika:
 * 1. Tworzy Supabase client z cookies (anon key) → odświeża JWT jeśli wygasł.
 * 2. Tylko CHRONIONE ścieżki (/dashboard/*, /report/*, /admin/*, wybrane /api/*) 
 *    wymagają sesji. Brak sesji → redirect na /login.
 * 3. Wszystko inne jest publiczne — Next.js routing zwraca 404 dla nieznanych ścieżek
 *    (app/not-found.tsx), co eliminuje soft-404 (HTTP 200 zamiast 404).
 */

// Prefixy ścieżek CHRONIONYCH — wymagają zalogowania
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/report',
  '/admin',
  '/cennik',  // legacy URL — middleware przepuści do next.config redirect
]

// Prefixy API wymagające sesji (z wyjątkiem webhook)
const PROTECTED_API_PREFIXES = [
  '/api/parcel',
  '/api/report',
  '/api/admin',
  '/api/payments/create-checkout',
  '/api/payments/verify',
]

function isProtected(pathname: string): boolean {
  for (const prefix of PROTECTED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true
  }
  for (const prefix of PROTECTED_API_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true
  }
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Tylko chronione ścieżki wymagają sesji.
  // Wszystko inne → publiczne (Next.js routing zwróci 404 dla nieznanych ścieżek)
  if (!isProtected(pathname)) {
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
