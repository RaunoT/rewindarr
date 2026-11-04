import { Play, PlayMediaType } from '@/types/playHistory'
import { HistoryPlay } from '@/types/statsSource'
import { TautulliItemRow } from '@/types/tautulli'
import { groupBy, max, maxBy, min, orderBy, sumBy, uniq } from 'lodash'
import { isSameBinge } from './binges'
import { toDateKey, toDayNumber } from './dateKeys'
import { isCountedPlay } from './playStats'

// Below these, a moment is too small to be worth a story
const MIN_CHART_MONTHS = 3
const MIN_BINGE_EPISODES = 3
const MIN_PLAY_DAYS = 3
const MIN_STREAK_DAYS = 3
// The biggest day names its titles, and how many more there were
const MAX_DAY_TITLES = 3

export type MonthDuration = {
  // YYYY-MM
  month: string
  // In seconds
  duration: number
}

// Every month of the period, the empty ones too
export type MonthlyDurations = {
  months: MonthDuration[]
  // The month with the most time, the first of a tie
  peakIndex: number
}

// The most episodes of a show the user played one after another in a day
export type Binge = {
  // YYYY-MM-DD
  date: string
  title: string
  // Only the plays that count
  episodes: number
  // In seconds, of every play in it
  duration: number
}

// A movie, show or artist the day went to
export type DayTitle = {
  title: string
  // Its icon stands in for a missing poster
  mediaType: PlayMediaType
}

export type BiggestDay<Title = DayTitle> = {
  // YYYY-MM-DD
  date: string
  // In seconds
  duration: number
  // The most time first
  titles: Title[]
  moreTitles: number
}

// The most days in a row with a play that counts
export type Streak = {
  // YYYY-MM-DD, both in the streak
  start: string
  end: string
  days: number
}

// Each null when it's too small to show
export type RewindMoments = {
  monthly: MonthlyDurations | null
  binge: (Binge & { item: TautulliItemRow | null }) | null
  biggestDay: BiggestDay<DayTitle & { item: TautulliItemRow | null }> | null
  streak: Streak | null
}

function getMonth(dateKey: string): string {
  return dateKey.slice(0, 7)
}

// The month's number is the index of the next one, which counts from 0
function getNextMonth(month: string): string {
  const [year, nextIndex] = month.split('-').map(Number)

  return new Date(Date.UTC(year, nextIndex)).toISOString().slice(0, 7)
}

// The user's time in each month from the start of the period to its end. The
// start is a date as the settings have it, so it's read in UTC.
export function getMonthlyDurations(
  plays: Play[],
  since: string,
  until = Date.now(),
  timeZone?: string,
): MonthlyDurations | null {
  const durations = new Map<string, number>()

  for (const play of plays) {
    const month = getMonth(toDateKey(play.startedAt, timeZone))

    durations.set(month, (durations.get(month) ?? 0) + play.durationMs)
  }

  if (durations.size < MIN_CHART_MONTHS) {
    return null
  }

  // A play on the evening before the start, in a time zone behind UTC, still
  // gets its month
  const first = min([
    getMonth(toDateKey(Date.parse(since), 'UTC')),
    ...durations.keys(),
  ])!
  const last = max([getMonth(toDateKey(until, timeZone)), ...durations.keys()])!
  const months: MonthDuration[] = []

  for (let month = first; month <= last; month = getNextMonth(month)) {
    months.push({
      month,
      duration: Math.round((durations.get(month) ?? 0) / 1000),
    })
  }

  const peak = Math.max(...months.map(({ duration }) => duration))

  return {
    months,
    peakIndex: months.findIndex(({ duration }) => duration === peak),
  }
}

// The longest binge of a show, by the episodes that count and then its time,
// grouped like the history's binges. The earliest wins a tie.
export function getBiggestBinge(
  plays: HistoryPlay[],
  minPlayPercent: number,
  timeZone?: string,
): (Binge & { play: HistoryPlay }) | null {
  const binges: HistoryPlay[][] = []

  for (const play of orderBy(plays, 'startedAt', 'desc')) {
    const binge = binges.at(-1)

    if (binge && isSameBinge(play, binge[binge.length - 1], timeZone)) {
      binge.push(play)
    } else {
      binges.push([play])
    }
  }

  const [biggest] = orderBy(
    binges
      .filter(([play]) => play.mediaType === 'episode')
      .map((binge) => ({
        date: toDateKey(binge[0].startedAt, timeZone),
        title: binge[0].showTitle || binge[0].title,
        episodes: binge.filter((play) => isCountedPlay(play, minPlayPercent))
          .length,
        duration: Math.round(sumBy(binge, 'durationMs') / 1000),
        // The newest, which points at the show as it is now
        play: binge[0],
        // When it began, which also settles a tie between two on one day
        startedAt: binge[binge.length - 1].startedAt,
      })),
    ['episodes', 'duration', 'startedAt'],
    ['desc', 'desc', 'asc'],
  )

  return biggest && biggest.episodes >= MIN_BINGE_EPISODES ? biggest : null
}

// Episodes go to their show and tracks to their artist
function getTitle(play: Play): string {
  switch (play.mediaType) {
    case 'episode':
      return play.showTitle || play.title
    case 'track':
      return play.artistName || play.title
    default:
      return play.title
  }
}

// The day with the most time, and what it went to. The earliest wins a tie.
export function getBiggestDay(
  plays: Play[],
  timeZone?: string,
): BiggestDay<DayTitle & { play: Play }> | null {
  const days = Object.entries(
    groupBy(plays, (play) => toDateKey(play.startedAt, timeZone)),
  )

  if (days.length < MIN_PLAY_DAYS) {
    return null
  }

  const [[date, dayPlays]] = orderBy(
    days,
    [([, dayPlays]) => sumBy(dayPlays, 'durationMs'), ([date]) => date],
    ['desc', 'asc'],
  )
  const titles = orderBy(
    Object.values(
      groupBy(dayPlays, (play) => `${play.mediaType}|${getTitle(play)}`),
    ),
    (titlePlays) => sumBy(titlePlays, 'durationMs'),
    'desc',
  ).map((titlePlays) => {
    // The newest, which points at the title as it is now
    const play = maxBy(titlePlays, 'startedAt')!

    return { title: getTitle(play), mediaType: play.mediaType, play }
  })

  return {
    date,
    duration: Math.round(sumBy(dayPlays, 'durationMs') / 1000),
    titles: titles.slice(0, MAX_DAY_TITLES),
    moreTitles: Math.max(titles.length - MAX_DAY_TITLES, 0),
  }
}

// The earliest wins a tie
export function getLongestStreak(
  plays: Play[],
  minPlayPercent: number,
  timeZone?: string,
): Streak | null {
  const dates = uniq(
    plays
      .filter((play) => isCountedPlay(play, minPlayPercent))
      .map((play) => toDateKey(play.startedAt, timeZone)),
  ).sort()
  const streaks: Streak[] = []

  for (const date of dates) {
    const streak = streaks.at(-1)

    if (streak && toDayNumber(date) === toDayNumber(streak.end) + 1) {
      streak.end = date
      streak.days += 1
    } else {
      streaks.push({ start: date, end: date, days: 1 })
    }
  }

  const [longest] = orderBy(streaks, ['days', 'start'], ['desc', 'asc'])

  return longest && longest.days >= MIN_STREAK_DAYS ? longest : null
}

type MomentsOptions = {
  // The start of the period
  since: string
  // The end of the period, now without one
  until?: number
  minPlayPercent: number
  // The server's without one
  timeZone?: string
  // For the binged show's card and the biggest day's posters
  getPlayItem: (play: Play) => Promise<TautulliItemRow>
}

// The moments in the user's plays in the period
export async function getRewindMoments(
  plays: HistoryPlay[],
  { since, until, minPlayPercent, timeZone, getPlayItem }: MomentsOptions,
): Promise<RewindMoments> {
  // Without its card or poster, a title still shows
  async function getItem(play: Play): Promise<TautulliItemRow | null> {
    try {
      return await getPlayItem(play)
    } catch (error) {
      console.error('[REWIND] - Unable to look up a title!', error)

      return null
    }
  }

  const binge = getBiggestBinge(plays, minPlayPercent, timeZone)
  const biggestDay = getBiggestDay(plays, timeZone)
  const [bingeItem, dayItems] = await Promise.all([
    binge && getItem(binge.play),
    Promise.all(biggestDay?.titles.map(({ play }) => getItem(play)) ?? []),
  ])

  return {
    monthly: getMonthlyDurations(plays, since, until, timeZone),
    binge: binge && {
      date: binge.date,
      title: binge.title,
      episodes: binge.episodes,
      duration: binge.duration,
      item: bingeItem,
    },
    biggestDay: biggestDay && {
      ...biggestDay,
      titles: biggestDay.titles.map(({ title, mediaType }, index) => ({
        title,
        mediaType,
        item: dayItems[index],
      })),
    },
    streak: getLongestStreak(plays, minPlayPercent, timeZone),
  }
}
