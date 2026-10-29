import type { MetadataRoute } from 'next';
import { indexable, siteOrigin } from '@/lib/seo-config';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexable || !siteOrigin) return [];

  // Only publicly accessible pages belong here.
  // Never publish private room IDs or invitation URLs.
  return [
    {
      url: siteOrigin,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
