// Dates for Intl to name a weekday or an hour in UTC, so the labels need no
// translations. 2024-01-07 is a Sunday, and days count from Sunday, as
// Date.getDay() does.
export function getWeekdayDate(day: number): Date {
  return new Date(Date.UTC(2024, 0, 7 + day))
}

export function getHourDate(hour: number): Date {
  return new Date(Date.UTC(2024, 0, 1, hour))
}
