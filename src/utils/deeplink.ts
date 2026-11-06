import { PublicSettings } from '@/types/settings'
import { ActivitySession, ItemRow, MediaServer } from '@/types/statsSource'

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
  session: ActivitySession,
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
  item: ItemRow,
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

// A movie's or show's page in Seerr, which finds it by its TMDB ID
export function getSeerrPageUrl(
  item: Pick<ItemRow, 'tmdb_id'> | null | undefined,
  type: string,
  seerrUrl: string | null | undefined,
): string | null {
  if (!item?.tmdb_id || !seerrUrl || (type !== 'movie' && type !== 'show')) {
    return null
  }

  return `${seerrUrl}/${type === 'movie' ? 'movie' : 'tv'}/${item.tmdb_id}`
}

// A movie or show that's gone from the media server can be requested again
export function getRequestUrl(
  item: ItemRow,
  type: string,
  seerrUrl: string | null | undefined,
): string | null {
  return item.is_deleted ? getSeerrPageUrl(item, type, seerrUrl) : null
}

// A movie, show or artist row's link, or once it's gone from the media server,
// its request
export function getRowDeeplink(
  item: ItemRow | null | undefined,
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
