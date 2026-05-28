import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { articles, getArticleBySlug, getAllSlugs, getRelatedArticles } from '@/lib/blog/articles';
import type { Metadata } from 'next';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Static params — pre-render all articles at build time                    */
/* ────────────────────────────────────────────────────────────────────────── */
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Dynamic metadata per article                                             */
/* ────────────────────────────────────────────────────────────────────────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: article.metaTitle,
    description: article.metaDescription,
    keywords: article.keywords,
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      url: `https://sprawdzdzialke.com/blog/${article.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.metaTitle,
      description: article.metaDescription,
    },
    alternates: {
      canonical: `https://sprawdzdzialke.com/blog/${article.slug}`,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  JSON-LD Article schema                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
function ArticleJsonLd({ article }: { article: NonNullable<ReturnType<typeof getArticleBySlug>> }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'SprawdzDziałkę.com',
      url: 'https://sprawdzdzialke.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SprawdzDziałkę.com',
      url: 'https://sprawdzdzialke.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://sprawdzdzialke.com/blog/${article.slug}`,
    },
    wordCount: article.content.split(/\s+/).length,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FAQ JSON-LD                                                              */
/* ────────────────────────────────────────────────────────────────────────── */
function FaqJsonLd({ faq }: { faq: { question: string; answer: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Page component                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug, 3);

  return (
    <div className="min-h-screen bg-white font-sans">
      <ArticleJsonLd article={article} />
      <FaqJsonLd faq={article.faq} />

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-gray-900"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Sprawdź<span className="text-green-700">Działkę</span>.pl
          </Link>
          <div
            className="hidden md:flex items-center gap-8 text-gray-700"
            style={{ fontFamily: 'var(--font-playfair)', fontSize: '1rem' }}
          >
            <Link href="/blog" className="hover:text-gray-900 transition-colors">
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

      {/* BREADCRUMB */}
      <div className="pt-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Wszystkie artykuły
          </Link>
        </div>
      </div>

      {/* ARTICLE */}
      <article className="pt-6 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
              <time dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleDateString('pl-PL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {article.readingTime} min czytania
              </span>
            </div>
            <h1
              className="text-3xl md:text-4xl lg:text-[2.5rem] text-gray-900 leading-tight tracking-tight"
              style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700 }}
            >
              {article.title}
            </h1>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">{article.excerpt}</p>
          </header>

          {/* Content */}
          <div
            className="
              prose prose-lg max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-gray-700 prose-p:leading-relaxed
              prose-li:text-gray-700
              prose-a:text-green-700 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-green-600
              prose-strong:text-gray-900
              prose-table:border-collapse prose-th:bg-gray-50 prose-th:p-3 prose-th:text-left prose-th:border prose-th:border-gray-200 prose-td:p-3 prose-td:border prose-td:border-gray-200
            "
            style={{ fontFamily: 'var(--font-playfair)' }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* FAQ Section */}
          {article.faq.length > 0 && (
            <section className="mt-14 border-t border-gray-200 pt-10">
              <h2
                className="text-2xl font-bold text-gray-900 mb-6"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Często zadawane pytania
              </h2>
              <div className="space-y-6">
                {article.faq.map((item, i) => (
                  <details
                    key={i}
                    className="group border border-gray-200 rounded-lg"
                    open={i === 0}
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-5 text-gray-900 font-medium hover:text-green-700 transition-colors">
                      {item.question}
                      <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="px-5 pb-5 text-gray-600 leading-relaxed">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="mt-14 bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <h3
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Sprawdź swoją działkę w 60 sekund
            </h3>
            <p className="mt-2 text-gray-600">
              MPZP, media, Natura 2000, strefy zalewowe i rekomendacje AI w jednym raporcie.
            </p>
            <Link
              href="/register"
              className="inline-block mt-4 bg-green-700 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-green-600 transition-colors"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Pierwszy raport za darmo →
            </Link>
          </section>

          {/* Related Articles */}
          {related.length > 0 && (
            <section className="mt-14">
              <h3
                className="text-xl font-bold text-gray-900 mb-4"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Powiązane artykuły
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-sm transition-all"
                  >
                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-green-700">
                      {r.title}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">{r.readingTime} min czytania</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
