import { EmailSettings } from '@/types/settings'
import { PlayPeriod } from '@/types/statsSource'

export type NewsletterSchedule = Pick<
  EmailSettings,
  | 'isNewsletterActive'
  | 'newsletterFrequency'
  | 'newsletterWeekday'
  | 'newsletterHour'
>

// A newsletter the server missed, by being down, still goes out this long
// after it was due. Later, it would be about a week or month gone by.
export const MAX_SEND_DELAY_MS = 24 * 60 * 60 * 1000

// Times are in the server's time zone, as the settings say. Dates are moved
// by calendar days rather than by milliseconds, so the hour stays the same
// across a change to or from summer time.

// When the newsletter was last due, at or before now
export function getLatestSendTime(
  schedule: NewsletterSchedule,
  now: Date,
): Date {
  const hour = schedule.newsletterHour

  if (schedule.newsletterFrequency === 'monthly') {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1, hour)

    return thisMonth <= now
      ? thisMonth
      : new Date(now.getFullYear(), now.getMonth() - 1, 1, hour)
  }

  const time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour)
  const daysBack = (time.getDay() - schedule.newsletterWeekday + 7) % 7

  time.setDate(time.getDate() - daysBack)

  if (time > now) {
    time.setDate(time.getDate() - 7)
  }

  return time
}

export function getNextSendTime(schedule: NewsletterSchedule, now: Date): Date {
  const latest = getLatestSendTime(schedule, now)

  if (schedule.newsletterFrequency === 'monthly') {
    return new Date(
      latest.getFullYear(),
      latest.getMonth() + 1,
      1,
      schedule.newsletterHour,
    )
  }

  latest.setDate(latest.getDate() + 7)

  return latest
}

// The whole days before the one it goes out on: the 7 before for a weekly
// one, and the month before for a monthly one
export function getNewsletterPeriod(
  schedule: Pick<EmailSettings, 'newsletterFrequency'>,
  sendTime: Date,
): PlayPeriod {
  const until = new Date(
    sendTime.getFullYear(),
    sendTime.getMonth(),
    sendTime.getDate(),
  )
  const since =
    schedule.newsletterFrequency === 'monthly'
      ? new Date(until.getFullYear(), until.getMonth() - 1, 1)
      : new Date(until.getFullYear(), until.getMonth(), until.getDate() - 7)

  return { since: since.toISOString(), until: until.toISOString() }
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
    a.newsletterHour === b.newsletterHour
  )
}
