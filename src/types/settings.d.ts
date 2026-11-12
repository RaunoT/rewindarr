export type SettingsFormInitialState<T> = {
  message: string
  status: string
  fields: T
  // Where a save during the setup continues to
  nextPage?: string
}

export type StatisticsSource = 'tautulli' | 'tracearr'

// Tautulli only tracks Plex. With Tracearr, it's the type of the chosen server.
export type MediaServerType = 'plex' | 'jellyfin'

export type ConnectionSettings = {
  statisticsSource: StatisticsSource
  tautulliUrl: string
  tautulliApiKey: string
  tracearrUrl: string
  tracearrApiKey: string
  tracearrServerId: string
  seerrUrl?: string
  seerrApiKey?: string
  mediaServerType: MediaServerType
  // For links that open an item in the server, and Jellyfin's for signing in.
  // Each server keeps its own, like the statistics sources.
  plexUrl: string
  jellyfinUrl: string
  // Optional, lets Rewind play theme songs from the Plex library
  plexToken?: string
  complete: boolean
}

export type ExternalLink =
  'imdb' | 'tmdb' | 'tvdb' | 'rottenTomatoes' | 'letterboxd' | 'trakt'

// The title in the media server and in Seerr, which its poster opens either
// way, and Seerr's link only where it has something to say, such as a
// request's status
export type ServerLink = 'mediaServer' | 'seerr' | 'seerrStatus'

export type TitleLink = ServerLink | ExternalLink

export type GeneralSettings = {
  serverName: string
  activeLibraries: string[]
  excludedUsers: string[]
  isPostersTmdbOnly: boolean
  activeExternalLinks: TitleLink[]
  // Shown for each title and user in the dashboard and Rewind lists
  activeItemStatistics: ItemStatistics
  // How far into an item, in percent, a play has to get to count as one
  minPlayPercent: number
  googleAnalyticsId: string
  isOutsideAccess: boolean
  isAnonymized: boolean
  complete: boolean
}

// A track the admin uploaded, kept in the config directory
export type RewindMusic = {
  name: string
  type: string
  size: number
  // When it was uploaded, which also tells browsers a new track isn't cached
  updatedAt: number
}

export type RewindSettings = {
  isActive: boolean
  isAdminOnly: boolean
  isLibrariesSizeAndCountActive: boolean
  // The theme songs of the viewer's top show, top movie and binged show, and
  // their top track, play during their stories
  isThemeMusicActive: boolean
  music: RewindMusic | null
  isSnowActive: boolean
  period: RewindPeriodType
  // MM-DD, when each calendar year's edition comes out. A date before July is
  // in the year after.
  releaseDate: string
  // Only used by the specific year
  year?: number
  // Only used by the custom period
  startDate?: string
  complete: boolean
}

// What a Rewind covers: each calendar year's edition, the 365 days up to now,
// one calendar year, or from the start date up to now
export type RewindPeriodType =
  'calendarYear' | 'pastYear' | 'specificYear' | 'custom'

export type ItemStatistics = (
  | 'year'
  | 'tmdbRating'
  | 'imdbRating'
  | 'rottenTomatoesRating'
  | 'rottenTomatoesAudienceRating'
  | 'duration'
  | 'plays'
  | 'users'
  | 'requests'
  | 'requestsWatched'
)[]
export type DashboardTotalStatistics = (
  'size' | 'duration' | 'count' | 'requests'
)[]

export type DashboardSettings = {
  isActive: boolean
  isAdminOnly: boolean
  isUsersPageActive: boolean
  activeTotalStatistics: DashboardTotalStatistics
  customPeriod: string
  startDate: string
  complete: boolean
}

export type ActivitySettings = {
  isActive: boolean
  isAdminOnly: boolean
  complete: boolean
}

export type HistorySettings = {
  isActive: boolean
  isAdminOnly: boolean
  complete: boolean
}

export type Settings = {
  connection: ConnectionSettings
  general: GeneralSettings
  rewind: RewindSettings
  dashboard: DashboardSettings
  activity: ActivitySettings
  history: HistorySettings
  setupComplete: boolean
}

// What may be sent to the browser: no API keys or internal service URLs.
export type PublicConnectionSettings = Pick<
  ConnectionSettings,
  'statisticsSource' | 'mediaServerType' | 'complete'
> & {
  seerrUrl: string
  isSeerrActive: boolean
}

export type PublicSettings = Omit<Settings, 'connection'> & {
  connection: PublicConnectionSettings
}
