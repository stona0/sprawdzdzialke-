import type { Metadata } from 'next'
import HomePageContent from './HomePageContent'
import { FAQSection } from '@/components/seo/FAQ'

export const metadata: Metadata = {
  title: 'SprawdzDziałkę.com — Sprawdź działkę budowlaną online w 60 sekund',
  description:
    'Sprawdź MPZP, media, ochronę przyrody i ryzyko zalewowe działki. AI-generowany raport planistyczny w minutę. Pierwszy raport za darmo.',
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
