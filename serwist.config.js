// @ts-check
import { serwist } from '@serwist/next/config'

const config = await serwist({
  swSrc: 'src/lib/sw.ts',
  swDest: 'public/sw.js',
  // Only the static offline fallback and its assets; hashed build chunks are
  // cached as they are used.
  globPatterns: ['public/{manifest.json,offline.html,offline.js,icon-*.png}'],
  precachePrerendered: false,
})
// @serwist/next turns `public/offline.html` into `/public/offline`; restore its
// real URL while keeping the content hash revision it computed.
const serwistConfig = {
  ...config,
  manifestTransforms: [
    ...(config.manifestTransforms ?? []),
    /** @param {import('serwist').PrecacheEntry[]} manifest */
    (manifest) => {
      const mapped = manifest.map((entry) =>
        entry.url === '/public/offline'
          ? { ...entry, url: '/offline.html' }
          : entry,
      )

      if (!mapped.some((entry) => entry.url === '/offline.html')) {
        throw new Error(
          'Expected /offline.html in Serwist precache manifest after URL transform',
        )
      }

      return { manifest: mapped, warnings: [] }
    },
  ],
}

export default serwistConfig
