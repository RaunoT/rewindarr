import { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { BASE_CSP_DIRECTIVES, IMAGE_CSP } from './src/utils/csp'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Settings are read from the config volume at runtime, never bundled
  outputFileTracingExcludes: {
    '/*': ['config/**'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/image',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'plex.tv',
        pathname: '/users/**',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn-images.dzcdn.net',
        pathname: '/images/artist/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS is left to the TLS-terminating reverse proxy so plain-HTTP
          // self-hosted installs are not locked into HTTPS across ports.
          // Pages get a stricter policy with a script nonce from the proxy.
          {
            key: 'Content-Security-Policy',
            value: BASE_CSP_DIRECTIVES.join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
      // Later entries win for the same header
      {
        source: '/api/image',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: IMAGE_CSP,
          },
        ],
      },
      {
        source: '/offline.html',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ]
  },
}
const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)
