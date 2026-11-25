import { Settings } from '@/types/settings'
import {
  getLatestEditionYear,
  getReleaseDay,
  getRewindPeriodType,
} from './rewindPeriod'

// On the release day, in the server's time. Rewind is out from midnight, but
// an email then would wake people.
export const RELEASE_EMAIL_HOUR = 9

export type ReleaseSettings = Pick<Settings, 'rewind'>

// When a year's invites go out
export function getReleaseEmailTime(
  settings: ReleaseSettings,
  year: number,
): Date {
  const day = getReleaseDay(year, settings.rewind.releaseDate)

  return new Date(day.year, day.month - 1, day.day, RELEASE_EMAIL_HOUR)
}

// The newest edition whose invites are due by now
export function getLatestReleaseYear(
  settings: ReleaseSettings,
  now: Date,
): number {
  const year = getLatestEditionYear(settings, undefined, now)

  return now >= getReleaseEmailTime(settings, year) ? year : year - 1
}

// How long after the release day invites still go out, for a server that was
// off on the day, so they aren't sent months late
const SEND_WINDOW_MONTHS = 2

// The edition whose invites are due and haven't gone out, or null
export function getDueReleaseYear(
  settings: ReleaseSettings,
  handledYear: number | null,
  now: Date,
): number | null {
  if (getRewindPeriodType(settings) !== 'calendarYear') {
    return null
  }

  const year = getLatestReleaseYear(settings, now)
  const sendTime = getReleaseEmailTime(settings, year)
  const isNew =
    now <
    new Date(
      sendTime.getFullYear(),
      sendTime.getMonth() + SEND_WINDOW_MONTHS,
      sendTime.getDate(),
    )

  return isNew && (handledYear === null || year > handledYear) ? year : null
}

// When the next invites go out, after the ones handled
export function getNextReleaseEmailTime(
  settings: ReleaseSettings,
  handledYear: number | null,
  now: Date,
): Date {
  const due = getDueReleaseYear(settings, handledYear, now)

  if (due !== null) {
    return getReleaseEmailTime(settings, due)
  }

  return getReleaseEmailTime(settings, getLatestReleaseYear(settings, now) + 1)
}

// Whether invites go out on the release day: Rewind is on and open to users,
// by the calendar year, which has a release day, and the emails are on
export function isReleaseEmailOn(settings: ReleaseSettings): boolean {
  const { isActive, isAdminOnly, isReleaseEmailActive } = settings.rewind

  return (
    isActive &&
    !isAdminOnly &&
    isReleaseEmailActive &&
    getRewindPeriodType(settings) === 'calendarYear'
  )
}
