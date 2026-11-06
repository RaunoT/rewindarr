import { ItemRow } from '@/types/statsSource'
import { HistoryPlay } from './statsSource'

// Where a request is at, from Seerr's request and the media's status
export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'failed'
  | 'partiallyAvailable'
  | 'available'

// A Seerr request in the history
export type HistoryRequest = {
  id: number
  createdAt: number
  mediaType: 'movie' | 'tv'
  tmdbId: number
  // A show's requested seasons, in order
  seasons: number[]
  status: RequestStatus
  // The title's ID in the media server, once it's there
  ratingKey: string | null
  // The media server user who asked, empty when Seerr's user isn't one
  userId: string
  userName: string
  avatar: string
  // From TMDB, empty until they're looked up
  title: string
  year: number | null
  poster: string | null
}

// A play or a request, at the time it started or was made. The page's
// entries also get their title's year, ratings and IDs, as the dashboard's
// items have them, which is null for music or when they couldn't be found.
// Episodes or tracks played in a row are one entry, its play the newest and
// `binge` all of them, newest first.
export type HistoryEntry = (
  | { kind: 'play'; time: number; play: HistoryPlay; binge?: HistoryPlay[] }
  | { kind: 'request'; time: number; request: HistoryRequest }
) & { item?: ItemRow | null }

export type HistoryKind = HistoryEntry['kind']

export type HistoryTotals = {
  // In seconds
  watchTime: number
  plays: number
  requests: number
  // Who played or requested anything
  users: number
}
