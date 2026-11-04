const DAY = 24 * 60 * 60 * 1000
// One per time zone, as making a formatter for each play is slow
const formatters = new Map<string, Intl.DateTimeFormat>()

// The calendar date a time falls on, as YYYY-MM-DD, in the time zone, or the
// server's without one
export function toDateKey(time: number, timeZone?: string): string {
  let formatter = formatters.get(timeZone ?? '')

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    })
    formatters.set(timeZone ?? '', formatter)
  }

  const parts = Object.fromEntries(
    formatter.formatToParts(time).map(({ type, value }) => [type, value]),
  )

  return `${parts.year}-${parts.month}-${parts.day}`
}

// Days since 1970 of a YYYY-MM-DD date, so days in a row are 1 apart
export function toDayNumber(dateKey: string): number {
  return Date.parse(dateKey) / DAY
}
