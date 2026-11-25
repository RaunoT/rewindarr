import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearNowPlaying, showAppInNowPlaying } from './mediaSession'

class FakeMediaMetadata {
  constructor(init: MediaMetadataInit) {
    Object.assign(this, init)
  }
}

function stubMediaSession() {
  const mediaSession: { metadata: unknown } = { metadata: null }

  vi.stubGlobal('navigator', { mediaSession })
  vi.stubGlobal('document', { title: 'Rewind | Plex' })
  vi.stubGlobal('MediaMetadata', FakeMediaMetadata)

  return mediaSession
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('showAppInNowPlaying', () => {
  it('shows the page title with the square icon, largest first', () => {
    const mediaSession = stubMediaSession()

    showAppInNowPlaying()

    expect(mediaSession.metadata).toMatchObject({
      title: 'Rewind | Plex',
      artwork: [
        { src: '/icon-maskable-512x512.png', sizes: '512x512' },
        { src: '/icon-maskable-192x192.png', sizes: '192x192' },
      ],
    })
  })

  it('does nothing without the Media Session API', () => {
    vi.stubGlobal('navigator', {})

    expect(() => showAppInNowPlaying()).not.toThrow()
  })

  it('does nothing when only part of the API is there', () => {
    vi.stubGlobal('navigator', { mediaSession: null })
    vi.stubGlobal('MediaMetadata', FakeMediaMetadata)

    expect(() => showAppInNowPlaying()).not.toThrow()

    vi.stubGlobal('navigator', { mediaSession: { metadata: null } })
    vi.stubGlobal('MediaMetadata', undefined)

    expect(() => showAppInNowPlaying()).not.toThrow()
  })
})

describe('clearNowPlaying', () => {
  it('removes what showAppInNowPlaying set', () => {
    const mediaSession = stubMediaSession()

    showAppInNowPlaying()
    clearNowPlaying()

    expect(mediaSession.metadata).toBeNull()
  })

  it('does nothing without the Media Session API', () => {
    vi.stubGlobal('navigator', {})

    expect(() => clearNowPlaying()).not.toThrow()
  })
})
