import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn-ultra.esempla.com',
        pathname: '/storage/**',
      },
    ],
  },
};

export default nextConfig;
