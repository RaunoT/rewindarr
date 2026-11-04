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

// Seerr knows a title's ID in the media server once it's there, and its TMDB
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
  // Plex's rating keys and Jellyfin's IDs, which can't clash
  const requestKeys = [request.media?.ratingKey, request.media?.jellyfinMediaId]
    .filter((key) => !!key)
    .map((key) => normalizeJellyfinId(String(key)))

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
  const titles = getTitles(plays)
  const reached = requests
    .filter(
      (request) =>
        Object.hasOwn(REQUEST_PLAY_TYPES, request.type) &&
        request.status !== DECLINED_STATUS &&
        getMediaUserIds(request.requestedBy).includes(userId),
    )
    .flatMap((request) => {
      const requestedAt = new Date(request.createdAt).getTime()
      const othersPlays = titles
        .filter((title) =>
          title.some((play) => isRequestedTitle(request, play)),
        )
        .flat()
        .filter(
          (play) =>
            play.userId !== userId &&
            play.startedAt >= requestedAt &&
            isRequestedSeason(request, play),
        )
      const title = othersPlays.length ? sumUp(othersPlays, minPercent) : null

      return title?.users ? [{ title, plays: othersPlays }] : []
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

  return {
    users: total.users,
    requests: reached.length,
    duration: total.duration,
    top: rankTitles(reached.map(({ title }) => title))[0],
  }
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
