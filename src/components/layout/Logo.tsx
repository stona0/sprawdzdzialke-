import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Logo marki — zawsze link do strony głównej. `light` na ciemnym tle (stopka). */
export function Logo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'font-playfair text-lg font-bold tracking-tight whitespace-nowrap',
        tone === 'dark' ? 'text-gray-900' : 'text-white',
        className,
      )}
    >
      Sprawdź<span className={tone === 'dark' ? 'text-primary' : 'text-green-400'}>Działkę</span>.com
    </Link>
  )
}
