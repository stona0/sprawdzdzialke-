import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { errorCode, safeNext } from '@/lib/auth-redirect'

/**
 * Powrót z Google albo z linku w mailu (potwierdzenie konta, reset hasła) — wymienia code na sesję
 * Supabase (PKCE) i przechodzi do `next`. Błąd trafia na /login?error=<kod> z komunikatem po polsku.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  // Supabase odsyła tu błąd zamiast code, np. gdy użytkownik anulował zgodę w Google albo link wygasł.
  const providerError = searchParams.get('error_code') ?? searchParams.get('error')
  if (providerError) {
    console.error('[auth/callback] błąd od dostawcy:', providerError, searchParams.get('error_description') ?? '')
    return NextResponse.redirect(`${origin}/login?error=${errorCode(providerError)}`)
  }

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) return NextResponse.redirect(`${origin}${next}`)

    console.error('[auth/callback] exchangeCodeForSession error:', error.code ?? '', error.message)
    return NextResponse.redirect(`${origin}/login?error=${errorCode(error.code)}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
