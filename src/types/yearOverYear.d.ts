// The movie or show the user spent the most time on in the earlier period
export type PreviousFavorite = {
  title: string
  // Whether it's their favourite in the period too
  isSame: boolean
}

// The user's period next to the one before it, which is as long, or the
// edition before
export type YearOverYear = {
  // The earlier period's first and last day, YYYY-MM-DD
  since: string
  until: string
  // The past year or an edition, which the year before is compared with,
  // rather than a period from a start date
  isYear: boolean
  // An edition still going is compared with the year before up to the same
  // moment
  isSoFar: boolean
  // The user's time in the earlier period
  duration: string
  // In percent, positive when the user spent more time in the period
  difference: number
  // Null without one in either period
  shows: PreviousFavorite | null
  movies: PreviousFavorite | null
}
