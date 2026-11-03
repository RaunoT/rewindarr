import { HistoryRequest, RequestStatus } from '@/types/history'
import { Settings } from '@/types/settings'
import { chunk } from 'lodash'
import {
  fetchSeerrStats,
  getMediaUserIds,
  SeerrRequestItem,
} from './fetchSeerr'
import fetchTmdb from './fetchTmdb'
import getSettings from './getSettings'
import { getUsers } from './statsSource'

type TmdbTitle = {
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
}

const TMDB_POSTER_URL = 'https://image.tmdb.org/t/p/w92'
// TMDB lookups at a time, so a search over every request doesn't flood it
const TMDB_BATCH_SIZE = 20

export function isSeerrActive(settings: Settings = getSettings()): boolean {
  return !!(settings.connection.seerrUrl && settings.connection.seerrApiKey)
}

export function getRequestStatus(request: SeerrRequestItem): RequestStatus {
  switch (request.status) {
    case 1:
      return 'pending'
    case 3:
      return 'declined'
    case 4:
      return 'failed'
  }

  switch (request.media?.status) {
    case 4:
      return 'partiallyAvailable'
    case 5:
      return 'available'
    default:
      return 'approved'
  }
}

// The requests made since `since`, without the excluded users'. Null when
// Seerr isn't set up or couldn't be asked. Requests from Seerr users who
// aren't on the media server keep Seerr's name for them.
export async function getHistoryRequests(
  since: string,
): Promise<HistoryRequest[] | null> {
  const settings = getSettings()

  if (!isSeerrActive(settings)) {
    return null
  }

  const [requests, users] = await Promise.all([
    fetchSeerrStats('request', since),
    getUsers(settings),
  ])

  if (!requests) {
    return null
  }

  const usersById = new Map(users.map((user) => [String(user.user_id), user]))
  const { excludedUsers } = settings.general

  return requests.flatMap((request) => {
    const tmdbId = request.media?.tmdbId
    const mediaUserIds = getMediaUserIds(request.requestedBy)
    const userId = mediaUserIds.find((id) => usersById.has(id))
    const user = userId ? usersById.get(userId) : undefined

    // An excluded user stays excluded once they're no longer listed, as
    // Tautulli leaves out inactive users
    if (
      !tmdbId ||
      (request.type !== 'movie' && request.type !== 'tv') ||
      mediaUserIds.some((id) => excludedUsers.includes(id))
    ) {
      return []
    }

    return [
      {
        id: request.id,
        createdAt: new Date(request.createdAt).getTime(),
        mediaType: request.type,
        tmdbId,
        seasons: (request.seasons ?? [])
          .map((season) => season.seasonNumber)
          .sort((a, b) => a - b),
        status: getRequestStatus(request),
        userId: userId ?? '',
        userName:
          user?.friendly_name ||
          user?.username ||
          request.requestedBy.displayName ||
          '',
        avatar: user?.user_thumb ?? '',
        title: '',
        year: null,
        poster: null,
      },
    ]
  })
}

// The title, year and poster from TMDB. A request TMDB has nothing for keeps
// them empty.
export async function addRequestDetails(
  requests: HistoryRequest[],
): Promise<HistoryRequest[]> {
  const detailed: HistoryRequest[] = []

  for (const batch of chunk(requests, TMDB_BATCH_SIZE)) {
    detailed.push(
      ...(await Promise.all(
        batch.map(async (request) => {
          if (request.title) {
            return request
          }

          const tmdb = await fetchTmdb<TmdbTitle>(
            `${request.mediaType}/${request.tmdbId}`,
          )
          const date = tmdb?.release_date || tmdb?.first_air_date

          return {
            ...request,
            title: tmdb?.title || tmdb?.name || '',
            year: date ? Number(date.slice(0, 4)) || null : null,
            poster: tmdb?.poster_path
              ? `${TMDB_POSTER_URL}${tmdb.poster_path}`
              : null,
          }
        }),
      )),
    )
  }

  return detailed
}
