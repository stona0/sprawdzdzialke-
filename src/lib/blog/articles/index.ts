import { BlogArticle } from '../types';

import { article as article01 } from './01-jak-sprawdzic-mpzp-dzialki';
import { article as article02 } from './02-co-to-jest-plan-zagospodarowania-przestrzennego';
import { article as article03 } from './03-na-co-zwrocic-uwage-kupujac-dzialke';
import { article as article04 } from './04-jak-sprawdzic-media-na-dzialce';
import { article as article05 } from './05-dzialka-rolna-vs-budowlana';
import { article as article06 } from './06-strefa-zalewowa-jak-sprawdzic';
import { article as article07 } from './07-warunki-zabudowy-kiedy-potrzebne';
import { article as article08 } from './08-jak-sprawdzic-czy-dzialka-jest-budowlana';
import { article as article09 } from './09-ksiega-wieczysta-dzialki-jak-sprawdzic';
import { article as article10 } from './10-natura-2000-co-oznacza-dla-dzialki';
import { article as article11 } from './11-jak-odczytac-numer-dzialki-ewidencyjnej';

export const articles: BlogArticle[] = [
  article01,
  article02,
  article03,
  article04,
  article05,
  article06,
  article07,
  article08,
  article09,
  article10,
  article11,
];

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getAllSlugs(): string[] {
  return articles.map((a) => a.slug);
}

export function getRelatedArticles(slug: string, limit = 3): BlogArticle[] {
  const article = getArticleBySlug(slug);
  if (!article) return [];
  return article.relatedSlugs
    .map((s) => getArticleBySlug(s))
    .filter((a): a is BlogArticle => a !== undefined)
    .slice(0, limit);
}
