import type { NextConfig } from 'next';

/**
 * Two build targets share this config.
 *
 * The default one is the Vinext/OpenAI Sites build, which needs no extra
 * settings. Setting DEPLOY_TARGET=github-pages switches to a fully static
 * export instead, served from a project subpath rather than a domain root.
 *
 * The subpath is passed in rather than written here: GitHub serves a project
 * site at /<repository>, so hard-coding one repository's name silently breaks
 * every asset URL the moment the project is renamed or forked.
 */
const isGitHubPages = process.env.DEPLOY_TARGET === 'github-pages';

const basePath = (process.env.PAGES_BASE_PATH ?? '').replace(/\/$/, '');

const nextConfig: NextConfig = {
  ...(isGitHubPages
    ? {
        output: 'export' as const,
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
