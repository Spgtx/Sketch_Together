/** Shared site origin for canonical URLs, robots.txt, and sitemap.xml. */
const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

function validateOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const siteOrigin = validateOrigin(rawUrl);

/** Do not index preview deploys or builds without an explicit domain. */
export const indexable = Boolean(siteOrigin)
  && process.env.NODE_ENV === 'production'
  && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production');
