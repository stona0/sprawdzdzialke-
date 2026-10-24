import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { Logo } from './Logo'

/** Nagłówek części dla zalogowanych (moje raporty, panel admina). */
export function AppHeader({ email, isAdmin = false }: { email?: string | null; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Konto" className="flex items-center gap-4 text-sm">
          {isAdmin && (
            <Link href="/admin" className="text-muted-foreground transition-colors hover:text-gray-900">
              Panel admina
            </Link>
          )}
          {email && <span className="hidden max-w-64 truncate text-muted-foreground md:block">{email}</span>}
          <LogoutButton />
        </nav>
      </div>
    </header>
  )
}
