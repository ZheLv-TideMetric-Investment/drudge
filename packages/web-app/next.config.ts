import type { NextConfig } from 'next';
import { getNodeEnv } from '@drudge/common';

const nodeEnv = getNodeEnv();

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
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
