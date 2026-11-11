import { Play } from '@/types/playHistory'
import { MediaServerType } from '@/types/settings'
import { LibrariesSize } from '@/utils/librariesSize'
import { HistoryReader } from '@/utils/playHistory'

// The data both statistics sources return. The fields keep the names of
// Tautulli's API, and Tracearr's data is mapped onto them.

export type LibraryType = 'movie' | 'show' | 'artist'

// What the media stats and top lists are grouped by
export type MediaStatsType = 'shows' | 'movies' | 'audio'

export type Library = {
  section_name: string
  section_id: string
  count: string
  parent_count: string
  child_count: string
  section_type: LibraryType
  is_active: number
}

export type SourceUser = {
  is_admin: 0 | 1
  is_restricted: 0 | 1
  is_active: 0 | 1
  user_id: string
  friendly_name: string
  thumb: string
  user_thumb: string
  username: string
  email: string
  shared_libraries: string[]
}

// A row of a top list: a movie, show or artist, or a user
export type ItemRow = {
  title: string
  year: number | null
  total_plays: number
  total_duration: number
  users_watched: number | undefined
  // A number from Plex, a string from Jellyfin
  rating_key: number | string
  thumb: string
  // TMDB's, for when the source can't serve its own
  tmdb_poster?: string | null
  // TMDB's, for art behind the title
  tmdb_backdrop?: string | null
  is_deleted: boolean
  rating: string | null
  // IMDb's from Radarr or Sonarr, Rotten Tomatoes' from its own search
  imdb_rating?: string | null
  rotten_tomatoes_rating?: number | null
  rotten_tomatoes_audience_rating?: number | null
  rotten_tomatoes_url?: string | null
  tmdb_id: number | null
  imdb_id: string | null
  tvdb_id?: number | null
  user_thumb: string
  user: string
  friendly_name: string
  requests: number
  audio_plays_count: number
  movies_plays_count: number
  shows_plays_count: number
  user_id: number | string
  rank: number
  // Set when the anonymize setting hides who this user is
  is_anonymous?: boolean
  // ISO 8601 date of the user's first play, set for the users page
  first_played_at?: string
  grandparent_rating_key?: number | string
  media_id?: string | null
}

export type ActivitySession = {
  // Tautulli sends 0 or 1, Tracearr a boolean
  audio_atmos?: number | boolean
  audio_channel_layout: string
  audio_codec: string
  bandwidth: string
  bitrate: string
  container: string
  duration?: string
  friendly_name: string
  // Plex's IDs for the show of an episode, like `tmdb://61575`. Only
  // Tautulli has them.
  grandparent_guids?: string[]
  grandparent_rating_key?: number | string
  grandparent_thumb: string
  grandparent_title: string
  // Plex's IDs for the item itself, so an episode's own
  guids?: string[]
  ip_address?: string
  ip_address_public?: string
  location?: string
  // An episode's number. Tautulli sends it as a string, empty when unknown.
  media_index?: number | string | null
  media_type: string
  // An episode's season
  parent_media_index?: number | string | null
  parent_rating_key?: number | string
  parent_title?: string
  player: string
  product: string
  progress_percent: string
  quality_profile: string
  // A number from Plex, a string from Jellyfin
  rating_key: number | string
  session_key: string
  state: 'playing' | 'paused' | 'buffering'
  stream_audio_atmos?: number | boolean
  stream_audio_channel_layout: string
  stream_audio_codec: string
  stream_audio_decision: string
  stream_audio_language: string
  stream_bitrate: string
  stream_container: string
  stream_container_decision: string
  stream_subtitle_codec: string
  stream_subtitle_decision: string
  stream_subtitle_language: string
  stream_video_codec: string
  stream_video_decision: string
  stream_video_dynamic_range: string
  stream_video_full_resolution: string
  subtitle_codec: string
  thumb: string
  title: string
  transcode_decision: string
  user_id: number | string
  user_thumb: string
  video_codec: string
  video_dynamic_range: string
  video_full_resolution: string
  view_offset?: string
  // Tautulli sends it as a string
  year?: number | string | null
}

export type Activity = {
  sessions: ActivitySession[]
  stream_count: number
}

// The plays that started from `since` up to `until`, or up to now without one
export type PlayPeriod = {
  // ISO 8601
  since: string
  // Exclusive
  until?: string
}

export type DurationQuery = PlayPeriod & {
  userId?: string
  // Leaving out libraries counts plays of every media type.
  libraries?: Library[]
}

export type TopUsersQuery = PlayPeriod & {
  libraries: Library[]
}

// The duration is null when there is no library of that type.
export type MediaStats = Record<
  MediaStatsType,
  { count: number; duration: number | null }
>

export type TopMediaItems = Record<MediaStatsType, ItemRow[]>

// A director or actor, ranked by how many of their movies or shows a user
// watched
export type TopPerson = {
  name: string
  // Each movie or show counts once, however often it was watched
  count: number
  // In seconds
  duration: number
  // The most watched first
  titles: string[]
  // Who's in exactly the same titles, like the rest of a cast that's always
  // together, the best ranked first
  together: string[]
  // TMDB's portrait, null when it has none
  image: string | null
}

// Shows have a director per episode, so only movies rank directors.
export type TopPeople = {
  directors: TopPerson[]
  movieActors: TopPerson[]
  showActors: TopPerson[]
}

// A genre, ranked by how long a user spent on its movies or shows
export type TopGenre = {
  name: string
  // Of the user's time on the media type, from 0 to 1. A title counts toward
  // each of its genres, so the shares can add up to more than 1.
  share: number
}

// Another user whose genres are the most like the user's
export type TasteMatch = {
  userId: string
  name: string
  image: string | null
  // How alike their genres are, from 0 to 1
  score: number
  // The genres that make them alike, the most alike first
  genres: string[]
}

// Music has no genres to look up, so only movies and shows rank them.
export type Genres = {
  movies: TopGenre[]
  shows: TopGenre[]
  // Null when it wasn't asked for, or nobody else watched enough to compare
  match: TasteMatch | null
}

// `users` counts who played an item. A tie in users falls back to plays, and a
// tie in plays to watch time.
export type TopItemsSort = 'duration' | 'plays' | 'users'

export type TopItemsQuery = {
  // In days
  period: number
  userId?: string
  // Watch time when left out
  sortBy?: TopItemsSort
  count: number
}

// `hasMore` says whether the ranking goes on past the listed items.
export type TopItems = {
  items: ItemRow[]
  hasMore: boolean
}

// Plays per hour (0 to 23) and per day of the week (0 is Sunday)
export type PlaysByTime = {
  hourly: number[]
  daily: number[]
}

// A play in the history, with who played it. The user's ID and name are empty
// when the source no longer lists them.
export type HistoryPlay = Play & {
  userId: string
  userName: string
}

// Neither source knows when a user joined the server, so the first play stands
// in for it. It can't be older than the source's own history.
export type FirstPlay = {
  // ISO 8601
  date: string
  // The show or artist for an episode or track
  title: string
  // For showing what was played, null for media the stats leave out
  play: Play | null
}

// `unavailable` when the source couldn't be asked, which says nothing about
// whether the user still belongs to the server. `isAdmin` is null when the
// source can't tell, as Tracearr can't for Jellyfin.
export type ServerMembership =
  | { status: 'member'; isAdmin: boolean | null }
  | { status: 'notMember' }
  | { status: 'unavailable' }

// What links that open an item in the media server need. Plex's go through
// app.plex.tv, so only Jellyfin's use the URL.
export type MediaServer = {
  type: MediaServerType
  id: string
  url: string
}

export type LibrariesQuery = {
  // Asks Tautulli again instead of giving the libraries it kept, for where
  // they're picked. Tracearr's are one per media type, so they hardly change.
  fresh?: boolean
}

// Each statistics source maps its data onto the types above.
export type StatsSource = {
  // Null when the links can't be made
  getMediaServer: () => Promise<MediaServer | null>
  // Only the libraries the signed-in user can see
  getLibraries: (query?: LibrariesQuery) => Promise<Library[]>
  getLibrariesSize: (libraries: Library[]) => Promise<LibrariesSize>
  // Includes excluded users
  getUsers: () => Promise<SourceUser[]>
  getServerUser: (userId: string, email: string) => Promise<ServerMembership>
  getActivity: () => Promise<Activity | null>
  // In seconds. Excluded users are left out unless the query is for one user.
  getTotalDuration: (query: DurationQuery) => Promise<number>
  getTopItems: (library: Library, query: TopItemsQuery) => Promise<TopItems>
  // Ranked by watch time with each user's play counts, without excluded users
  getTopUsers: (query: TopUsersQuery) => Promise<ItemRow[] | null>
  // A user with no plays in the period
  getInactiveUser: (userId: string) => Promise<ItemRow | null>
  getMediaStats: (
    userId: string,
    libraries: Library[],
    period: PlayPeriod,
  ) => Promise<MediaStats>
  getTopMediaItems: (
    userId: string,
    libraries: Library[],
    period: PlayPeriod,
  ) => Promise<TopMediaItems>
  getTopPeople: (
    userId: string,
    libraries: Library[],
    period: PlayPeriod,
  ) => Promise<TopPeople>
  // The match compares the user with everyone else, which costs a lookup of
  // their most watched titles.
  getGenres: (
    userId: string,
    libraries: Library[],
    period: PlayPeriod,
    withMatch: boolean,
  ) => Promise<Genres>
  // In the timezone, or the Rewindarr server's without one
  getPlaysByTime: (
    userId: string,
    libraries: Library[],
    period: PlayPeriod,
    timeZone?: string,
  ) => Promise<PlaysByTime>
  // Null when the user has no plays or the source couldn't be asked
  getFirstPlay: (userId: string) => Promise<FirstPlay | null>
  // A play's movie, show or artist as a row, with its poster and ratings. With
  // a user, the row counts every play of it the user has, up to `until` when
  // given, which waits for the whole history to be read. Without one, only
  // this play.
  getPlayItem: (play: Play, userId?: string, until?: string) => Promise<ItemRow>
  // Every play in the query's period, the newest first, without excluded users
  // unless the query is for one user
  getHistoryPlays: (query: DurationQuery) => Promise<HistoryPlay[]>
  // The play histories the stats are read from. Without libraries, those of
  // every library, whoever is signed in.
  getHistoryReaders: (libraries?: Library[]) => Promise<HistoryReader[]>
  // A source that can't be reached returns the same empty lists as one with
  // nothing in it, so this tells the two apart.
  isReachable: () => Promise<boolean>
  // What the source's answers are saved under, to stand in while it's down
  getSnapshotKey: () => string
}
