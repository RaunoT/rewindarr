import { RewindMoments } from '@/utils/rewindMoments'
import { RewindPersonality } from './rewindPersonality'
import { RewindSocial } from './rewindSocial'
import { PublicSettings } from './settings'
import { Genres, MediaServer, TopPeople } from './statsSource'
import { TautulliItemRow, TautulliLibrary } from './tautulli'
import { TitleMoments } from './titleMoments'
import { YearOverYear } from './yearOverYear'

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

type LibraryTotals = {
  count: number
  duration: string
  // In seconds, null without a library of the type
  duration_value: number | null
  // Every user's time on the type, in seconds
  server_duration_value: number | null
  // Of the user's total playtime, empty when it rounds to 0%
  percentage: string
}

type LibraryRewind = LibraryTotals & {
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
  // How the user watched, null with too little to go on
  personality?: RewindPersonality | null
  media_server: MediaServer | null
  shows: LibraryRewind
  movies: LibraryRewind
  people: TopPeople
  genres: Genres
  audio: LibraryRewind & {
    // The user's most played track, null without any
    topTrack: TopTrack | null
  }
  titleMoments: TitleMoments
  // Null until the whole history has been read, or without enough plays before
  // the period to compare with
  yearOverYear: YearOverYear | null
  habits: {
    peakHour: number | null
    peakDayIndex: number | null
    totalPlays: number
    hourly: number[]
    daily: number[]
  }
  duration: {
    user: string
    // The user's time in days, as if watched in one go, null under a day
    nonStopDays: number | null
    // Null without anyone else to compare with
    average: {
      duration: string
      difference: number
    } | null
    // The top percent of users the user is in by their time, null with too
    // few users or outside the top quarter
    topPercent: number | null
  }
  // Formatted on the server, null without any play
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
  social: RewindSocial
  // From the user's plays in the period
  moments: RewindMoments
  user: RewindUser
}

// What the total story shows, which is read before the rest
export type RewindTotals = Pick<UserRewind, 'duration'> & {
  shows: LibraryTotals
  movies: LibraryTotals
  audio: LibraryTotals
}

// The stories shown before the rest is in take only what they show
export type RewindStory<T = UserRewind> = {
  userRewind: T
  settings: PublicSettings
}
