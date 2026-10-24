import { Logo } from '@/components/layout/Logo'

/** Wspólna rama logowania, rejestracji i haseł: tło z hero, pełna biała karta. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen flex-col bg-cover bg-top"
      style={{ backgroundImage: 'url(/hero-bg.jpg)' }}
    >
      <header className="flex h-16 items-center px-4 sm:px-8">
        <Logo />
      </header>
      <div className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm rounded-2xl border bg-card px-6 py-8 shadow-xl sm:px-8 sm:py-10">
          {children}
        </div>
      </div>
    </main>
  )
}
