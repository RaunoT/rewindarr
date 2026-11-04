const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY = 24 * 60 * 60 * 1000
// One per time zone, as making a formatter for each play is slow
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

// A timezone Intl knows, as Intl names it, or undefined for anything else
export function toTimeZone(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: value,
    }).resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

// Reads the hour (0 to 23) and the day of the week (0 is Sunday) of a time in
// the timezone, or in the server's without one. The formatter is made once, as
// it's used for every play.
export function createHourAndDayReader(
  timeZone?: string,
): (time: number) => { hour: number; day: number } {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  })

  return (time) => {
    const parts = format.formatToParts(time)
    const hour = parts.find((part) => part.type === 'hour')?.value
    const weekday = parts.find((part) => part.type === 'weekday')?.value

    return {
      hour: Number(hour),
      day: WEEKDAYS.indexOf(weekday ?? ''),
    }
  }
}

// The calendar date a time falls on, as YYYY-MM-DD, in the time zone, or the
// server's without one
export function toDateKey(time: number, timeZone?: string): string {
  let formatter = dateFormatters.get(timeZone ?? '')

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    })
    dateFormatters.set(timeZone ?? '', formatter)
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
