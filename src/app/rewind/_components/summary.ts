import { UserRewind } from '@/types/rewind'
import { PersonalityType } from '@/types/rewindPersonality'
import { TautulliItemRow } from '@/types/tautulli'

export type SummaryTop = {
  type: 'show' | 'movie' | 'artist'
  item: TautulliItemRow
}

// What the summary is called, with the years it covers, like "2026" or
// "2025–2026". The media server's name would read as if it made the image, so
// only a name the admin gave the server is used.
export type SummaryTitle =
  | { type: 'server'; serverName: string; years: string }
  | { type: 'default'; years: string }

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

// The period runs to now, so it's named after this year, like other years in
// review, even when the default past year began in the last one. A YYYY-MM-DD
// start date the admin set in an earlier year adds that year.
export function getSummaryTitle(
  serverName: string,
  customStartDate: string | undefined,
  now = new Date(),
): SummaryTitle {
  const end = now.getUTCFullYear()
  const start = customStartDate
    ? new Date(customStartDate).getUTCFullYear()
    : end
  const years = start < end ? `${start}–${end}` : `${end}`

  return serverName
    ? { type: 'server', serverName, years }
    : { type: 'default', years }
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
// "rewind-2025-2026-rauno.png"
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
