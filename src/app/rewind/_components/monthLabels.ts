// Phones have room for the months' short names up to 6 months, and wider
// screens up to 13, a year with the partial months at its ends. Otherwise each
// gets a letter, and past 24 months only each January is labelled, with its
// year.
export const SHORT_LABEL_MONTHS = 6
export const WIDE_SHORT_LABEL_MONTHS = 13

const NARROW_LABEL_MONTHS = 24

function getMonthDate(month: string) {
  return Date.parse(`${month}-01`)
}

// YYYY-MM months, which are calendar months, so they're read in UTC
export function getMonthLabels(
  months: string[],
  locale: string,
  shortLabelMonths: number,
): (string | null)[] {
  if (months.length > NARROW_LABEL_MONTHS) {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      timeZone: 'UTC',
    })

    return months.map((month) =>
      month.endsWith('-01') ? formatter.format(getMonthDate(month)) : null,
    )
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    month: months.length > shortLabelMonths ? 'narrow' : 'short',
    timeZone: 'UTC',
  })

  return months.map((month) => formatter.format(getMonthDate(month)))
}

// Under the months, at the first month of each year, when they run over more
// than one, so a month that's there twice, like a past year's partial ones at
// its ends, can be told apart. Null when the months need none, as they're all
// in one year or already labelled with their years. The chart leaves out those
// it has no room for.
export function getYearLabels(
  months: string[],
  locale: string,
): (string | null)[] | null {
  const years = months.map((month) => month.slice(0, 4))

  if (months.length > NARROW_LABEL_MONTHS || new Set(years).size < 2) {
    return null
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    timeZone: 'UTC',
  })

  return months.map((month, index) =>
    index === 0 || years[index] !== years[index - 1]
      ? formatter.format(getMonthDate(month))
      : null,
  )
}
