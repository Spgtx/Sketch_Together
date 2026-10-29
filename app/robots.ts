import type { MetadataRoute } from 'next';
import { indexable, siteOrigin } from '@/lib/seo-config';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!indexable || !siteOrigin) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
