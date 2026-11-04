import { Play, PlayMediaType } from '@/types/playHistory'
import { PreviousFavorite, YearOverYear } from '@/types/yearOverYear'
import { maxBy, minBy, sumBy, uniq } from 'lodash'
import { getTranslations } from 'next-intl/server'
import { secondsToTime } from './formatting'
import getSettings from './getSettings'
import { getDifference, getRewindStartDate } from './helpers'
import { groupPlays, isCountedPlay } from './playStats'
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

export type FavoriteChange = {
  // The newest play of the earlier favourite, for its title
  play: Play
  isSame: boolean
}

export type YearComparison = {
  previousSince: number
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
  now?: number
  minPlayPercent: number
  // The server's without one
  timeZone?: string
}

function getDuration(plays: Play[]): number {
  return Math.round(sumBy(plays, 'durationMs') / 1000)
}

// The period as long as the one from the start to now, which ends where that
// one starts. Null before the start.
export function getPreviousStart(since: number, now: number): number | null {
  return since < now ? since - (now - since) : null
}

// The plays from the earlier period's start on, split at the period's start
export function splitPlays<T extends Play>(
  plays: T[],
  previousSince: number,
  since: number,
): PeriodPlays<T> {
  return {
    previous: plays.filter(
      (play) => play.startedAt >= previousSince && play.startedAt < since,
    ),
    current: plays.filter((play) => play.startedAt >= since),
  }
}

// The movie or show the user spent the most time on in the earlier period,
// and whether they still did in the period. Time ranks them, as in the
// stories, but the earlier favourite needs a play that counts.
export function getFavoriteChange(
  { previous, current }: PeriodPlays,
  mediaType: PlayMediaType,
  minPercent: number,
): FavoriteChange | null {
  const previousIds = new Set(previous.map((play) => play.id))
  const typePlays = [...previous, ...current].filter(
    (play) => play.mediaType === mediaType,
  )
  // Grouped together, so a title is the same one in both periods
  const titles = groupPlays(typePlays).map((plays) => ({
    plays,
    previous: plays.filter((play) => previousIds.has(play.id)),
    current: plays.filter((play) => !previousIds.has(play.id)),
  }))
  const currentTop = maxBy(
    titles.filter((title) => title.current.length),
    (title) => sumBy(title.current, 'durationMs'),
  )
  const previousTop = maxBy(
    titles.filter((title) =>
      title.previous.some((play) => isCountedPlay(play, minPercent)),
    ),
    (title) => sumBy(title.previous, 'durationMs'),
  )

  if (!currentTop || !previousTop) {
    return null
  }

  return {
    play: maxBy(previousTop.plays, 'startedAt')!,
    isSame: currentTop === previousTop,
  }
}

// The user's period next to the one before it, from all their plays. Null
// unless they were around for the earlier period and played enough in it,
// and without a play that counts in the period.
export function compareYears(
  allPlays: Play[],
  { since, now = Date.now(), minPlayPercent, timeZone }: CompareOptions,
): YearComparison | null {
  const previousSince = getPreviousStart(since, now)
  const firstPlay = minBy(allPlays, 'startedAt')

  if (previousSince === null || !firstPlay) {
    return null
  }

  const latestFirstPlay =
    previousSince + (since - previousSince) * LATE_START_SHARE
  const periods = splitPlays(allPlays, previousSince, since)
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
    previousSince,
    previousDuration,
    difference: getDifference(getDuration(periods.current), previousDuration),
    shows: getFavoriteChange(periods, 'episode', minPlayPercent),
    movies: getFavoriteChange(periods, 'movie', minPlayPercent),
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
// the earlier period's plays all there.
export async function getYearOverYear(
  allPlays: Play[] | null,
  timeZone?: string,
): Promise<YearOverYear | null> {
  if (!allPlays) {
    return null
  }

  const settings = getSettings()
  const since = Date.parse(getRewindStartDate(settings))
  const comparison = compareYears(allPlays, {
    since,
    minPlayPercent: settings.general.minPlayPercent,
    timeZone,
  })

  if (!comparison) {
    return null
  }

  const t = await getTranslations()

  return {
    since: toDateString(comparison.previousSince),
    until: toDateString(since - DAY),
    isPastYear: !settings.rewind.startDate,
    duration: secondsToTime(comparison.previousDuration, t),
    difference: comparison.difference,
    shows: comparison.shows && toPreviousFavorite(comparison.shows),
    movies: comparison.movies && toPreviousFavorite(comparison.movies),
  }
}
