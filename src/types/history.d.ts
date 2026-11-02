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
  // The media server user who asked, empty when Seerr's user isn't one
  userId: string
  userName: string
  avatar: string
  // From TMDB, empty until they're looked up
  title: string
  year: number | null
  poster: string | null
}

// A play or a request, at the time it started or was made
export type HistoryEntry =
  | { kind: 'play'; time: number; play: HistoryPlay }
  | { kind: 'request'; time: number; request: HistoryRequest }

export type HistoryKind = HistoryEntry['kind']

export type HistoryTotals = {
  // In seconds
  watchTime: number
  plays: number
  requests: number
  // Who played or requested anything
  users: number
}
