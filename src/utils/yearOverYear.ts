import { Play, PlayMediaType } from '@/types/playHistory'
import { RewindPeriod } from '@/types/rewind'
import { ItemRow } from '@/types/statsSource'
import { PreviousFavorite, YearOverYear } from '@/types/yearOverYear'
import { maxBy, minBy, sumBy, uniq } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { secondsToTime } from './formatting'
import getSettings from './getSettings'
import { getDifference } from './helpers'
import { groupPlays, isCountedPlay, isPlayOfItem } from './playStats'
import {
  getPreviousEdition,
  getRewindPeriodType,
  isEditionOngoing,
} from './rewindPeriod'
import { toDateKey } from './timeZone'

const DAY = 24 * 60 * 60 * 1000
// With fewer plays that count in the earlier period, or on fewer days, the
// change says more about a few evenings than about the user
const MIN_PREVIOUS_PLAYS = 10
const MIN_PREVIOUS_DAYS = 5
// A user whose first play is this far into the earlier period was still
// around for most of it
const LATE_START_SHARE = 1 / 12

export type PeriodPlays<T extends Play = Play> = {
  previous: T[]
  current: T[]
}

// The period's favourite, as its story's card shows it
export type FavoriteItem = Pick<ItemRow, 'media_id' | 'title' | 'year'>

export type FavoriteChange = {
  // The newest play of the earlier favourite, for its title
  play: Play
  isSame: boolean
}

// From `since` up to `until`, exclusive
export type TimeWindow = {
  since: number
  until: number
}

export type YearComparison = {
  previous: TimeWindow
  // In seconds
  previousDuration: number
  // In percent, positive when the user spent more time in the period
  difference: number
  shows: FavoriteChange | null
  movies: FavoriteChange | null
}

type CompareOptions = {
  // The start of the period
  since: number
  // Its end, which a period that runs to now doesn't have
  until?: number
  now?: number
  // The period to compare with, as long a one before the start without one
  previous?: TimeWindow
  minPlayPercent: number
  // The server's without one
  timeZone?: string
  favorites?: Partial<Record<'shows' | 'movies', FavoriteItem>>
}

function getDuration(plays: Play[]): number {
  return Math.round(sumBy(plays, 'durationMs') / 1000)
}

// The period as long as the one from the start to now, which ends where that
// one starts. Null before the start.
export function getPreviousStart(since: number, now: number): number | null {
  return since < now ? since - (now - since) : null
}

function isInWindow(play: Play, { since, until }: TimeWindow): boolean {
  return play.startedAt >= since && play.startedAt < until
}

// The plays in the earlier period and in the period
export function splitPlays<T extends Play>(
  plays: T[],
  previous: TimeWindow,
  current: TimeWindow,
): PeriodPlays<T> {
  return {
    previous: plays.filter((play) => isInWindow(play, previous)),
    current: plays.filter((play) => isInWindow(play, current)),
  }
}

// The movie or show the user spent the most time on in the earlier period,
// and whether it's the period's favourite. Time ranks them, as in the
// stories, but the earlier favourite needs a play that counts. Like the
// stories, it's only a favourite when it was played again, and null
// otherwise. The period's favourite is the one its story shows, so a tie
// can't make them disagree.
export function getFavoriteChange(
  { previous, current }: PeriodPlays,
  mediaType: PlayMediaType,
  minPercent: number,
  favorite?: FavoriteItem,
): FavoriteChange | null {
  if (!favorite) {
    return null
  }

  const previousIds = new Set(previous.map((play) => play.id))
  const typePlays = [...previous, ...current].filter(
    (play) => play.mediaType === mediaType,
  )
  // Grouped together, so a title is the same one in both periods
  const titles = groupPlays(typePlays).map((plays) => ({
    plays,
    previous: plays.filter((play) => previousIds.has(play.id)),
  }))
  const previousTop = maxBy(
    titles.filter((title) =>
      title.previous.some((play) => isCountedPlay(play, minPercent)),
    ),
    (title) => sumBy(title.previous, 'durationMs'),
  )

  if (
    !previousTop ||
    previousTop.previous.filter((play) => isCountedPlay(play, minPercent))
      .length < 2
  ) {
    return null
  }

  return {
    play: maxBy(previousTop.plays, 'startedAt')!,
    isSame: previousTop.plays.some((play) => isPlayOfItem(play, favorite)),
  }
}

// The user's period next to the one before it, from all their plays. Null
// unless they were around for the earlier period and played enough in it,
// and without a play that counts in the period.
export function compareYears(
  allPlays: Play[],
  {
    since,
    until = Infinity,
    now = Date.now(),
    previous: previousWindow,
    minPlayPercent,
    timeZone,
    favorites,
  }: CompareOptions,
): YearComparison | null {
  const previousSince = getPreviousStart(since, now)
  const firstPlay = minBy(allPlays, 'startedAt')

  if (previousSince === null || !firstPlay) {
    return null
  }

  const previous = previousWindow ?? { since: previousSince, until: since }
  const latestFirstPlay =
    previous.since + (previous.until - previous.since) * LATE_START_SHARE
  const periods = splitPlays(allPlays, previous, { since, until })
  const isCounted = (play: Play) => isCountedPlay(play, minPlayPercent)
  const previousCounted = periods.previous.filter(isCounted)
  const previousDays = uniq(
    previousCounted.map((play) => toDateKey(play.startedAt, timeZone)),
  )
  const previousDuration = getDuration(periods.previous)

  if (
    firstPlay.startedAt > latestFirstPlay ||
    previousCounted.length < MIN_PREVIOUS_PLAYS ||
    previousDays.length < MIN_PREVIOUS_DAYS ||
    !previousDuration ||
    !periods.current.some(isCounted)
  ) {
    return null
  }

  return {
    previous,
    previousDuration,
    difference: getDifference(getDuration(periods.current), previousDuration),
    shows: getFavoriteChange(
      periods,
      'episode',
      minPlayPercent,
      favorites?.shows,
    ),
    movies: getFavoriteChange(
      periods,
      'movie',
      minPlayPercent,
      favorites?.movies,
    ),
  }
}

function toDateString(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

// Episodes go by their show
function toPreviousFavorite({
  play,
  isSame,
}: FavoriteChange): PreviousFavorite {
  return {
    title: (play.mediaType === 'episode' && play.showTitle) || play.title,
    isSame,
  }
}

// The year over year as the stories show it. All the user's plays are null
// until the whole history has been read, which it waits for, as only then are
// the earlier period's plays all there. An edition is compared with the one
// before, and the other periods with as long a one before them.
export async function getYearOverYear(
  allPlays: Play[] | null,
  period: RewindPeriod,
  timeZone?: string,
  favorites?: CompareOptions['favorites'],
): Promise<YearOverYear | null> {
  if (!allPlays) {
    return null
  }

  const settings = getSettings()
  const since = Date.parse(period.since)
  const now = Date.now()
  const comparison = compareYears(allPlays, {
    since,
    until: period.until ? Date.parse(period.until) : undefined,
    now,
    previous:
      period.year === null
        ? undefined
        : getPreviousEdition(period, timeZone, now),
    minPlayPercent: settings.general.minPlayPercent,
    timeZone,
    favorites,
  })

  if (!comparison) {
    return null
  }

  const t = await getTranslations()

  return {
    since: toDateString(comparison.previous.since),
    until: toDateString(since - DAY),
    isYear: getRewindPeriodType(settings) !== 'custom',
    isSoFar: isEditionOngoing(period, now),
    duration: secondsToTime(comparison.previousDuration, t),
    difference: comparison.difference,
    shows: comparison.shows && toPreviousFavorite(comparison.shows),
    movies: comparison.movies && toPreviousFavorite(comparison.movies),
  }
}
