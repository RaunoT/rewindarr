import { useFormatter } from 'next-intl'

type Formatter = ReturnType<typeof useFormatter>

export const DAY_FORMAT = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
} as const
export const SHORT_DAY_FORMAT = { day: 'numeric', month: 'long' } as const

// A YYYY-MM-DD date, with the year when it isn't this one's. It's a calendar
// date already, so it's read in UTC wherever it shows.
export function formatMomentDate(
  format: Formatter,
  date: string,
  options: typeof DAY_FORMAT | typeof SHORT_DAY_FORMAT,
): string {
  const time = Date.parse(date)
  const isThisYear =
    new Date(time).getUTCFullYear() === new Date().getFullYear()

  return format.dateTime(time, {
    ...options,
    year: isThisYear ? undefined : 'numeric',
    timeZone: 'UTC',
  })
}
