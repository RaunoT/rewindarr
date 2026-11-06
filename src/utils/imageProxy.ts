// Plex image paths are served through Tautulli by /api/image; full URLs
// (plex.tv avatars, Tracearr images) are proxied as-is if allowed.
export function getImageProxyUrl(image: string | null | undefined): string {
  if (image?.startsWith('http')) {
    return `/api/image?url=${encodeURIComponent(image)}`
  }

  return `/api/image?img=${encodeURIComponent(image ?? '')}&width=300`
}
