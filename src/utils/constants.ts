import { HistoryRequest } from '@/types/history'
import { PlayMediaType } from '@/types/playHistory'
import {
  ExternalLink,
  ItemStatistics,
  ServerLink,
  Settings,
  StatisticsSource,
} from '@/types/settings'
import { LibraryType } from '@/types/statsSource'

export type Period = {
  date: string
  string: string
  daysAgo: number
}

function createPeriod(date: Date, daysAgo: number): Period {
  return {
    date: date.toISOString(),
    string: date.toISOString().split('T')[0],
    daysAgo,
  }
}

// Computed per call, as a module-level constant would freeze at server start.
export function getPeriods(now: Date = new Date()) {
  const daysAgo7 = new Date(now)
  const pastYear = new Date(now)

  daysAgo7.setDate(daysAgo7.getDate() - 7)
  pastYear.setFullYear(pastYear.getFullYear() - 1)

  return {
    '7days': createPeriod(daysAgo7, 7),
    pastYear: createPeriod(
      pastYear,
      Math.ceil((now.getTime() - pastYear.getTime()) / (1000 * 3600 * 24)),
    ),
  }
}

export const META_DESCRIPTION: string =
  "Plex and Jellyfin users' statistics and habits in a beautiful and organized manner"

export const PLEX_API_ENDPOINT = 'https://plex.tv/api/v2'
export const APP_NAME = 'Rewindarr'
export const PLEX_PRODUCT_NAME = APP_NAME

// Next.js inlines `process.env.NEXT_PUBLIC_*` into the build, but the Docker
// image is configured when the container starts, so look variables up by name.
// Server-side only: the browser has no access to them.
export function getRuntimeEnv(name: string): string | undefined {
  return process.env[name]
}

// The address set for the app, if any. Without one, the browser's is used.
export function getSiteUrl(): string | undefined {
  return (
    getRuntimeEnv('NEXT_PUBLIC_SITE_URL') ||
    getRuntimeEnv('NEXTAUTH_URL') ||
    undefined
  )
}

export const DEFAULT_SETTINGS: Settings = {
  connection: {
    statisticsSource: 'tautulli',
    tautulliUrl: '',
    tautulliApiKey: '',
    tracearrUrl: '',
    tracearrApiKey: '',
    tracearrServerId: '',
    mediaServerType: 'plex',
    plexUrl: '',
    plexToken: '',
    jellyfinUrl: '',
    seerrUrl: '',
    seerrApiKey: '',
    complete: false,
  },
  general: {
    serverName: '',
    activeLibraries: [],
    excludedUsers: [],
    isPostersTmdbOnly: false,
    activeExternalLinks: ['seerr', 'seerrStatus'],
    activeItemStatistics: [
      'year',
      'imdbRating',
      'rottenTomatoesRating',
      'rottenTomatoesAudienceRating',
      'duration',
      'plays',
      'users',
      'requests',
    ],
    minPlayPercent: 50,
    googleAnalyticsId: '',
    isOutsideAccess: false,
    isAnonymized: false,
    complete: false,
  },
  rewind: {
    isActive: true,
    isAdminOnly: false,
    hiddenStories: [],
    isThemeMusicActive: false,
    music: null,
    isSnowActive: true,
    period: 'calendarYear',
    releaseDate: '12-01',
    startDate: '',
    complete: false,
  },
  dashboard: {
    isActive: true,
    isAdminOnly: false,
    isUsersPageActive: true,
    activeTotalStatistics: ['size', 'duration', 'count', 'requests'],
    customPeriod: '30',
    startDate: '',
    complete: false,
  },
  activity: {
    isActive: true,
    isAdminOnly: false,
    complete: false,
  },
  history: {
    isActive: true,
    isAdminOnly: false,
    complete: false,
  },
  setupComplete: false,
}

// GA4 measurement IDs (G-) and Google tag IDs (GT-). Universal Analytics
// (UA-) no longer collects data, and AW-/DC- tags are for ads, not analytics.
export const GOOGLE_ANALYTICS_ID_PATTERN = /^GT?-[A-Z0-9]+$/i

export const SETTINGS_PAGES = [
  { href: '/settings/connection', key: 'connection' },
  { href: '/settings/general', key: 'general' },
  { href: '/settings/rewind', key: 'rewind' },
  { href: '/settings/dashboard', key: 'dashboard' },
  { href: '/settings/activity', key: 'activity' },
  { href: '/settings/history', key: 'history' },
]

// Wherever they're opened from, the settings start on the first page
export const SETTINGS_HREF = SETTINGS_PAGES[0].href

export const STATS_SOURCE_NAMES: Record<StatisticsSource, string> = {
  tautulli: 'Tautulli',
  tracearr: 'Tracearr',
}

// First among the links, in this order
export const SERVER_LINKS = [
  'mediaServer',
  'seerr',
  'seerrStatus',
] as const satisfies readonly ServerLink[]

// In the order the links are shown
export const EXTERNAL_LINKS = [
  'imdb',
  'tmdb',
  'tvdb',
  'rottenTomatoes',
  'letterboxd',
  'trakt',
] as const satisfies readonly ExternalLink[]

export const EXTERNAL_LINK_NAMES: Record<ExternalLink, string> = {
  imdb: 'IMDb',
  tmdb: 'TMDB',
  tvdb: 'TVDB',
  rottenTomatoes: 'Rotten Tomatoes',
  letterboxd: 'Letterboxd',
  trakt: 'Trakt',
}

export const TMDB_API_KEY = '4675b5b5d8cd1463ff16adca2680157b'

export const ITEM_STATISTICS = [
  'year',
  'tmdbRating',
  'imdbRating',
  'rottenTomatoesRating',
  'rottenTomatoesAudienceRating',
  'duration',
  'plays',
  'users',
  'requests',
  'requestsWatched',
] as const satisfies ItemStatistics

export const RATING_STATISTICS = [
  'tmdbRating',
  'imdbRating',
  'rottenTomatoesRating',
  'rottenTomatoesAudienceRating',
] as const

// The type of library a played movie, episode or track belongs to
export const PLAY_LIBRARY_TYPES: Record<PlayMediaType, LibraryType> = {
  movie: 'movie',
  episode: 'show',
  track: 'artist',
}

// The Seerr media type a library's requests are for. Music has none.
export const SEERR_MEDIA_TYPES: Partial<
  Record<LibraryType, HistoryRequest['mediaType']>
> = {
  movie: 'movie',
  show: 'tv',
}

// The stories an admin can hide, named as in the player and in the order they
// play. The welcome and the goodbye always show.
export const REWIND_STORIES = [
  'total',
  'months',
  'year_over_year',
  'shows',
  'shows_top',
  'shows_actors',
  'shows_genres',
  'movies',
  'movies_top',
  'movies_directors',
  'movies_actors',
  'movies_genres',
  'audio',
  'audio_top',
  'comfort_watch',
  'time_travel',
  'discoveries',
  'binge',
  'biggest_day',
  'habits_day',
  'habits_hour',
  'taste_match',
  'only_you',
  'users_top',
  'requests',
  'requests_reach',
  'server_year',
  'libraries',
  'first_play',
  'personality',
  'summary',
] as const

export type RewindStoryId = (typeof REWIND_STORIES)[number]

export const REWIND_MUSIC_MAX_BYTES = 50 * 1024 * 1024
// What a Rewind track may be, by file extension, and the type it's served as
export const REWIND_MUSIC_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
}

export type Locale = (typeof LOCALES)[number]
export const LOCALES = ['en-GB', 'en-US', 'et', 'fr', 'de', 'it', 'es']
export const DEFAULT_LOCALE: Locale = 'en-GB'
export const LOCALE_COOKIE_NAME = 'locale'
// Mirrors the dashboard's period, so the home page can use it on the server
export const DASHBOARD_PERIOD_COOKIE_NAME = 'dashboardPeriod'

// So the server renders the activity with its details open or closed, as the
// browser will
export const ACTIVITY_DETAILS_COOKIE_NAME = 'activityDetails'
// The browser's timezone, so Rewind counts hours and days where the viewer is
export const TIME_ZONE_COOKIE_NAME = 'timeZone'
// Dashboard lists start with this many rows, and "Show more" adds as many again
export const DASHBOARD_PAGE_SIZE = 5
// Each row costs the source and TMDB a lookup, so the URL can't ask for more
export const DASHBOARD_MAX_ITEMS = 50
// The plays a history page can show, the first by default
export const HISTORY_PAGE_SIZES = [10, 25, 50, 100]
// Remembers the plays per page, for when the URL doesn't say
export const HISTORY_PAGE_SIZE_COOKIE_NAME = 'historyPageSize'
