import type { Metadata } from 'next'
import HomePageContent from './HomePageContent'
import { FAQSection } from '@/components/seo/FAQ'

export const metadata: Metadata = {
  // Title uses root layout default (58 chars) — no explicit title here
  // to avoid template duplication ("... | SprawdzDziałkę.com" appended again)
  description:
    'Sprawdź MPZP, plan ogólny, media, ochronę przyrody i ryzyko zalewowe działki. Raport planistyczny z rejestrów publicznych, zwykle w mniej niż minutę. Pierwszy raport za darmo.',
  alternates: {
    canonical: 'https://sprawdzdzialke.com',
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <HomePageContent />
      <FAQSection />
    </div>
  )
}
