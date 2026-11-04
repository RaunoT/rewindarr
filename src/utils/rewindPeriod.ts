import { RewindPeriod } from '@/types/rewind'
import { RewindPeriodType, Settings } from '@/types/settings'
import { HistoryPlay } from '@/types/statsSource'
import { getPeriods } from './constants'

// Plays are timed from the Unix epoch, and Date reads years under 100 as 19xx
const FIRST_YEAR = 1970

// A custom period without a start date is the past year
export function getRewindPeriodType(
  settings: Pick<Settings, 'rewind'>,
): RewindPeriodType {
  const { period, startDate } = settings.rewind

  if (period === 'calendarYear') {
    return period
  }

  return period === 'custom' && startDate ? 'custom' : 'pastYear'
}

// Rewind season is December, so a year's edition comes out on 1 December and
// stays the latest until the next one does. Years are in the server's timezone.
export function getLatestEditionYear(now: Date = new Date()): number {
  return now.getMonth() === 11 ? now.getFullYear() : now.getFullYear() - 1
}

// From 1 December to the end of January the latest edition is new, which the
// home page tells viewers about. Null at other times and for the other periods.
export function getNewEditionYear(
  settings: Pick<Settings, 'rewind'>,
  now: Date = new Date(),
): number | null {
  const month = now.getMonth()

  return getRewindPeriodType(settings) === 'calendarYear' &&
    (month === 11 || month === 0)
    ? getLatestEditionYear(now)
    : null
}

// 1 January to 31 December
export function getEditionPeriod(year: number): RewindPeriod {
  return {
    start: new Date(year, 0, 1).toISOString(),
    end: new Date(year + 1, 0, 1).toISOString(),
    year,
  }
}

// With calendar-year editions, `year` picks one, the latest when left out. The
// other periods run to now and have no year to pick.
export function getRewindPeriod(
  settings: Pick<Settings, 'rewind'>,
  year?: number,
  now: Date = new Date(),
): RewindPeriod {
  const type = getRewindPeriodType(settings)

  if (type === 'calendarYear') {
    return getEditionPeriod(year ?? getLatestEditionYear(now))
  }

  return {
    start:
      (type === 'custom' && settings.rewind.startDate) ||
      getPeriods(now).pastYear.string,
    year: null,
  }
}

// A year from the URL, when its edition is out
export function parseEditionYear(
  value: string | null | undefined,
  latestYear: number,
): number | undefined {
  if (!value || !/^\d{4}$/.test(value)) {
    return undefined
  }

  const year = Number(value)

  return year >= FIRST_YEAR && year <= latestYear ? year : undefined
}

// The first year the history has every play of, from how far back it has
// them all. Null before any was read.
export function getFirstReadYear(readFrom: number): number | null {
  if (readFrom === -Infinity) {
    return FIRST_YEAR
  }

  return Number.isFinite(readFrom) ? new Date(readFrom).getFullYear() + 1 : null
}

// The years each user played in, newest first, by user ID
export function getEditionYearsByUser(
  plays: Pick<HistoryPlay, 'userId' | 'startedAt'>[],
): Record<string, number[]> {
  const years = new Map<string, Set<number>>()

  for (const { userId, startedAt } of plays) {
    if (!userId) {
      continue
    }

    const userYears = years.get(userId) ?? new Set<number>()

    userYears.add(new Date(startedAt).getFullYear())
    years.set(userId, userYears)
  }

  return Object.fromEntries(
    [...years].map(([userId, userYears]) => [
      userId,
      [...userYears].sort((a, b) => b - a),
    ]),
  )
}

// What the year picker offers: the latest edition, the ones the viewer played
// in, and the one on screen, newest first
export function getEditionOptions(
  playedYears: number[],
  latestYear: number,
  shownYear?: number,
): number[] {
  const years = new Set([latestYear, ...playedYears])

  if (shownYear !== undefined) {
    years.add(shownYear)
  }

  return [...years].sort((a, b) => b - a)
}
