import Link from 'next/link'
import { Logo } from './Logo'

// Linki prawne (regulamin, polityka prywatności) dopisać tutaj — jedna stopka dla całej witryny.
const LINKS = [
  { href: '/pricing', label: 'Cennik' },
  { href: '/blog', label: 'Blog' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/login', label: 'Zaloguj się' },
  { href: '/register', label: 'Rejestracja' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900 py-10 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <Logo tone="light" className="text-base" />
        <nav aria-label="Stopka">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map(l => (
              <li key={l.href}>
                <Link href={l.href} className="text-gray-400 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} SprawdzDziałkę.com</p>
      </div>
    </footer>
  )
}
