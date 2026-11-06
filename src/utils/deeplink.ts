import { PublicSettings } from '@/types/settings'
import { MediaServer } from '@/types/statsSource'
import { TautulliItemRow, TautulliSession } from '@/types/tautulli'

export function isIosDevice(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  )
}

// Jellyfin's web app takes the item's ID, and works on phones too
export function generateDeeplinkUrl(
  ratingKey: number | string,
  server: MediaServer,
  isIos: boolean = isIosDevice(),
): string {
  if (server.type === 'jellyfin') {
    return `${server.url}/web/#/details?id=${encodeURIComponent(ratingKey)}&serverId=${encodeURIComponent(server.id)}`
  }

  if (isIos) {
    return `plex://preplay/?metadataKey=%2Flibrary%2Fmetadata%2F${ratingKey}&server=${server.id}`
  }

  return `https://app.plex.tv/desktop#!/server/${server.id}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`
}

export function getDeeplinkRatingKeyFromSession(
  session: TautulliSession,
): number | string {
  if (session.media_type === 'track') {
    return session.parent_rating_key ?? session.rating_key
  }

  return session.rating_key
}

// What a poster's link opens: the item in the media server, or Seerr, where it
// can be requested
export type Deeplink =
  | { mediaServer: MediaServer; ratingKey: number | string }
  | { requestUrl: string }

export function getDeeplinkRatingKeyFromRow(
  item: TautulliItemRow,
  type?: string,
): number | string {
  if (type === 'artist') {
    return item.grandparent_rating_key ?? item.rating_key
  }

  return item.rating_key
}

// Seerr's address, while it's set up
export function getSeerrUrl({ connection }: PublicSettings): string | null {
  return connection.isSeerrActive ? connection.seerrUrl : null
}

// A movie or show that's gone from the media server can be requested again in
// Seerr, which finds it by its TMDB ID
export function getRequestUrl(
  item: TautulliItemRow,
  type: string,
  seerrUrl: string | null | undefined,
): string | null {
  if (
    !item.is_deleted ||
    !seerrUrl ||
    !item.tmdb_id ||
    (type !== 'movie' && type !== 'show')
  ) {
    return null
  }

  return `${seerrUrl}/${type === 'movie' ? 'movie' : 'tv'}/${item.tmdb_id}`
}

// A movie, show or artist row's link, or once it's gone from the media server,
// its request
export function getRowDeeplink(
  item: TautulliItemRow | null | undefined,
  type: string,
  mediaServer: MediaServer | null | undefined,
  seerrUrl?: string | null,
): Deeplink | null {
  if (!item) {
    return null
  }

  if (item.is_deleted) {
    const requestUrl = getRequestUrl(item, type, seerrUrl)

    return requestUrl ? { requestUrl } : null
  }

  if (!mediaServer) {
    return null
  }

  const ratingKey = getDeeplinkRatingKeyFromRow(item, type)

  return ratingKey ? { mediaServer, ratingKey } : null
}
