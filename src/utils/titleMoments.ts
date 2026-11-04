import { Play, PlayMediaType } from '@/types/playHistory'
import { TitleCard, TitleMoments } from '@/types/titleMoments'
import { groupBy, mapValues, minBy, orderBy, sumBy } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { secondsToTime } from './formatting'
import getSettings from './getSettings'
import { groupPlays, isCountedPlay } from './playStats'
import { getStatsSource } from './statsSource'

// What a play rolls up into, as in the dashboard's lists
const ITEM_TYPES = {
  movie: 'movie',
  episode: 'show',
  track: 'artist',
} as const
// The media whose release year is worth travelling to
const VIDEO_TYPES: PlayMediaType[] = ['movie', 'episode']
// Less than this on a movie reads as a misclick, not a try
const MIN_GAVE_UP_MS = 10 * 60 * 1000
const MIN_GAVE_UP_PERCENT = 10
// Past this, only the credits were left
const MAX_GAVE_UP_PERCENT = 90
// A movie played this recently may still be finished
const GAVE_UP_AFTER_MS = 14 * 24 * 60 * 60 * 1000

export type ComfortWatch = {
  // The newest play of it, for its card
  play: Play
  watches: number
  isEpisode: boolean
}

export type TimeTravel = {
  // The decade's first year, such as 1990
  decade: number
  // Of the time on movies and shows with a year, from 0 to 1
  share: number
  oldest: { play: Play; year: number }
}

export type Discoveries = {
  shows: number
  artists: number
  top: { play: Play; durationMs: number }
}

export type GaveUp = {
  play: Play
  // From 0 to 1
  percent: number
}

function ofType(plays: Play[], mediaType: PlayMediaType): Play[] {
  return plays.filter((play) => play.mediaType === mediaType)
}

function getNewest(plays: Play[]): Play {
  return orderBy(plays, 'startedAt', 'desc')[0]
}

// A title's play from its oldest year, the newest of them for its card
function getOldestPlay(plays: Play[]): Play {
  return orderBy(plays, ['year', 'startedAt'], ['asc', 'desc'])[0]
}

// A show's episodes are told apart by their season and number, or without
// those by their title
function getEpisodeKey(play: Play): string {
  return play.seasonNumber !== null && play.episodeNumber !== null
    ? `${play.seasonNumber}x${play.episodeNumber}`
    : play.title.trim().toLowerCase()
}

// Sources split some watches into plays and log reopening an item at its end,
// so the plays that count are capped by how many times its length the time on
// it adds up to. The time includes the short plays a split watch starts with.
function getWatchCount(plays: Play[], minPercent: number): number {
  const countedPlays = plays.filter((play) => isCountedPlay(play, minPercent))
  // The source's length where it gives one. Otherwise a play from the start
  // lasts its percent of the length, a resumed one less, and only the plays
  // that count get far enough to tell it.
  const length =
    Math.max(0, ...plays.map((play) => play.lengthMs ?? 0)) ||
    Math.max(
      0,
      ...countedPlays.map(({ durationMs, percentComplete }) =>
        percentComplete ? durationMs / (percentComplete / 100) : 0,
      ),
    )

  // Without a length or a percent complete, the length is unknown
  if (!length) {
    return countedPlays.length
  }

  // A watch counts from three quarters of the length
  return Math.min(
    countedPlays.length,
    Math.floor(sumBy(plays, 'durationMs') / length + 0.25),
  )
}

// The movie the user watched the most times, or an episode they watched more
// times than any movie, from twice up. Each watch needs a play that counts.
export function getComfortWatch(
  plays: Play[],
  minPercent: number,
): ComfortWatch | null {
  const movies = groupPlays(ofType(plays, 'movie'))
  const episodes = groupPlays(ofType(plays, 'episode')).flatMap((showPlays) =>
    Object.values(groupBy(showPlays, getEpisodeKey)),
  )
  // A tie goes to the movie, and then to the most time
  const [top] = orderBy(
    [...movies, ...episodes].map((group) => ({
      group,
      watches: getWatchCount(group, minPercent),
      isMovie: group[0].mediaType === 'movie',
      duration: sumBy(group, 'durationMs'),
    })),
    ['watches', 'isMovie', 'duration'],
    ['desc', 'desc', 'desc'],
  )

  if (!top || top.watches < 2) {
    return null
  }

  return {
    play: getNewest(top.group),
    watches: top.watches,
    isEpisode: !top.isMovie,
  }
}

// The release decade the user spent the most time in, and the oldest movie or
// show they watched. The plays carry an episode's own year, when it aired, so
// a long-running show counts towards each of its decades.
export function getTimeTravel(
  plays: Play[],
  minPercent: number,
): TimeTravel | null {
  const datedPlays = plays.filter(
    (play) => VIDEO_TYPES.includes(play.mediaType) && play.year,
  )
  const decades = mapValues(
    groupBy(datedPlays, (play) => Math.floor((play.year ?? 0) / 10) * 10),
    (decadePlays) => sumBy(decadePlays, 'durationMs'),
  )
  const totalDuration = sumBy(datedPlays, 'durationMs')
  const [topDecade] = orderBy(
    Object.entries(decades),
    ([, duration]) => duration,
    'desc',
  )
  // A play that doesn't count can't take the user furthest back
  const countedPlays = datedPlays.filter((play) =>
    isCountedPlay(play, minPercent),
  )
  const titles = VIDEO_TYPES.flatMap((mediaType) =>
    groupPlays(ofType(countedPlays, mediaType)),
  )
  const [oldestTitle] = orderBy(
    titles,
    [
      (group) => getOldestPlay(group).year,
      (group) => sumBy(group, 'durationMs'),
    ],
    ['asc', 'desc'],
  )
  const oldest = oldestTitle && getOldestPlay(oldestTitle)

  // Without a second decade, there's no travelling
  if (Object.keys(decades).length < 2 || !totalDuration || !oldest?.year) {
    return null
  }

  return {
    decade: Number(topDecade[0]),
    share: topDecade[1] / totalDuration,
    oldest: { play: oldest, year: oldest.year },
  }
}

// The shows and artists the user played for the first time in the period,
// with a play that counts, and the one they spent the most time on. All the
// user's plays include those in the period. A user without plays before the
// period would find everything new, so there's nothing to tell them.
export function getDiscoveries(
  plays: Play[],
  allPlays: Play[],
  minPercent: number,
): Discoveries | null {
  const periodIds = new Set(plays.map((play) => play.id))
  const isInPeriod = (play: Play) => periodIds.has(play.id)
  const periodStart = minBy(plays, 'startedAt')?.startedAt

  if (
    periodStart === undefined ||
    !allPlays.some((play) => !isInPeriod(play) && play.startedAt < periodStart)
  ) {
    return null
  }

  // Each new title's plays in the period
  function getNew(mediaType: PlayMediaType): Play[][] {
    return groupPlays(ofType(allPlays, mediaType))
      .filter((group) => {
        const firstPlay = minBy(group, 'startedAt')

        return (
          !!firstPlay &&
          isInPeriod(firstPlay) &&
          group.some(
            (play) => isInPeriod(play) && isCountedPlay(play, minPercent),
          )
        )
      })
      .map((group) => group.filter(isInPeriod))
  }

  const shows = getNew('episode')
  const artists = getNew('track')
  const [top] = orderBy(
    [...shows, ...artists],
    (group) => sumBy(group, 'durationMs'),
    'desc',
  )

  if (!top) {
    return null
  }

  return {
    shows: shows.length,
    artists: artists.length,
    top: { play: getNewest(top), durationMs: sumBy(top, 'durationMs') },
  }
}

// A movie the user played in the period but has never finished, the one they
// got the furthest in. It needs enough of their time not to be a misclick,
// and to be left long enough that they're not still in the middle of it.
export function getGaveUp(
  plays: Play[],
  allPlays: Play[],
  minPercent: number,
  now = Date.now(),
): GaveUp | null {
  const periodIds = new Set(plays.map((play) => play.id))
  const movies = groupPlays(ofType(allPlays, 'movie'))
    .filter(
      (group) =>
        group.some((play) => periodIds.has(play.id)) &&
        !group.some((play) => isCountedPlay(play, minPercent)) &&
        now - getNewest(group).startedAt >= GAVE_UP_AFTER_MS &&
        sumBy(group, 'durationMs') >= MIN_GAVE_UP_MS,
    )
    .map((group) => ({
      play: getNewest(group),
      // Only a play with a percent complete can fall short of counting
      percent: Math.max(...group.map((play) => play.percentComplete ?? 0)),
      duration: sumBy(group, 'durationMs'),
    }))
    .filter(
      ({ percent }) =>
        percent >= MIN_GAVE_UP_PERCENT && percent < MAX_GAVE_UP_PERCENT,
    )
  const [top] = orderBy(movies, ['percent', 'duration'], ['desc', 'desc'])

  return top ? { play: top.play, percent: top.percent / 100 } : null
}

// The title moments as the stories show them. All the user's plays are null
// until the whole history has been read, which the discoveries and the movie
// they gave up on wait for.
export async function getTitleMoments(
  plays: Play[],
  allPlays: Play[] | null,
): Promise<TitleMoments> {
  const t = await getTranslations()
  const settings = getSettings()
  const source = getStatsSource(settings)
  const minPercent = settings.general.minPlayPercent
  const comfortWatch = getComfortWatch(plays, minPercent)
  const timeTravel = getTimeTravel(plays, minPercent)
  const discoveries = allPlays && getDiscoveries(plays, allPlays, minPercent)
  const gaveUp = allPlays && getGaveUp(plays, allPlays, minPercent)

  // Without a user, the card's watch time and plays are only this play's
  async function getCard(play: Play): Promise<TitleCard> {
    return {
      item: await source.getPlayItem(play),
      type: ITEM_TYPES[play.mediaType],
    }
  }

  const [comfortCard, oldestCard, discoveryCard] = await Promise.all([
    comfortWatch && getCard(comfortWatch.play),
    timeTravel && getCard(timeTravel.oldest.play),
    discoveries && getCard(discoveries.top.play),
  ])

  return {
    comfortWatch:
      comfortWatch && comfortCard
        ? {
            ...comfortCard,
            episode: comfortWatch.isEpisode ? comfortWatch.play.title : null,
            watches: comfortWatch.watches,
          }
        : null,
    timeTravel:
      timeTravel && oldestCard
        ? {
            decade: timeTravel.decade,
            share: timeTravel.share,
            oldest: { ...oldestCard, year: timeTravel.oldest.year },
          }
        : null,
    discoveries:
      discoveries && discoveryCard
        ? {
            shows: discoveries.shows,
            artists: discoveries.artists,
            top: {
              ...discoveryCard,
              duration: secondsToTime(discoveries.top.durationMs / 1000, t),
            },
          }
        : null,
    gaveUp: gaveUp && { title: gaveUp.play.title, percent: gaveUp.percent },
  }
}
