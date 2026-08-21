import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://imjai-cafe-kitchen-bangkok.edtech4.chatgpt.site';
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin'] }], sitemap: `${base}/sitemap.xml` };
}
