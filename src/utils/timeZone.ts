const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
