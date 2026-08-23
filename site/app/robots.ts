import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chonlasapmatt-art.github.io/newproject0812';
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin'] }], sitemap: `${base}/sitemap.xml` };
}
