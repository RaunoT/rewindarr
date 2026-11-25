// Without artwork, iOS shows the manifest icon in Now Playing and fills its
// transparent corners with white. The maskable icon is square and opaque.
const ARTWORK: MediaImage[] = [
  { src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png' },
]

export function showAppInNowPlaying() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: document.title,
    artwork: ARTWORK,
  })
}
