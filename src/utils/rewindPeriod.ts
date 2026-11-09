import { RewindPeriod } from '@/types/rewind'
import { RewindPeriodType, Settings } from '@/types/settings'
import { HistoryPlay } from '@/types/statsSource'
import {
  CalendarDate,
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
} from '@internationalized/date'
import { DEFAULT_SETTINGS, getPeriods } from './constants'
import { toDateKey } from './timeZone'

type RewindSettings = Pick<Settings, 'rewind'>

// Plays are timed from the Unix epoch, and Date reads years under 100 as 19xx
export const FIRST_YEAR = 1970

// An edition that comes out from this month on does so in its own year, and
// one that comes out before it in the year after
const RELEASE_YEAR_FROM_MONTH = 7

// A specific year without its year, a custom period without a start date, and
// a period the settings form can't save, such as a hand-edited one, are the
// default
export function getRewindPeriodType(
  settings: RewindSettings,
): RewindPeriodType {
  const { period, year, startDate } = settings.rewind

  switch (period) {
    case 'pastYear':
      return period
    case 'specificYear':
      return year ? period : DEFAULT_SETTINGS.rewind.period
    case 'custom':
      return startDate ? period : DEFAULT_SETTINGS.rewind.period
    default:
      return DEFAULT_SETTINGS.rewind.period
  }
}

function getToday(timeZone: string | undefined, now: Date): CalendarDate {
  return toCalendarDate(fromDate(now, timeZone ?? getLocalTimeZone()))
}

// In a year that isn't a leap one, so every year has each day
function getDaysInMonth(month: number): number {
  return new Date(Date.UTC(2001, month, 0)).getUTCDate()
}

// Whether a MM-DD release date is a day every year has
export function isReleaseDate(value: string): boolean {
  const match = /^(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const month = Number(match[1])
  const day = Number(match[2])

  return month >= 1 && month <= 12 && day >= 1 && day <= getDaysInMonth(month)
}

// The day a year's edition comes out on, from the MM-DD release date. One
// that's no day, such as a hand-edited one, falls back to the default.
export function getReleaseDay(year: number, releaseDate: string): CalendarDate {
  const [month, day] = (
    isReleaseDate(releaseDate)
      ? releaseDate
      : DEFAULT_SETTINGS.rewind.releaseDate
  )
    .split('-')
    .map(Number)

  return new CalendarDate(
    month >= RELEASE_YEAR_FROM_MONTH ? year : year + 1,
    month,
    day,
  )
}

// The newest edition that's out, which stays the latest until the next one
// comes out. Dates are the viewer's, in their timezone, or the server's
// without one.
export function getLatestEditionYear(
  settings: RewindSettings,
  timeZone?: string,
  now: Date = new Date(),
): number {
  const today = getToday(timeZone, now)

  let year = today.year

  while (getReleaseDay(year, settings.rewind.releaseDate).compare(today) > 0) {
    year--
  }

  return year
}

// From its release to the end of the January after its year, the latest
// edition is new, which the home page tells viewers about. Null at other times
// and for the other periods.
export function getNewEditionYear(
  settings: RewindSettings,
  timeZone?: string,
  now: Date = new Date(),
): number | null {
  if (getRewindPeriodType(settings) !== 'calendarYear') {
    return null
  }

  const year = getLatestEditionYear(settings, timeZone, now)
  const isNew =
    getToday(timeZone, now).compare(new CalendarDate(year + 1, 2, 1)) < 0

  return isNew ? year : null
}

// 1 January to 31 December, from midnight in the timezone
export function getEditionPeriod(
  year: number,
  timeZone?: string,
): RewindPeriod {
  const zone = timeZone ?? getLocalTimeZone()

  return {
    since: new CalendarDate(year, 1, 1).toDate(zone).toISOString(),
    until: new CalendarDate(year + 1, 1, 1).toDate(zone).toISOString(),
    year,
  }
}

type PeriodOptions = {
  // The edition to show, the latest without one
  year?: number
  timeZone?: string
  now?: Date
}

// Calendar years show an edition, the latest unless `year` picks another. A
// specific year is always the same edition, and the other periods run to now.
export function getRewindPeriod(
  settings: RewindSettings,
  { year, timeZone, now = new Date() }: PeriodOptions = {},
): RewindPeriod {
  const type = getRewindPeriodType(settings)

  if (type === 'calendarYear') {
    return getEditionPeriod(
      year ?? getLatestEditionYear(settings, timeZone, now),
      timeZone,
    )
  }

  if (type === 'specificYear' && settings.rewind.year) {
    return getEditionPeriod(settings.rewind.year, timeZone)
  }

  return {
    since:
      (type === 'custom' && settings.rewind.startDate) ||
      getPeriods(now).pastYear.string,
    year: null,
  }
}

// An edition that hasn't ended yet still gets plays
export function isEditionOngoing(
  period: RewindPeriod,
  now = Date.now(),
): boolean {
  return period.until !== undefined && now < Date.parse(period.until)
}

// The edition before, which year over year compares with: up to the same
// moment a year earlier while this one is still going
export function getPreviousEdition(
  period: RewindPeriod,
  timeZone?: string,
  now = Date.now(),
): { since: number; until: number } {
  const previous = getEditionPeriod((period.year ?? 0) - 1, timeZone)

  return {
    since: Date.parse(previous.since),
    until: isEditionOngoing(period, now)
      ? fromDate(new Date(now), timeZone ?? getLocalTimeZone())
          .subtract({ years: 1 })
          .toDate()
          .getTime()
      : Date.parse(period.since),
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

function getYear(time: number, timeZone?: string): number {
  return Number(toDateKey(time, timeZone).slice(0, 4))
}

// The first year the history has every play of, from how far back every
// history has them (see getHistoryReadFrom). Null before any was read.
export function getFirstReadYear(
  readFrom: number,
  timeZone?: string,
): number | null {
  if (readFrom === -Infinity) {
    return FIRST_YEAR
  }

  return Number.isFinite(readFrom) ? getYear(readFrom, timeZone) + 1 : null
}

// The years each user played in, newest first, by user ID
export function getEditionYearsByUser(
  plays: Pick<HistoryPlay, 'userId' | 'startedAt'>[],
  timeZone?: string,
): Record<string, number[]> {
  const years = new Map<string, Set<number>>()

  for (const { userId, startedAt } of plays) {
    if (!userId) {
      continue
    }

    const userYears = years.get(userId) ?? new Set<number>()

    userYears.add(getYear(startedAt, timeZone))
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
