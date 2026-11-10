import { PlayMediaType } from '@/types/playHistory'
import { HistoryPlay } from '@/types/statsSource'
import { orderBy, sumBy, uniqBy } from 'lodash'
import { getMediaUserIds, SeerrRequestItem } from './fetchSeerr'
import { normalizeJellyfinId } from './mediaServer'
import { getRatingKey, groupPlays, isCountedPlay } from './playStats'

// A movie or show the social stories single out, with the plays they count
export type TitleStat = {
  // What its card is made from. Like the stats' rows, the newest play with a
  // rating key and a poster points at the current library item.
  play: HistoryPlay
  // The plays that count
  plays: number
  // In seconds
  duration: number
  // Who has a play that counts
  users: number
}

export type OnlyYou = {
  // The titles the user watched that nobody else did
  count: number
  // Of the titles the user watched, from 0 to 1
  share: number
  // The one the user spent the most time on
  top: TitleStat
}

export type RequestsReach = {
  // Other people who watched any of them
  users: number
  // The user's requests that someone else watched
  requests: number
  // Everyone else's time on them, in seconds
  duration: number
  // The request the most other people watched
  top: TitleStat
  // Whether the user has a play of it that counts
  isTopWatched: boolean
}

export type RequestsWatched = {
  // The user's requests that are in the media server
  added: number
  // Of them, the ones the user has a play of that counts
  watched: number
}

export type ServerYear = {
  // Everyone's time, in seconds
  duration: number
  // Who has a play that counts
  users: number
  // The user's part of the time, from 0 to 1
  share: number
  // Null without a play of one that counts
  movie: TitleStat | null
  show: TitleStat | null
}

// What the requests can ask for, by Seerr's media type
const REQUEST_PLAY_TYPES: Record<string, PlayMediaType> = {
  movie: 'movie',
  tv: 'episode',
}
// Seerr's status for a declined request, which brought nothing
const DECLINED_STATUS = 3
// And for one whose title came to the media server
const COMPLETED_STATUS = 5
// Seerr's statuses for a title that came to the media server: partly or fully
// there, or deleted since
const ADDED_MEDIA_STATUSES = [4, 5, 7]

function getDuration(plays: HistoryPlay[]): number {
  return Math.round(sumBy(plays, 'durationMs') / 1000)
}

function sumUp(plays: HistoryPlay[], minPercent: number): TitleStat {
  const newestFirst = orderBy(plays, 'startedAt', 'desc')
  const countedPlays = plays.filter((play) => isCountedPlay(play, minPercent))

  return {
    play:
      newestFirst.find((play) => getRatingKey(play) && play.thumb) ??
      newestFirst.find(getRatingKey) ??
      newestFirst[0],
    plays: countedPlays.length,
    duration: getDuration(plays),
    users: uniqBy(countedPlays, 'identityId').length,
  }
}

// The most watched first: by people, then by plays and watch time
function rankTitles(titles: TitleStat[]): TitleStat[] {
  return orderBy(
    titles,
    ['users', 'plays', 'duration'],
    ['desc', 'desc', 'desc'],
  )
}

// Each movie and each show with its plays. Music is left out, as the stories
// are about what people watched.
function getTitles(plays: HistoryPlay[]): HistoryPlay[][] {
  return ['movie', 'episode'].flatMap((mediaType) =>
    groupPlays(plays.filter((play) => play.mediaType === mediaType)),
  )
}

// The movies and shows the user watched that nobody else did, from everyone's
// plays. Null without any, or when nobody else watched anything, as then
// every title would be the user's alone.
export function getOnlyYou(
  plays: HistoryPlay[],
  userId: string,
  minPercent: number,
): OnlyYou | null {
  const isOwn = (play: HistoryPlay) => play.userId === userId
  const isCounted = (play: HistoryPlay) => isCountedPlay(play, minPercent)
  const titles = getTitles(plays)
  const watched = titles.filter((title) =>
    title.some((play) => isOwn(play) && isCounted(play)),
  )
  const onlyYou = watched.filter((title) =>
    title.every((play) => isOwn(play) || !isCounted(play)),
  )
  const hasOthers = titles.some((title) =>
    title.some((play) => !isOwn(play) && isCounted(play)),
  )

  if (!hasOthers || !onlyYou.length) {
    return null
  }

  const [top] = orderBy(
    onlyYou.map((title) => sumUp(title.filter(isOwn), minPercent)),
    ['duration', 'plays'],
    ['desc', 'desc'],
  )

  return { count: onlyYou.length, share: onlyYou.length / watched.length, top }
}

// The status and media server IDs of the version asked for, 4K or not.
// Plex's rating keys and Jellyfin's IDs, which can't clash.
function getRequestedMedia(request: SeerrRequestItem) {
  const media = request.media
  const keys = request.is4k
    ? [media?.ratingKey4k, media?.jellyfinMediaId4k]
    : [media?.ratingKey, media?.jellyfinMediaId]

  return {
    status: request.is4k ? media?.status4k : media?.status,
    keys: keys
      .filter((key) => !!key)
      .map((key) => normalizeJellyfinId(String(key))),
  }
}

// Seerr knows a title's ID in the media server while it's there, and its TMDB
// ID. Tautulli's plays carry no TMDB ID, and Tracearr's episodes carry their
// own, so only movies match by it. IDs are compared as strings.
function isRequestedTitle(
  request: SeerrRequestItem,
  play: HistoryPlay,
): boolean {
  if (play.mediaType !== REQUEST_PLAY_TYPES[request.type]) {
    return false
  }

  const ratingKey = getRatingKey(play)
  const requestKeys = getRequestedMedia(request).keys

  return (
    (!!ratingKey && requestKeys.includes(normalizeJellyfinId(ratingKey))) ||
    (play.mediaType === 'movie' &&
      !!play.tmdbId &&
      play.tmdbId === request.media?.tmdbId)
  )
}

// A request for a show's new seasons didn't bring the ones it already had
function isRequestedSeason(
  request: SeerrRequestItem,
  play: HistoryPlay,
): boolean {
  const seasons = request.seasons?.map((season) => season.seasonNumber) ?? []

  return (
    !seasons.length ||
    play.seasonNumber === null ||
    seasons.includes(play.seasonNumber)
  )
}

// Who else watched what the user asked for in Seerr, once they'd asked for
// it. Null when nobody else watched any of it.
export function getRequestsReach(
  requests: SeerrRequestItem[],
  plays: HistoryPlay[],
  userId: string,
  minPercent: number,
): RequestsReach | null {
  const reached = requests
    .filter(
      (request) =>
        Object.hasOwn(REQUEST_PLAY_TYPES, request.type) &&
        request.status !== DECLINED_STATUS &&
        getMediaUserIds(request.requestedBy).includes(userId),
    )
    .flatMap((request) => {
      const requestedAt = new Date(request.createdAt).getTime()
      // Each play is matched on its own, as two shows with one name share a
      // title in the stats
      const requestedPlays = plays.filter(
        (play) =>
          isRequestedTitle(request, play) && isRequestedSeason(request, play),
      )
      const othersPlays = requestedPlays.filter(
        (play) => play.userId !== userId && play.startedAt >= requestedAt,
      )
      const title = othersPlays.length ? sumUp(othersPlays, minPercent) : null
      // At any time, as the user may have watched it before asking for it
      const isWatched = requestedPlays.some(
        (play) => play.userId === userId && isCountedPlay(play, minPercent),
      )

      return title?.users ? [{ title, plays: othersPlays, isWatched }] : []
    })

  if (!reached.length) {
    return null
  }

  // A title asked for twice counts its plays once
  const reachedPlays = uniqBy(
    reached.flatMap(({ plays }) => plays),
    'id',
  )
  const total = sumUp(reachedPlays, minPercent)
  const top = rankTitles(reached.map(({ title }) => title))[0]

  return {
    users: total.users,
    requests: reached.length,
    duration: total.duration,
    top,
    isTopWatched: reached.some(
      ({ title, isWatched }) => title === top && isWatched,
    ),
  }
}

// How many of the user's requests they watched themselves, out of those that
// came to the media server. A show counts with a play of any requested
// season. Seerr forgets a deleted title's media server ID, so it's left out
// unless it's a movie and the plays carry TMDB IDs to match it by. Null
// without any.
export function getRequestsWatched(
  requests: SeerrRequestItem[],
  plays: HistoryPlay[],
  userId: string,
  minPercent: number,
): RequestsWatched | null {
  const hasTmdbIds = plays.some(
    (play) => play.mediaType === 'movie' && !!play.tmdbId,
  )
  const added = requests.filter((request) => {
    const media = getRequestedMedia(request)

    return (
      Object.hasOwn(REQUEST_PLAY_TYPES, request.type) &&
      request.status !== DECLINED_STATUS &&
      (request.status === COMPLETED_STATUS ||
        ADDED_MEDIA_STATUSES.includes(media.status ?? 0)) &&
      (media.keys.length > 0 ||
        (request.type === 'movie' && !!request.media?.tmdbId && hasTmdbIds)) &&
      getMediaUserIds(request.requestedBy).includes(userId)
    )
  })

  if (!added.length) {
    return null
  }

  const ownPlays = plays.filter(
    (play) => play.userId === userId && isCountedPlay(play, minPercent),
  )
  const watched = added.filter((request) =>
    ownPlays.some(
      (play) =>
        isRequestedTitle(request, play) && isRequestedSeason(request, play),
    ),
  )

  return { added: added.length, watched: watched.length }
}

// Everyone's year together, with the most watched movie and show. Null when
// nobody else played anything, as it would only repeat the user's own year.
export function getServerYear(
  plays: HistoryPlay[],
  userId: string,
  minPercent: number,
): ServerYear | null {
  const countedPlays = plays.filter((play) => isCountedPlay(play, minPercent))

  if (!countedPlays.some((play) => play.userId !== userId)) {
    return null
  }

  const duration = getDuration(plays)

  function getTop(mediaType: PlayMediaType): TitleStat | null {
    const [top] = rankTitles(
      groupPlays(plays.filter((play) => play.mediaType === mediaType))
        .map((title) => sumUp(title, minPercent))
        .filter((title) => title.plays > 0),
    )

    return top ?? null
  }

  return {
    duration,
    users: uniqBy(countedPlays, 'identityId').length,
    share: duration
      ? getDuration(plays.filter((play) => play.userId === userId)) / duration
      : 0,
    movie: getTop('movie'),
    show: getTop('episode'),
  }
}
