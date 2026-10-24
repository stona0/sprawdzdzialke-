import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* SiteHeader jest fixed (h-16) */}
      <main className="min-h-screen bg-white pt-16">{children}</main>
      <SiteFooter />
    </>
  )
}
