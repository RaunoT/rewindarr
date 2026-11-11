import { authOptions } from '@/lib/auth'
import { Settings } from '@/types/settings'
import {
  Activity,
  FirstPlay,
  ItemRow,
  Library,
  MediaServer,
  ServerMembership,
  SourceUser,
  StatsSource,
} from '@/types/statsSource'
import { TautulliHistoryRow, TautulliMetadata } from '@/types/tautulli'
import { pick } from 'lodash'
import { getServerSession } from 'next-auth'
import { cache } from 'react'
import fetchTautulli, { TautulliResponse } from './fetchTautulli'
import {
  MediaIds,
  parseGuids,
  SavedMediaData,
  SourceMediaData,
  TmdbMediaType,
} from './getMediaAdditionalData'
import getSettings from './getSettings'
import { LibrariesSize, sumLibrariesSize } from './librariesSize'
import {
  createPlayStats,
  StatsUser,
  toInactiveUserRow,
  toSourceId,
} from './playStats'
import {
  getSnapshot,
  isListOf,
  isObject,
  isString,
  isStringList,
  saveSnapshot,
} from './sourceSnapshot'
import {
  getTautulliHistoryReaders,
  getTautulliKey,
  getTautulliPlays,
  toTautulliPlay,
} from './tautulliHistory'

type LibrariesResponse = TautulliResponse<Library[]> | null

type LibrariesCache = {
  // The Tautulli they're from, by its URL and API key
  key: string
  response: LibrariesResponse
  expiresAt: number
  pending: Promise<LibrariesResponse> | null
}

// How long Tautulli's libraries are kept before they're asked for again
const LIBRARIES_TTL = 5 * 60 * 1000
// Next.js can bundle this file into more than one chunk, and each copy would
// otherwise ask for the libraries on its own.
const globalForTautulli = globalThis as unknown as {
  rewindarrTautulliLibraries?: LibrariesCache
}

async function requestLibraries(
  libraries: LibrariesCache,
): Promise<LibrariesResponse> {
  try {
    const response = await fetchTautulli<Library[]>('get_libraries')
    // Not an empty list, which Tautulli answers with while Plex can't be
    // reached, so it's asked again
    const hasLibraries =
      Array.isArray(response?.response?.data) &&
      response.response.data.length > 0

    libraries.response = hasLibraries ? response : null
    libraries.expiresAt = hasLibraries ? Date.now() + LIBRARIES_TTL : 0

    return response
  } finally {
    libraries.pending = null
  }
}

// For every library, get_libraries has Tautulli count the items on Plex, which
// takes seconds for a large one and times out when several requests run at
// once. So every page and the history reads share one request, and its answer
// is kept. Once it's due again, the kept answer is given while the new one is
// on its way, so that no page waits for the counts.
function fetchLibraries(): Promise<LibrariesResponse> {
  const { tautulliUrl, tautulliApiKey } = getSettings().connection
  const key = `${tautulliUrl}|${tautulliApiKey}`

  let libraries = globalForTautulli.rewindarrTautulliLibraries

  if (libraries?.key !== key) {
    libraries = { key, response: null, expiresAt: 0, pending: null }
    globalForTautulli.rewindarrTautulliLibraries = libraries
  }

  if (Date.now() >= libraries.expiresAt) {
    libraries.pending ??= requestLibraries(libraries)
  }

  return libraries.response
    ? Promise.resolve(libraries.response)
    : (libraries.pending ?? Promise.resolve(null))
}

// The timeout signal opts requests out of fetch's per-render deduplication, so
// lookups repeated by a page's layout, metadata and content share one call.
const fetchUsers = cache(() => fetchTautulli<SourceUser[]>('get_users'))
const fetchUser = cache((userId: string) =>
  fetchTautulli<SourceUser>('get_user', { user_id: userId }),
)
// What the stats need, saved for while Tautulli is down. get_users also
// returns each user's email and Plex token, which stay out.
const LIBRARY_FIELDS = [
  'section_name',
  'section_id',
  'count',
  'parent_count',
  'child_count',
  'section_type',
  'is_active',
] as const satisfies readonly (keyof Library)[]
const USER_FIELDS = [
  'is_admin',
  'is_restricted',
  'is_active',
  'user_id',
  'friendly_name',
  'thumb',
  'user_thumb',
  'username',
] as const satisfies readonly (keyof SourceUser)[]

// The saved ID stands in while Tautulli is down
async function getMediaServer(): Promise<MediaServer | null> {
  const key = `${getTautulliKey()}|serverId`
  const fetched = await fetchServerId()

  if (fetched) {
    void saveSnapshot(key, fetched)
  }

  const serverId = fetched ?? (await getSnapshot(key, isString))

  return serverId ? { type: 'plex', id: serverId, url: '' } : null
}

// The Plex server Tautulli tracks
async function fetchServerId(): Promise<string | null> {
  const res = await fetchTautulli<{ machine_identifier: string }>(
    'get_server_identity',
    undefined,
    true,
  )
  const serverId = res?.response?.data?.machine_identifier

  if (!serverId) {
    console.error("[TAUTULLI] - Couldn't get the Plex server's ID!")

    return null
  }

  return serverId
}

// Every library, whoever is signed in, as the histories are read in the
// background and shared between users. Not only the active ones, so the read
// starts before the libraries are picked, and picking one doesn't start another.
// The saved ones stand in while Tautulli is down.
async function getAllLibraries(): Promise<Library[] | null> {
  const key = `${getTautulliKey()}|libraries`
  const libraries = (await fetchLibraries())?.response?.data

  if (!Array.isArray(libraries)) {
    return getSnapshot(key, isListOf<Library>)
  }

  void saveSnapshot(
    key,
    libraries.map((library) => pick(library, LIBRARY_FIELDS)),
  )

  return libraries
}

async function getLibraries(): Promise<Library[]> {
  const libraries = await getAllLibraries()

  if (!libraries) {
    console.warn('[TAUTULLI] - No libraries found!')

    return []
  }

  return filterBySharedLibraries(getSettings(), libraries)
}

// Shares the libraries request, so asking costs no extra call
async function isTautulliReachable(): Promise<boolean> {
  return (await fetchLibraries()) !== null
}

async function filterBySharedLibraries(
  settings: Settings,
  libraries: Library[],
): Promise<Library[]> {
  if (settings.general.isOutsideAccess || !settings.setupComplete) {
    return libraries
  }

  const session = await getServerSession(authOptions)
  const userId = session?.user.id

  if (!userId) {
    console.error('[TAUTULLI] - No user ID found!')

    return []
  }

  const sharedLibraries = await getSharedLibraries(userId)

  if (!sharedLibraries) {
    console.warn(`[TAUTULLI] - Could not fetch user data for user ID ${userId}`)

    return []
  }

  return libraries.filter((library) =>
    sharedLibraries.includes(library.section_id),
  )
}

// The saved ones stand in while Tautulli is down
async function getSharedLibraries(userId: string): Promise<string[] | null> {
  const key = `${getTautulliKey()}|sharedLibraries|${userId}`
  const userDataResponse = await fetchUser(userId)

  if (!userDataResponse) {
    return getSnapshot(key, isStringList)
  }

  const sharedLibraries = userDataResponse.response.data?.shared_libraries ?? []

  void saveSnapshot(key, sharedLibraries)

  return sharedLibraries
}

async function getLibrariesSize(libraries: Library[]): Promise<LibrariesSize> {
  const res = await Promise.all(
    libraries.map((library) =>
      fetchTautulli<{ total_file_size?: number }>(
        'get_library_media_info',
        {
          section_id: library.section_id,
          length: 0,
        },
        true,
      ),
    ),
  )

  // Tautulli only reports a size for TV and music libraries once "Calculate
  // Total File Sizes" is enabled.
  return sumLibrariesSize(
    libraries.map((library, i) => ({
      size: res[i]?.response?.data?.total_file_size,
      hasItems: Number(library.count) > 0 || Number(library.child_count) > 0,
    })),
  )
}

// Includes inactive users. The saved ones stand in while Tautulli is down,
// without their emails.
async function getAllUsers(): Promise<SourceUser[] | null> {
  const key = `${getTautulliKey()}|users`
  const users = (await fetchUsers())?.response?.data

  if (!Array.isArray(users)) {
    return getSnapshot(key, isListOf<SourceUser>)
  }

  void saveSnapshot(
    key,
    users.map((user) => ({
      ...pick(user, USER_FIELDS),
      email: '',
      shared_libraries: [],
    })),
  )

  return users
}

async function getUsers(): Promise<SourceUser[]> {
  const users = (await getAllUsers()) ?? []

  return users.filter((user) => user.is_active && user.username !== 'Local')
}

async function getServerUser(
  userId: string,
  email: string,
): Promise<ServerMembership> {
  const userRes = await fetchUser(userId)

  // No response is an outage or a misconfiguration, not an answer about the user
  if (!userRes) {
    return { status: 'unavailable' }
  }

  const user = userRes.response?.data

  if (user?.email !== email || !user?.is_active) {
    return { status: 'notMember' }
  }

  return { status: 'member', isAdmin: user.is_admin === 1 }
}

async function getActivity(): Promise<Activity | null> {
  const res = await fetchTautulli<Activity>('get_activity')
  const data = res?.response?.data

  if (!data) {
    return null
  }

  // Tautulli sends the count as a string, and '0' is truthy
  return { ...data, stream_count: Number(data.stream_count) || 0 }
}

type TautulliSearchResult = TautulliMetadata & {
  rating_key?: number | string
  title?: string
}

type TautulliSearch = {
  results_list?: Partial<Record<string, TautulliSearchResult[]>>
}

const SEARCH_LIMIT = 20

// Empty for an item Plex no longer has, null when Tautulli couldn't be asked
async function fetchMetadata(
  ratingKey: number | string,
): Promise<TautulliMetadata | null> {
  const res = await fetchTautulli<TautulliMetadata>(
    'get_metadata',
    { rating_key: ratingKey },
    true,
    // Before 2.18 Tautulli answered with a success without data
    { missingMessage: /^Unable to retrieve metadata/ },
  )

  return res?.response?.data ?? null
}

function isMatchingIds(result: TautulliSearchResult, ids: MediaIds): boolean {
  const resultIds = parseGuids(Array.isArray(result.guids) ? result.guids : [])

  return (
    (!!ids.imdb && ids.imdb === resultIds.imdb) ||
    (!!ids.tmdb && ids.tmdb === resultIds.tmdb) ||
    (!!ids.tvdb && ids.tvdb === resultIds.tvdb)
  )
}

// Plex gives a re-added item a new rating key, and Tautulli's plays keep the
// old one. The title finds it, and its IDs or year tell it apart from others
// of the same name. Without either, only a title that's the only one counts.
async function findReaddedRatingKey(
  item: ItemRow,
  type: TmdbMediaType,
  saved?: SavedMediaData | null,
): Promise<number | string | null> {
  if (!item.title) {
    return null
  }

  const res = await fetchTautulli<TautulliSearch>(
    'search',
    { query: item.title, limit: SEARCH_LIMIT },
    true,
  )
  const title = item.title.trim().toLowerCase()
  const results = (
    res?.response?.data?.results_list?.[type === 'movie' ? 'movie' : 'show'] ??
    []
  ).filter(
    (result) =>
      result.rating_key && result.title?.trim().toLowerCase() === title,
  )
  const knownIds: MediaIds = {
    imdb: saved?.ids?.imdb || item.imdb_id || null,
    tmdb: saved?.ids?.tmdb || item.tmdb_id || null,
    tvdb: saved?.ids?.tvdb || item.tvdb_id || null,
  }
  const year = saved?.year || item.year
  const match =
    knownIds.imdb || knownIds.tmdb || knownIds.tvdb
      ? results.find((result) => isMatchingIds(result, knownIds))
      : year
        ? results.find((result) => Number(result.year) === year)
        : results.length === 1
          ? results[0]
          : undefined

  return match?.rating_key ?? null
}

// The saved IDs and year stand in while Tautulli is down, so a show isn't
// looked up by its title alone
export async function getTautulliMediaData(
  item: ItemRow,
  type: TmdbMediaType,
): Promise<SourceMediaData> {
  const key = `${getTautulliKey()}|media|${item.rating_key}`

  let metadata = await fetchMetadata(item.rating_key)

  if (!metadata) {
    const saved = await getSnapshot(key, isObject<SavedMediaData>)

    return { thumb: '', isDeleted: false, ids: saved?.ids, year: saved?.year }
  }

  let ratingKey: number | string | null = null

  if (Object.keys(metadata).length === 0) {
    const saved = await getSnapshot(key, isObject<SavedMediaData>)
    const readdedKey = await findReaddedRatingKey(item, type, saved)
    const readded = readdedKey ? await fetchMetadata(readdedKey) : null

    if (readded && Object.keys(readded).length > 0) {
      metadata = readded
      ratingKey = toSourceId(String(readdedKey))
    }
  }

  const isDeleted = Object.keys(metadata).length === 0
  const media: SavedMediaData = {
    ids: parseGuids(Array.isArray(metadata.guids) ? metadata.guids : []),
    year: Number(metadata.year) || null,
  }

  if (!isDeleted) {
    void saveSnapshot(key, media)
  }

  return {
    thumb: metadata.thumb || '',
    isDeleted,
    ...media,
    ...(!isDeleted && {
      credits: {
        directors: toNames(metadata.directors),
        actors: toNames(metadata.actors),
      },
      genres: toNames(metadata.genres),
    }),
    ...(ratingKey && { ratingKey }),
  }
}

function toNames(names: unknown): string[] {
  return Array.isArray(names)
    ? names.filter((name): name is string => typeof name === 'string')
    : []
}

// While Tautulli is down, the user comes from the saved list
async function getInactiveUser(id: string): Promise<ItemRow | null> {
  const user =
    (await fetchUser(id))?.response?.data ??
    (await getAllUsers())?.find((user) => String(user.user_id) === id)

  // Without a user ID the play counts would be for the whole server.
  if (user?.user_id == null) {
    return null
  }

  return toInactiveUserRow(user)
}

async function getFirstPlay(userId: string): Promise<FirstPlay | null> {
  const res = await fetchTautulli<{ data: TautulliHistoryRow[] }>(
    'get_history',
    { user_id: userId, order_column: 'date', order_dir: 'asc', length: 1 },
    true,
  )
  const row = res?.response?.data?.data?.[0]

  if (!row?.date) {
    return null
  }

  return {
    date: new Date(row.date * 1000).toISOString(),
    title: row.grandparent_title || row.title,
    play: toTautulliPlay(row),
  }
}

// Inactive users stay in, like in Tautulli's own rankings, so their plays can
// still be left out when they're excluded.
async function getStatsUsers(): Promise<StatsUser[]> {
  const users = await getAllUsers()

  if (!users) {
    return []
  }

  return users.map((user) => ({
    identityId: String(user.user_id),
    userId: String(user.user_id),
    username: user.username,
    friendlyName: user.friendly_name,
  }))
}

const playStats = createPlayStats({
  getPlays: async (since, libraries) =>
    getTautulliPlays(since, libraries ?? (await getAllLibraries()) ?? []),
  getUsers: getStatsUsers,
  getMediaData: getTautulliMediaData,
})
const tautulliSource: StatsSource = {
  ...playStats,
  getMediaServer,
  getLibraries,
  getLibrariesSize,
  getUsers,
  getServerUser,
  getActivity,
  getInactiveUser,
  getFirstPlay,
  getHistoryReaders: async (libraries) =>
    getTautulliHistoryReaders(libraries ?? (await getAllLibraries()) ?? []),
  isReachable: isTautulliReachable,
  getSnapshotKey: getTautulliKey,
}

export default tautulliSource
