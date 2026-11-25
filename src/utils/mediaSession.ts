// Without artwork, iOS shows the manifest icon in Now Playing and fills its
// transparent corners with white. The maskable icon is square and opaque.
// Older Safari takes the first image instead of picking by size.
const ARTWORK: MediaImage[] = [
  { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png' },
  { src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png' },
]

// Called right before audio plays, so it must never throw
function getMediaSession(): MediaSession | null {
  if (
    typeof navigator === 'undefined' ||
    typeof MediaMetadata === 'undefined'
  ) {
    return null
  }

  return navigator.mediaSession ?? null
}

export function showAppInNowPlaying() {
  const mediaSession = getMediaSession()

  if (mediaSession) {
    mediaSession.metadata = new MediaMetadata({
      title: document.title,
      artwork: ARTWORK,
    })
  }
}

// Only once the audio is gone: a paused track stays on the lock screen
export function clearNowPlaying() {
  const mediaSession = getMediaSession()

  if (mediaSession) {
    mediaSession.metadata = null
  }
}
