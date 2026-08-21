import type { NextConfig } from 'next';

const isGitHubPages = process.env.DEPLOY_TARGET === 'github-pages';
const repositoryBase = '/restaurant-im-jai-ai-agent';

const nextConfig: NextConfig = {
  ...(isGitHubPages ? {
    output: 'export' as const,
    basePath: repositoryBase,
    assetPrefix: repositoryBase,
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
};

export default nextConfig;
