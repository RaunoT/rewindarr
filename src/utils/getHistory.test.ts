import { HistoryEntry, HistoryRequest } from '@/types/history'
import { HistoryStatus } from '@/types/playHistory'
import { HistoryPlay, StatsSource } from '@/types/statsSource'
import { TautulliLibrary } from '@/types/tautulli'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getHistoryPage,
  getPageNumbers,
  getRecentPlays,
  groupByDay,
  HistoryPage,
  parsePage,
} from './getHistory'
import {
  addRequestDetails,
  getHistoryRequests,
  isSeerrActive,
} from './historyRequests'
import { getHistoryProgress, getStatsSource } from './statsSource'

vi.mock('./statsSource', () => ({
  getHistoryProgress: vi.fn(),
  getStatsSource: vi.fn(),
}))
vi.mock('./historyRequests', () => ({
  addRequestDetails: vi.fn(),
  getHistoryRequests: vi.fn(),
  isSeerrActive: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 10, 2, 12).getTime()

function play(
  id: string,
  startedAt: number,
  overrides: Partial<HistoryPlay> = {},
): HistoryPlay {
  return {
    id,
    startedAt,
    title: id,
    showTitle: null,
    artistName: null,
    durationMs: 1000,
    identityId: 'alice',
    userId: '1',
    userName: 'Alice',
    ...overrides,
  } as HistoryPlay
}

function playEntry(id: string, startedAt: number): HistoryEntry {
  return { kind: 'play', time: startedAt, play: play(id, startedAt) }
}

function request(
  id: number,
  createdAt: number,
  overrides: Partial<HistoryRequest> = {},
): HistoryRequest {
  return {
    id,
    createdAt,
    mediaType: 'movie',
    tmdbId: id,
    seasons: [],
    status: 'available',
    userId: '1',
    userName: 'Alice',
    avatar: '',
    title: '',
    year: null,
    poster: null,
    ...overrides,
  }
}

const status = { playCount: 10 } as HistoryStatus

describe('getRecentPlays', () => {
  // One play a day for the past 100 days
  const history = [...Array(100)].map((_, i) => play(`${i}`, NOW - i * DAY))
  const getHistoryPlays = vi.fn(async ({ since }: { since: string }) =>
    history.filter((play) => play.startedAt >= new Date(since).getTime()),
  )

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStatsSource).mockReturnValue({
      getHistoryPlays,
    } as unknown as StatsSource)
    vi.mocked(getHistoryProgress).mockResolvedValue(null)
  })

  it('looks no further back than the plays it needs', async () => {
    const { plays, hasMore } = await getRecentPlays(5, undefined, NOW)

    expect(plays.map((play) => play.id)).toEqual(['0', '1', '2', '3', '4'])
    expect(hasMore).toBe(true)
    expect(getHistoryPlays).toHaveBeenCalledTimes(1)
  })

  it('looks further back until it has enough plays', async () => {
    const { plays, hasMore } = await getRecentPlays(50, undefined, NOW)

    expect(plays).toHaveLength(50)
    expect(hasMore).toBe(true)
    // A week, four weeks, then 16 weeks
    expect(getHistoryPlays).toHaveBeenCalledTimes(3)
  })

  it('ends with the whole history', async () => {
    const { plays, hasMore } = await getRecentPlays(200, undefined, NOW)

    expect(plays).toHaveLength(100)
    expect(hasMore).toBe(false)
    expect(getHistoryPlays).toHaveBeenLastCalledWith({
      since: new Date(0).toISOString(),
      libraries: undefined,
    })
  })

  it('shows the plays read so far while the history is read further back', async () => {
    vi.mocked(getHistoryProgress)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(status)

    const { plays, hasMore, progress } = await getRecentPlays(
      50,
      undefined,
      NOW,
    )

    expect(plays).toHaveLength(8)
    expect(hasMore).toBe(false)
    expect(progress).toBe(status)
  })

  it('shows how far the read has got before any plays are read', async () => {
    vi.mocked(getHistoryProgress).mockResolvedValue(status)

    const { plays, progress } = await getRecentPlays(50, undefined, NOW)

    expect(plays).toEqual([])
    expect(progress).toBe(status)
    expect(getHistoryPlays).not.toHaveBeenCalled()
  })
})

describe('groupByDay', () => {
  it('groups the entries by their day', () => {
    const entries = [
      playEntry('tonight', new Date(2026, 10, 2, 20).getTime()),
      playEntry('this morning', new Date(2026, 10, 2, 1).getTime()),
      playEntry('last night', new Date(2026, 10, 1, 23, 59).getTime()),
      playEntry('last week', new Date(2026, 9, 26, 12).getTime()),
    ]

    expect(
      groupByDay(entries, NOW).map((day) => [
        day.daysAgo,
        day.entries.map((entry) => entry.kind === 'play' && entry.play.id),
      ]),
    ).toEqual([
      [0, ['tonight', 'this morning']],
      [1, ['last night']],
      [7, ['last week']],
    ])
  })
})

describe('getHistoryPage', () => {
  const SINCE = new Date(0).toISOString()
  // One play a day for the past 100 days, every tenth of them Dune
  const history = [...Array(100)].map((_, i) =>
    play(`${i}`, NOW - i * DAY, i % 10 ? {} : { showTitle: 'Dune: Prophecy' }),
  )
  const getHistoryPlays = vi.fn(async ({ since }: { since: string }) =>
    history.filter((play) => play.startedAt >= new Date(since).getTime()),
  )
  // A request each between the plays of the past three days, one by Bob
  const requests = [
    request(1, NOW - 0.5 * DAY, { tmdbId: 10, mediaType: 'movie' }),
    request(2, NOW - 1.5 * DAY, { tmdbId: 20, mediaType: 'tv', userId: '2' }),
    request(3, NOW - 2.5 * DAY, { tmdbId: 30, mediaType: 'movie' }),
  ]
  const movies = { section_type: 'movie' } as TautulliLibrary
  const music = { section_type: 'artist' } as TautulliLibrary

  function ids(page: HistoryPage) {
    return page.entries.map((entry) =>
      entry.kind === 'play' ? entry.play.id : `request ${entry.request.id}`,
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getStatsSource).mockReturnValue({
      getHistoryPlays,
    } as unknown as StatsSource)
    vi.mocked(getHistoryProgress).mockResolvedValue(null)
    vi.mocked(getHistoryRequests).mockResolvedValue(requests)
    vi.mocked(addRequestDetails).mockImplementation(async (items) =>
      items.map((item) => ({ ...item, title: `Title ${item.tmdbId}` })),
    )
    vi.mocked(isSeerrActive).mockReturnValue(true)
  })

  it('pages through the plays and requests of the period, newest first', async () => {
    const result = await getHistoryPage({ since: SINCE }, 1, 6, NOW)

    expect(ids(result)).toEqual([
      '0',
      'request 1',
      '1',
      'request 2',
      '2',
      'request 3',
    ])
    expect(result).toMatchObject({ page: 1, pageCount: 18 })
    expect(getHistoryPlays).toHaveBeenCalledWith({
      since: SINCE,
      libraries: undefined,
      userId: undefined,
    })
  })

  it("looks up the titles of the page's requests only", async () => {
    const result = await getHistoryPage({ since: SINCE }, 1, 2, NOW)

    expect(addRequestDetails).toHaveBeenCalledWith([requests[0]])
    expect(result.entries[1]).toMatchObject({
      kind: 'request',
      request: { title: 'Title 10' },
    })
  })

  it('adds up the whole period with the filters', async () => {
    const { totals } = await getHistoryPage(
      { since: new Date(NOW - 10 * DAY).toISOString() },
      1,
      5,
      NOW,
    )

    expect(totals).toEqual({
      // The 11 plays since, a second each
      watchTime: 11,
      plays: 11,
      requests: 3,
      users: 2,
    })
  })

  it('keeps to the pages there are', async () => {
    const result = await getHistoryPage(
      { since: SINCE, kind: 'play' },
      9,
      30,
      NOW,
    )

    expect(result.page).toBe(4)
    expect(result.entries).toHaveLength(10)
    expect(getHistoryRequests).not.toHaveBeenCalled()
  })

  it('shows only the requests when asked', async () => {
    const result = await getHistoryPage(
      { since: SINCE, kind: 'request' },
      1,
      25,
      NOW,
    )

    expect(ids(result)).toEqual(['request 1', 'request 2', 'request 3'])
    expect(getHistoryPlays).not.toHaveBeenCalled()
  })

  it("keeps the requests to the libraries' types and to the user", async () => {
    const forMovies = await getHistoryPage(
      { since: SINCE, kind: 'request', libraries: [movies] },
      1,
      25,
      NOW,
    )
    const forMusic = await getHistoryPage(
      { since: SINCE, kind: 'request', libraries: [music] },
      1,
      25,
      NOW,
    )
    const forBob = await getHistoryPage(
      { since: SINCE, kind: 'request', userIds: ['2'] },
      1,
      25,
      NOW,
    )

    expect(ids(forMovies)).toEqual(['request 1', 'request 3'])
    expect(ids(forMusic)).toEqual([])
    expect(ids(forBob)).toEqual(['request 2'])
  })

  it('finds plays by the show and requests by the title, whatever the case', async () => {
    const plays = await getHistoryPage(
      { since: SINCE, search: ' dune ' },
      1,
      25,
      NOW,
    )
    const found = await getHistoryPage(
      { since: SINCE, search: 'title 20' },
      1,
      25,
      NOW,
    )

    expect(plays.totals).toMatchObject({ plays: 10, requests: 0 })
    expect(ids(found)).toEqual(['request 2'])
  })

  it('asks the source for one user, and picks several from everyone', async () => {
    const one = await getHistoryPage(
      { since: SINCE, userIds: ['1'] },
      1,
      25,
      NOW,
    )

    expect(getHistoryPlays).toHaveBeenLastCalledWith({
      since: SINCE,
      libraries: undefined,
      userId: '1',
    })
    expect(one.totals).toMatchObject({ plays: 100, requests: 2 })

    const several = await getHistoryPage(
      { since: SINCE, userIds: ['2', '3'] },
      1,
      25,
      NOW,
    )

    expect(getHistoryPlays).toHaveBeenLastCalledWith({
      since: SINCE,
      libraries: undefined,
      userId: undefined,
    })
    // Only Bob's request, as the plays are all Alice's
    expect(ids(several)).toEqual(['request 2'])
  })

  it('has one empty page without anything', async () => {
    const result = await getHistoryPage(
      { since: SINCE, search: 'alien' },
      3,
      25,
      NOW,
    )

    expect(result).toMatchObject({ entries: [], page: 1, pageCount: 1 })
  })

  it('still shows the plays when Seerr fails', async () => {
    vi.mocked(getHistoryRequests).mockResolvedValue(null)

    const result = await getHistoryPage({ since: SINCE }, 1, 25, NOW)

    expect(result.hasRequestsFailed).toBe(true)
    expect(result.totals).toMatchObject({ plays: 100, requests: 0 })
  })

  it('pages through the plays read so far while the history is read', async () => {
    // The whole history isn't read, nor the past 16 weeks, but four weeks are
    vi.mocked(getHistoryProgress).mockImplementation(async (since) =>
      new Date(since).getTime() < NOW - 30 * DAY ? status : null,
    )

    const result = await getHistoryPage(
      { since: SINCE, kind: 'play' },
      1,
      25,
      NOW,
    )

    expect(result.totals.plays).toBe(29)
    expect(result.progress).toBe(status)
  })

  it('reads no further back than the period while the history is read', async () => {
    vi.mocked(getHistoryProgress).mockImplementation(async (since) =>
      new Date(since).getTime() < NOW - 30 * DAY ? status : null,
    )

    const result = await getHistoryPage(
      { since: new Date(NOW - 10 * DAY).toISOString(), kind: 'play' },
      1,
      25,
      NOW,
    )

    expect(result.totals.plays).toBe(11)
  })
})

describe('parsePage', () => {
  it('reads the page, or starts on the first', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage()).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('1.5')).toBe(1)
    expect(parsePage('abc')).toBe(1)
  })
})

describe('getPageNumbers', () => {
  it('links every page when there are few', () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('leaves out the pages far from the current one', () => {
    expect(getPageNumbers(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
  })

  it('shows a single page instead of a gap', () => {
    expect(getPageNumbers(4, 20)).toEqual([1, 2, 3, 4, 5, null, 20])
    expect(getPageNumbers(17, 20)).toEqual([1, null, 16, 17, 18, 19, 20])
  })

  it('has one page without plays', () => {
    expect(getPageNumbers(1, 1)).toEqual([1])
  })
})
