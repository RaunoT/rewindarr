import { RewindPeriod, UserRewind } from '@/types/rewind'
import { PersonalityType } from '@/types/rewindPersonality'
import { ItemRow } from '@/types/statsSource'

export type SummaryTop = {
  type: 'show' | 'movie' | 'artist'
  item: ItemRow
}

// What the summary is called, with the period it covers: an edition's year,
// like "2026", or the months of a period that runs to now, like "Nov 2025 –
// Nov 2026". The media server's name would read as if it made the image, so
// only a name the admin gave the server is used.
export type SummaryTitle =
  | { type: 'server'; serverName: string; period: string }
  | { type: 'default'; period: string }

// An overall stat beside the total time
export type SummaryHighlight =
  // The top percent of viewers by time, such as 5
  | { type: 'topPercent'; percent: number }
  | { type: 'genre'; name: string }
  // The duration in seconds
  | { type: 'binge'; episodes: number; title: string; duration: number }
  | { type: 'streak'; days: number }
  // YYYY-MM
  | { type: 'month'; month: string }
  // 0 is Sunday
  | { type: 'day'; day: number }

// With the total time, they fill two rows
const MAX_HIGHLIGHTS = 3
// The stat that earned a personality isn't repeated beside it
const PERSONALITY_HIGHLIGHTS: Partial<
  Record<PersonalityType, SummaryHighlight['type']>
> = {
  binger: 'binge',
  marathoner: 'streak',
  weekendWarrior: 'day',
}

// The summary's posters: the top show, movie and artist, whichever there are
export function getSummaryTops({
  shows,
  movies,
  audio,
}: Pick<UserRewind, 'shows' | 'movies' | 'audio'>): SummaryTop[] {
  const tops = [
    { type: 'show' as const, item: shows.top[0] },
    { type: 'movie' as const, item: movies.top[0] },
    { type: 'artist' as const, item: audio.top[0] },
  ]

  return tops.filter((top): top is SummaryTop => !!top.item)
}

// An edition is named after its year. The past year and a custom period run
// to now, so they're named after their months, as a year alone would read as
// the calendar year, in the story and in the saved image seen long after.
// Their YYYY-MM-DD start dates are read in UTC, as the welcome reads them,
// and one set after today is all there is of the period.
export function getSummaryTitle(
  serverName: string,
  { since, year }: Pick<RewindPeriod, 'since' | 'year'>,
  locale: string,
  now = new Date(),
): SummaryTitle {
  const start = new Date(since)
  const period =
    year === null
      ? new Intl.DateTimeFormat(locale, {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).formatRange(start, start > now ? start : now)
      : String(year)

  return serverName
    ? { type: 'server', serverName, period }
    : { type: 'default', period }
}

// The viewer's most telling overall stats, leaving out those they don't have:
// how they rank first, then their taste, their biggest moments and habits
export function getSummaryHighlights(
  rewind: Pick<
    UserRewind,
    | 'duration'
    | 'genres'
    | 'shows'
    | 'movies'
    | 'moments'
    | 'habits'
    | 'personality'
  >,
): SummaryHighlight[] {
  const { duration, genres, shows, movies, moments, habits, personality } =
    rewind
  // From whichever of shows and movies took more of the viewer's time
  const [topGenre] =
    (movies.duration_value ?? 0) > (shows.duration_value ?? 0)
      ? [...genres.movies, ...genres.shows]
      : [...genres.shows, ...genres.movies]
  const peakMonth = moments.monthly?.months[moments.monthly.peakIndex]
  const skipped = personality && PERSONALITY_HIGHLIGHTS[personality.type]
  const highlights: (SummaryHighlight | null)[] = [
    duration.topPercent === null
      ? null
      : { type: 'topPercent', percent: duration.topPercent },
    topGenre ? { type: 'genre', name: topGenre.name } : null,
    moments.binge && {
      type: 'binge',
      episodes: moments.binge.episodes,
      title: moments.binge.title,
      duration: moments.binge.duration,
    },
    moments.streak && { type: 'streak', days: moments.streak.days },
    peakMonth ? { type: 'month', month: peakMonth.month } : null,
    habits.peakDayIndex === null
      ? null
      : { type: 'day', day: habits.peakDayIndex },
  ]

  return highlights
    .filter(
      (highlight): highlight is SummaryHighlight =>
        !!highlight && highlight.type !== skipped,
    )
    .slice(0, MAX_HIGHLIGHTS)
}

// Lowercase letters and digits joined by dashes, which any system takes, like
// "rewind-nov-2025-nov-2026-rauno.png"
export function getSummaryFileName(...words: string[]): string {
  const name = words
    .join(' ')
    // Splits off the accents, so "Jüri" is kept as "juri"
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')

  return `${name || 'rewind'}.png`
}
