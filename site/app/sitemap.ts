import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chonlasapmatt-art.github.io/newproject0812';
  return ['','/menu','/track','/account'].map((path, index) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: index === 1 ? 'daily' : 'weekly', priority: index === 0 ? 1 : .8 }));
}
