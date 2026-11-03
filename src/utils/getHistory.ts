import {
  HistoryEntry,
  HistoryKind,
  HistoryRequest,
  HistoryTotals,
} from '@/types/history'
import { HistoryStatus } from '@/types/playHistory'
import { HistoryPlay } from '@/types/statsSource'
import { TautulliItemRow, TautulliLibrary } from '@/types/tautulli'
import { clamp, orderBy, range, sumBy } from 'lodash'
import { HISTORY_PAGE_SIZES } from './constants'
import getMediaAdditionalData from './getMediaAdditionalData'
import {
  addRequestDetails,
  getHistoryRequests,
  isSeerrActive,
} from './historyRequests'
import { EMPTY_ROW } from './playStats'
import { getHistoryProgress, getStatsSource } from './statsSource'

const DAY = 24 * 60 * 60 * 1000
// The plays are looked for in the past week first, and in a window four times
// as long each time that has too few
const FIRST_WINDOW_DAYS = 7
const WINDOW_GROWTH = 4
// Past this, the window is the whole history
const MAX_WINDOW_DAYS = 5 * 365
const WHOLE_HISTORY = new Date(0).toISOString()

// Each window to look for plays in, the shortest first and the whole history
// last
function getWindows(now: number): string[] {
  const windows: string[] = []

  for (let days = FIRST_WINDOW_DAYS; days <= MAX_WINDOW_DAYS;) {
    windows.push(new Date(now - days * DAY).toISOString())
    days *= WINDOW_GROWTH
  }

  return [...windows, WHOLE_HISTORY]
}

export type RecentPlays = {
  plays: HistoryPlay[]
  hasMore: boolean
  // While the history isn't read back far enough yet, how far the read has
  // got. The plays are the ones read so far.
  progress: HistoryStatus | null
}

// The newest plays in the libraries, or in all of them. They're looked for in
// ever longer windows, so a page doesn't wait for the whole history when the
// newest plays are enough.
export async function getRecentPlays(
  count: number,
  libraries?: TautulliLibrary[],
  now = Date.now(),
): Promise<RecentPlays> {
  const source = getStatsSource()

  let plays: HistoryPlay[] = []

  for (const since of getWindows(now)) {
    const progress = await getHistoryProgress(since, libraries)

    // The plays of the window before are all there, and too few for more
    if (progress) {
      return { plays, hasMore: false, progress }
    }

    plays = await source.getHistoryPlays({ since, libraries })

    if (plays.length > count) {
      break
    }
  }

  return {
    plays: plays.slice(0, count),
    hasMore: plays.length > count,
    progress: null,
  }
}

// The libraries' types a request can be for. Music has none.
const REQUEST_TYPES: Partial<
  Record<TautulliLibrary['section_type'], HistoryRequest['mediaType']>
> = {
  movie: 'movie',
  show: 'tv',
}

export type HistoryFilter = {
  // The start of the period
  since: string
  // Every library's plays without them, and only their types' requests
  libraries?: TautulliLibrary[]
  // Everyone's without any
  userIds?: string[]
  // Looked for in the titles, and a show's or artist's name
  search?: string
  // Both without one
  kind?: HistoryKind
}

export type HistoryPage = {
  entries: HistoryEntry[]
  // From 1, and never past the last page
  page: number
  pageCount: number
  // Of everything matching the filter, not only the page
  totals: HistoryTotals
  // While the history is still read, how far it has got. The pages are of the
  // plays read so far.
  progress: HistoryStatus | null
  // Seerr was asked for the requests but didn't answer
  hasRequestsFailed: boolean
}

function isPickedUser(userId: string, userIds?: string[]): boolean {
  return !userIds?.length || userIds.includes(userId)
}

// Every play matching the filter, newest first. While the history is still
// being read, the plays of the longest window it already has, so the pages
// don't wait for the rest.
async function getMatchingPlays(
  { since, libraries, userIds }: HistoryFilter,
  now: number,
): Promise<{ plays: HistoryPlay[]; progress: HistoryStatus | null }> {
  const source = getStatsSource()
  const progress = await getHistoryProgress(since, libraries)
  // The source can only narrow plays down to one user, which keeps an
  // excluded user's own plays. Several are picked from the rest.
  const userId = userIds?.length === 1 ? userIds[0] : undefined

  async function getPlays(since: string) {
    const plays = await source.getHistoryPlays({ since, libraries, userId })

    return plays.filter((play) => isPickedUser(play.userId, userIds))
  }

  if (!progress) {
    return { plays: await getPlays(since), progress }
  }

  const sinceTime = new Date(since).getTime()
  const windows = getWindows(now).filter(
    (window) => new Date(window).getTime() > sinceTime,
  )

  let plays: HistoryPlay[] = []

  for (const window of [...windows, since]) {
    if (await getHistoryProgress(window, libraries, 0)) {
      break
    }

    plays = await getPlays(window)
  }

  return { plays, progress }
}

// The requests matching the filter, newest first, but for the search, which
// needs their titles. Null when Seerr didn't answer.
async function getMatchingRequests({
  since,
  libraries,
  userIds,
}: HistoryFilter): Promise<HistoryRequest[] | null> {
  const requests = await getHistoryRequests(since)
  const types = libraries?.map((library) => REQUEST_TYPES[library.section_type])

  if (!requests) {
    return null
  }

  return requests
    .filter(
      (request) =>
        (!types || types.includes(request.mediaType)) &&
        isPickedUser(request.userId, userIds),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
}

// The year, ratings and IDs of each entry's title, looked up like the
// dashboard's items, so the page shows the same. Entries of one title share a
// lookup, and a failed one leaves the entry without them.
async function addItems(entries: HistoryEntry[]): Promise<HistoryEntry[]> {
  const source = getStatsSource()
  const lookups = new Map<string, Promise<TautulliItemRow | null>>()

  function lookUp(key: string, load: () => Promise<TautulliItemRow>) {
    let lookup = lookups.get(key)

    if (!lookup) {
      lookup = load().catch((error) => {
        console.error('[HISTORY] - Unable to look up a title!', error)

        return null
      })
      lookups.set(key, lookup)
    }

    return lookup
  }

  return Promise.all(
    entries.map(async (entry): Promise<HistoryEntry> => {
      if (entry.kind === 'request') {
        const { request } = entry

        return {
          ...entry,
          item: await lookUp(
            `request|${request.mediaType}|${request.tmdbId}`,
            async () =>
              (
                await getMediaAdditionalData(
                  [
                    {
                      ...EMPTY_ROW,
                      title: request.title,
                      year: request.year,
                      tmdb_id: request.tmdbId,
                    },
                  ],
                  request.mediaType,
                  async () => ({ thumb: '', isDeleted: false }),
                )
              )[0],
          ),
        }
      }

      const { play } = entry

      // Music has no ratings to look up
      if (play.mediaType === 'track') {
        return { ...entry, item: null }
      }

      return {
        ...entry,
        item: await lookUp(
          [
            'play',
            play.mediaType,
            play.grandparentRatingKey ||
              play.ratingKey ||
              // Movies of the same name differ by their year
              (play.mediaType === 'movie'
                ? `${play.title}|${play.year ?? ''}`
                : play.showTitle || play.title),
          ].join('|'),
          () => source.getPlayItem(play),
        ),
      }
    }),
  )
}

// The show of an episode or the artist of a track, which a binge stays on
function getBingeKey(play: HistoryPlay): string | null {
  if (play.mediaType !== 'episode' && play.mediaType !== 'track') {
    return null
  }

  return [
    play.mediaType,
    play.userId || play.identityId,
    play.grandparentRatingKey ||
      (play.mediaType === 'episode' ? play.showTitle : play.artistName),
  ].join('|')
}

// Episodes of one show, or tracks of one artist, that a user played one after
// another on the same day, as one entry. A request or another play between
// them ends the binge. The day is the server's, like the history's dates.
export function groupBinges(entries: HistoryEntry[]): HistoryEntry[] {
  const grouped: HistoryEntry[] = []

  for (const entry of entries) {
    const last = grouped.at(-1)

    if (entry.kind === 'play' && last?.kind === 'play') {
      const binge = last.binge ?? [last.play]
      const oldest = binge[binge.length - 1]
      const key = getBingeKey(entry.play)

      if (
        key &&
        key === getBingeKey(oldest) &&
        new Date(entry.play.startedAt).toDateString() ===
          new Date(oldest.startedAt).toDateString()
      ) {
        grouped[grouped.length - 1] = { ...last, binge: [...binge, entry.play] }

        continue
      }
    }

    grouped.push(entry)
  }

  return grouped
}

function matchesSearch(texts: (string | null)[], search: string): boolean {
  return texts.some((text) => text?.toLowerCase().includes(search))
}

function getTotals(
  plays: HistoryPlay[],
  requests: HistoryRequest[],
): HistoryTotals {
  return {
    watchTime: Math.round(sumBy(plays, 'durationMs') / 1000),
    plays: plays.length,
    requests: requests.length,
    // A Seerr user who isn't on the media server goes by their name
    users: new Set([
      ...plays.map((play) => play.userId || play.identityId),
      ...requests.map(
        (request) => request.userId || `seerr:${request.userName}`,
      ),
    ]).size,
  }
}

export async function getHistoryPage(
  filter: HistoryFilter,
  page: number,
  pageSize: number,
  now = Date.now(),
): Promise<HistoryPage> {
  const [{ plays: allPlays, progress }, allRequests] = await Promise.all([
    filter.kind === 'request'
      ? { plays: [], progress: null }
      : getMatchingPlays(filter, now),
    filter.kind === 'play' ? [] : getMatchingRequests(filter),
  ])
  const search = filter.search?.trim().toLowerCase()
  const plays = search
    ? allPlays.filter((play) =>
        matchesSearch([play.title, play.showTitle, play.artistName], search),
      )
    : allPlays

  let requests = allRequests ?? []

  // Only the page's requests need their titles, unless they're searched
  if (search) {
    requests = (await addRequestDetails(requests)).filter((request) =>
      matchesSearch([request.title], search),
    )
  }

  // A binge counts once in the pages, and each of its plays in the totals
  const entries = groupBinges(
    orderBy(
      [
        ...plays.map((play): HistoryEntry => ({
          kind: 'play',
          time: play.startedAt,
          play,
        })),
        ...requests.map((request): HistoryEntry => ({
          kind: 'request',
          time: request.createdAt,
          request,
        })),
      ],
      'time',
      'desc',
    ),
  )
  const pageCount = Math.max(Math.ceil(entries.length / pageSize), 1)
  const current = clamp(page, 1, pageCount)
  const pageEntries = entries.slice(
    (current - 1) * pageSize,
    current * pageSize,
  )
  const detailed = await addRequestDetails(
    pageEntries.flatMap((entry) =>
      entry.kind === 'request' ? [entry.request] : [],
    ),
  )
  const detailsById = new Map(detailed.map((request) => [request.id, request]))

  return {
    entries: await addItems(
      pageEntries.map((entry) =>
        entry.kind === 'request'
          ? {
              ...entry,
              request: detailsById.get(entry.request.id) ?? entry.request,
            }
          : entry,
      ),
    ),
    page: current,
    pageCount,
    totals: getTotals(plays, requests),
    progress,
    hasRequestsFailed:
      filter.kind !== 'play' && allRequests === null && isSeerrActive(),
  }
}

// The plays per page from the URL or the saved choice, whichever is one of
// the sizes on offer first, and the smallest without either
export function parsePageSize(...values: (string | undefined)[]): number {
  return (
    values.map(Number).find((value) => HISTORY_PAGE_SIZES.includes(value)) ??
    HISTORY_PAGE_SIZES[0]
  )
}

// The page from its search parameter, 1 when it's missing or not a page
export function parsePage(pageSearchParam?: string): number {
  const page = Number(pageSearchParam)

  return Number.isInteger(page) && page > 0 ? page : 1
}

// The pages to link to, with null for the pages left out between them. Always
// seven, the first and last among them, so the links don't move around.
export function getPageNumbers(
  page: number,
  pageCount: number,
): (number | null)[] {
  if (pageCount <= 7) {
    return range(1, pageCount + 1)
  }

  if (page <= 4) {
    return [...range(1, 6), null, pageCount]
  }

  if (page >= pageCount - 3) {
    return [1, null, ...range(pageCount - 4, pageCount + 1)]
  }

  return [1, null, page - 1, page, page + 1, null, pageCount]
}
