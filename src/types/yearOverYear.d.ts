// The movie or show the user spent the most time on in the earlier period
export type PreviousFavorite = {
  title: string
  // Whether it's their favourite in the period too
  isSame: boolean
}

// The user's period next to the one before it, which is as long
export type YearOverYear = {
  // The earlier period's first and last day, YYYY-MM-DD
  since: string
  until: string
  // Without a start date in the settings, the period is the past year and the
  // earlier one the year before it
  isPastYear: boolean
  // The user's time in the earlier period
  duration: string
  // In percent, positive when the user spent more time in the period
  difference: number
  // Null without one in either period
  shows: PreviousFavorite | null
  movies: PreviousFavorite | null
}
