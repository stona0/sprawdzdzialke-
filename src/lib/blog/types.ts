export interface BlogArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  publishedAt: string;       // ISO date
  updatedAt?: string;
  readingTime: number;       // minutes
  keywords: string[];
  relatedSlugs: string[];    // internal linking
  content: string;           // HTML content
  faq: { question: string; answer: string }[];
}
