'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

const NAV = [
  { href: '/#funkcje', label: 'Funkcje' },
  { href: '/pricing', label: 'Cennik' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
  { href: '/login', label: 'Zaloguj się' },
]

/**
 * Nawigacja stron publicznych. `overlay` — przezroczysta nad zdjęciem w hero,
 * po przewinięciu (albo z otwartym menu) dostaje białe tło.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!overlay) return
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const solid = !overlay || scrolled || open
  const isCurrent = (href: string) => !href.includes('#') && (pathname === href || pathname.startsWith(href + '/'))

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-200',
        solid ? 'border-border bg-white/90 backdrop-blur-md' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Główna" className="hidden items-center gap-8 text-gray-700 md:flex">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className="transition-colors hover:text-gray-900 aria-[current=page]:font-medium aria-[current=page]:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="dark" size="sm" className="hidden sm:inline-flex">
            <Link href="/register">Zacznij za darmo</Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls="menu-mobilne"
            aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
            className="cursor-pointer rounded-full p-2 text-gray-700 transition-colors hover:text-gray-900 md:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="menu-mobilne" aria-label="Główna" className="border-t border-border bg-white md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6">
            {NAV.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent(item.href) ? 'page' : undefined}
                  className="block py-3 text-base text-gray-700 hover:text-gray-900 aria-[current=page]:font-medium aria-[current=page]:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-2 pb-1 sm:hidden">
              <Button asChild variant="dark" className="w-full">
                <Link href="/register" onClick={() => setOpen(false)}>Zacznij za darmo</Link>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
