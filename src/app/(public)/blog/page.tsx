import Link from 'next/link';
import { FileText, Clock, ChevronRight } from 'lucide-react';
import { articles } from '@/lib/blog/articles';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Poradniki o działkach i nieruchomościach',
  description:
    'Praktyczne poradniki o zakupie działek, MPZP, warunkach zabudowy, mediach i strefach ochronnych. Wiedza, która pomoże Ci podjąć lepszą decyzję.',
  openGraph: {
    title: 'Blog — SprawdzDziałkę.com',
    description: 'Poradniki o działkach budowlanych, MPZP, warunkach zabudowy i więcej.',
  },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* NAV — reuse from homepage or import shared nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-gray-900"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Sprawdź<span className="text-green-700">Działkę</span>.com
          </Link>
          <div
            className="hidden md:flex items-center gap-8 text-gray-700"
            style={{ fontFamily: 'var(--font-playfair)', fontSize: '1rem' }}
          >
            <Link href="/blog" className="text-green-700 font-medium">
              Blog
            </Link>
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">
              Cennik
            </Link>
            <Link href="/login" className="hover:text-gray-900 transition-colors">
              Zaloguj się
            </Link>
          </div>
          <Link
            href="/register"
            className="bg-gray-900 text-white text-sm px-5 py-2 rounded-full hover:bg-gray-700 transition-colors"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Zacznij za darmo
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <section className="pt-28 pb-12 px-6 bg-gradient-to-b from-green-50/50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-4xl md:text-5xl text-gray-900 tracking-tight"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}
          >
            Blog
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-playfair)' }}>
            Praktyczne poradniki o zakupie działek, planowaniu przestrzennym
            i wszystkim co musisz wiedzieć przed inwestycją w nieruchomość.
          </p>
        </div>
      </section>

      {/* ARTICLES LIST */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-6">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group block bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {new Date(article.publishedAt).toLocaleDateString('pl-PL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {article.readingTime} min czytania
                      </span>
                    </div>
                    <h2
                      className="text-xl font-semibold text-gray-900 group-hover:text-green-700 transition-colors"
                      style={{ fontFamily: 'var(--font-playfair)' }}
                    >
                      {article.title}
                    </h2>
                    <p className="mt-2 text-gray-600 line-clamp-2">{article.excerpt}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {article.keywords.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 mt-1 flex-shrink-0 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto bg-gray-900 rounded-2xl p-8 md:p-12 text-center">
          <h2
            className="text-2xl md:text-3xl text-white"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}
          >
            Sprawdź swoją działkę w 60 sekund
          </h2>
          <p className="mt-3 text-gray-400 max-w-lg mx-auto">
            MPZP, strefy ochronne, media, Natura 2000 i rekomendacje AI — wszystko w jednym raporcie.
          </p>
          <Link
            href="/register"
            className="inline-block mt-6 bg-green-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-500 transition-colors"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Pierwszy raport za darmo →
          </Link>
        </div>
      </section>
    </div>
  );
}
