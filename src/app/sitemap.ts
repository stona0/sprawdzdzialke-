import { MetadataRoute } from 'next';
import { articles } from '@/lib/blog/articles';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://sprawdzdzialke.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ];

  // Blog articles
  const blogPages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/blog/${article.slug}`,
    lastModified: new Date(article.updatedAt || article.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // TODO: Add programmatic SEO pages per gmina when ready
  // const gminaPages = gminy.map(gmina => ({
  //   url: `${baseUrl}/sprawdz-dzialke/${gmina.slug}`,
  //   ...
  // }));

  return [...staticPages, ...blogPages];
}
