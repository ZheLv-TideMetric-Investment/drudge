import type { NextConfig } from 'next';
import { buildWebConfig, getNodeEnv } from '@drudge/common';

const nodeEnv = getNodeEnv();
const webConfig = buildWebConfig();
const briefingPublicHost = (() => {
  try {
    return new URL(webConfig.notification.briefing.publicBaseUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  serverExternalPackages: ['@resvg/resvg-js'],
  // Public information only, used for message URL validation and noindex response headers.
  env: {
    DRUDGE_BRIEFING_PUBLIC_HOST: briefingPublicHost,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // 如果在开发环境中使用，可以启用这些选项
  ...(nodeEnv === 'development' && {
    reactStrictMode: true,
  }),
};

export default nextConfig;
