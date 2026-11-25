import { EmailSettings } from '@/types/settings'
import { PlayPeriod } from '@/types/statsSource'
import {
  CalendarDate,
  CalendarDateTime,
  fromDate,
  getDayOfWeek,
  toCalendarDate,
  toZoned,
} from '@internationalized/date'

export type NewsletterSchedule = Pick<
  EmailSettings,
  | 'isNewsletterActive'
  | 'newsletterFrequency'
  | 'newsletterWeekday'
  | 'newsletterMonthDay'
  | 'newsletterHour'
>

// A newsletter the server missed, by being down, still goes out this long
// after it was due. Later, it would be about a week or month gone by.
export const MAX_SEND_DELAY_MS = 24 * 60 * 60 * 1000

// The last day of the month one can go out on, as every month has it
export const MAX_MONTH_DAY = 28

// Monthly ones go out every month, quarterly ones in January, April, July and
// October
const MONTHS_APART = { monthly: 1, quarterly: 3 } as const

// The settings form passes the server's in, as it works times out in the browser
function getServerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// The hour is set on a calendar day, so summer time can't move a send to
// another day. An hour the clocks skip becomes the one after it.
function atHour(day: CalendarDate, hour: number, timeZone: string): Date {
  return toZoned(
    new CalendarDateTime(day.year, day.month, day.day, hour),
    timeZone,
  ).toDate()
}

function getMonthDay(schedule: NewsletterSchedule): number {
  return Math.min(Math.max(schedule.newsletterMonthDay, 1), MAX_MONTH_DAY)
}

// The day it was last due on, at or before now
function getLatestSendDay(
  schedule: NewsletterSchedule,
  now: Date,
  timeZone: string,
): CalendarDate {
  const today = toCalendarDate(fromDate(now, timeZone))
  const frequency = schedule.newsletterFrequency

  if (frequency === 'weekly') {
    // Weekdays count from Sunday, as in the settings
    const day = today.subtract({
      days:
        (getDayOfWeek(today, 'en-US', 'sun') - schedule.newsletterWeekday + 7) %
        7,
    })

    return atHour(day, schedule.newsletterHour, timeZone) > now
      ? day.subtract({ weeks: 1 })
      : day
  }

  const months = MONTHS_APART[frequency]
  const day = new CalendarDate(
    today.year,
    today.month - ((today.month - 1) % months),
    getMonthDay(schedule),
  )

  return atHour(day, schedule.newsletterHour, timeZone) > now
    ? day.subtract({ months })
    : day
}

// When the newsletter was last due, at or before now
export function getLatestSendTime(
  schedule: NewsletterSchedule,
  now: Date,
  timeZone: string = getServerTimeZone(),
): Date {
  return atHour(
    getLatestSendDay(schedule, now, timeZone),
    schedule.newsletterHour,
    timeZone,
  )
}

export function getNextSendTime(
  schedule: NewsletterSchedule,
  now: Date,
  timeZone: string = getServerTimeZone(),
): Date {
  const latest = getLatestSendDay(schedule, now, timeZone)
  const frequency = schedule.newsletterFrequency
  const next =
    frequency === 'weekly'
      ? latest.add({ weeks: 1 })
      : latest.add({ months: MONTHS_APART[frequency] })

  return atHour(next, schedule.newsletterHour, timeZone)
}

// The whole days before the one it goes out on: the 7 before for a weekly
// one, and the calendar month or quarter before for the others, whichever day
// of the month they go out on
export function getNewsletterPeriod(
  schedule: Pick<EmailSettings, 'newsletterFrequency'>,
  sendTime: Date,
  timeZone: string = getServerTimeZone(),
): PlayPeriod {
  const sendDay = toCalendarDate(fromDate(sendTime, timeZone))
  const frequency = schedule.newsletterFrequency
  const until = frequency === 'weekly' ? sendDay : sendDay.set({ day: 1 })
  const since =
    frequency === 'weekly'
      ? until.subtract({ days: 7 })
      : until.subtract({ months: MONTHS_APART[frequency] })

  return {
    since: since.toDate(timeZone).toISOString(),
    until: until.toDate(timeZone).toISOString(),
  }
}

// The send time of the newsletter that should go out now, if one should.
// `handledUntil` is the last send time that went out, or that was passed over
// because the newsletter was turned on or moved after it.
export function getDueSendTime(
  schedule: NewsletterSchedule,
  handledUntil: Date | null,
  now: Date,
): Date | null {
  if (!schedule.isNewsletterActive) {
    return null
  }

  const latest = getLatestSendTime(schedule, now)

  if (
    (handledUntil && handledUntil >= latest) ||
    now.getTime() - latest.getTime() > MAX_SEND_DELAY_MS
  ) {
    return null
  }

  return latest
}

export function isSameSchedule(
  a: NewsletterSchedule,
  b: NewsletterSchedule,
): boolean {
  return (
    a.isNewsletterActive === b.isNewsletterActive &&
    a.newsletterFrequency === b.newsletterFrequency &&
    a.newsletterWeekday === b.newsletterWeekday &&
    a.newsletterMonthDay === b.newsletterMonthDay &&
    a.newsletterHour === b.newsletterHour
  )
}
