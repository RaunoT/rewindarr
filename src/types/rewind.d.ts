import { PublicSettings } from './settings'
import { Genres, MediaServer, TopPeople } from './statsSource'
import { TautulliItemRow, TautulliLibrary } from './tautulli'

// The time a Rewind covers. A play counts in the period it started in.
export type RewindPeriod = {
  // ISO 8601, a date for the periods that run to now
  start: string
  // Exclusive, left out for a period that runs to now
  end?: string
  // A calendar-year edition's, null for the other periods
  year: number | null
}

export type RewindUser = {
  id: string
  name: string
  image?: string | null
  isAdmin: boolean
}

type RequestCounts = {
  total: number
  movies: number
  shows: number
}

export type TopTrack = {
  // Null for a play the source has no rating key for
  ratingKey: string | null
  title: string
  artist: string | null
  plays: number
  durationMs: number
  // No other track has a play that counts
  isOnly: boolean
}

type LibraryRewind = {
  count: number
  duration: string
  // In seconds, null without a library of the type
  duration_value: number | null
  // Every user's time on the type, in seconds
  server_duration_value: number | null
  // Of the user's total playtime, empty when it rounds to 0%
  percentage: string
  top: TautulliItemRow[]
}

export type UserRewind = {
  usersTop: TautulliItemRow[] | null
  libraries: TautulliLibrary[]
  libraries_total_size: number
  libraries_size_is_partial: boolean
  // Null when Seerr couldn't be read
  requests?:
    | (RequestCounts & {
        user: RequestCounts
        // Among the users who made requests, null without anyone else
        average: {
          count: number
          difference: number
        } | null
      })
    | null
  media_server: MediaServer | null
  shows: LibraryRewind
  movies: LibraryRewind
  people: TopPeople
  genres: Genres
  audio: LibraryRewind & {
    // The user's most played track, null without any
    topTrack: TopTrack | null
  }
  habits: {
    peakHour: number | null
    peakDayIndex: number | null
    totalPlays: number
    hourly: number[]
    daily: number[]
  }
  duration: {
    user: string
    // Null without anyone else to compare with
    average: {
      duration: string
      difference: number
    } | null
  }
  period: RewindPeriod
  // Formatted on the server, null without any play before the period ends
  firstPlay: {
    date: string
    timeSince: string
    title: string
    // Shown as a card, like the favorites
    item: {
      data: TautulliItemRow
      type: 'movie' | 'show' | 'artist'
      // Whether its watch time and plays are the user's all-time ones
      hasTotals: boolean
    } | null
  } | null
  user: RewindUser
}

export type RewindStory = {
  userRewind: UserRewind
  settings: PublicSettings
}
