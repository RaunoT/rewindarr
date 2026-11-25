import { afterEach, describe, expect, it, vi } from 'vitest'
import { showAppInNowPlaying } from './mediaSession'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('showAppInNowPlaying', () => {
  it('shows the page title with the square icon', () => {
    const mediaSession: { metadata: unknown } = { metadata: null }

    vi.stubGlobal('navigator', { mediaSession })
    vi.stubGlobal('document', { title: 'Rewind | Plex' })
    vi.stubGlobal(
      'MediaMetadata',
      class {
        constructor(init: MediaMetadataInit) {
          Object.assign(this, init)
        }
      },
    )

    showAppInNowPlaying()

    expect(mediaSession.metadata).toMatchObject({
      title: 'Rewind | Plex',
      artwork: [
        { src: '/icon-maskable-192x192.png', sizes: '192x192' },
        { src: '/icon-maskable-512x512.png', sizes: '512x512' },
      ],
    })
  })

  it('does nothing without the Media Session API', () => {
    vi.stubGlobal('navigator', {})

    expect(() => showAppInNowPlaying()).not.toThrow()
  })
})
