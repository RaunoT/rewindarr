import { Play } from '@/types/playHistory'
import { orderBy } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryReader } from './playHistory'
import type { PlaysSnapshot } from './playHistoryFile'

vi.mock('./playHistoryFile', () => ({
  getHistoryFilePath: () => '/app/config/play-history.json.gz',
  readHistoryFile: vi.fn(async () => new Map()),
  writeHistoryFile: vi.fn(async () => undefined),
}))

const now = Date.parse('2026-10-28T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const TRACEARR_KEY = 'tracearr|http://tracearr:3000|'
const TAUTULLI_PREFIX = 'tautulli|http://tautulli:8181|'

function play(id: string, hoursAgo: number, overrides: Partial<Play> = {}) {
  return {
    id,
    startedAt: now - hoursAgo * HOUR,
    mediaType: 'movie',
    durationMs: 60_000,
    percentComplete: null,
    title: id,
    showTitle: null,
    artistName: null,
    year: null,
    thumb: '',
    ratingKey: null,
    grandparentRatingKey: null,
    mediaId: null,
    showMediaId: null,
    imdbId: null,
    tmdbId: null,
    identityId: 'alice',
    avatar: '',
    seasonNumber: null,
    episodeNumber: null,
    transcodeDecision: null,
    lengthMs: null,
    ...overrides,
  } satisfies Play
}

function orderedAt(play: Play) {
  return play.orderedAt ?? play.startedAt
}

// Like Tautulli, pages of plays newest first by offset
function reader(key: string, getPlays: () => Play[], pageSize = 2) {
  const cursors: (string | undefined)[] = []
  const historyReader: HistoryReader = {
    key,
    readPage: async (cursor) => {
      cursors.push(cursor)

      const plays = orderBy(getPlays(), orderedAt, 'desc')
      const start = Number(cursor ?? 0)
      const page = plays.slice(start, start + pageSize)
      const end = start + page.length

      return {
        plays: page,
        oldest: Math.min(...page.map(orderedAt)),
        cursor: end < plays.length ? String(end) : undefined,
      }
    },
    getFirstPlayAt: async () => null,
  }

  return { reader: historyReader, cursors }
}

function snapshot(plays: Play[]): PlaysSnapshot {
  return {
    plays,
    readTo: -Infinity,
    toppedUpAt: now,
    rebuildAt: now + 7 * 24 * HOUR,
  }
}

async function load() {
  return {
    ...(await import('./playHistory')),
    ...(await import('./playHistoryFile')),
  }
}

beforeEach(async () => {
  delete (globalThis as { rewindarrPlayHistory?: unknown }).rewindarrPlayHistory
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(now)

  // The mocked file outlives resetModules, so a saved history would leak
  const { readHistoryFile, writeHistoryFile } =
    await import('./playHistoryFile')

  vi.mocked(readHistoryFile).mockReset().mockResolvedValue(new Map())
  vi.mocked(writeHistoryFile).mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('playHistory', () => {
  it('keeps another source’s history when the source changes', async () => {
    const plays = [play('a', 1), play('b', 2), play('c', 3)]
    const tracearr = reader(TRACEARR_KEY, () => plays)
    const tautulli = reader(`${TAUTULLI_PREFIX}1`, () => [play('t', 1)])
    const { dropStaleHistories, readPlays } = await load()

    await readPlays([tracearr.reader], 0)
    await dropStaleHistories(TAUTULLI_PREFIX)
    await readPlays([tautulli.reader], 0)
    await dropStaleHistories(TRACEARR_KEY)

    // Switched back, Tracearr's plays are still read
    await expect(readPlays([tracearr.reader], 0)).resolves.toHaveLength(3)
    expect(tracearr.cursors).toEqual([undefined, '2'])
  })

  it('reads the history again when the source’s URL changes', async () => {
    const plays = [play('a', 1)]
    const old = reader('tracearr|http://old:3000|', () => plays)
    const { dropStaleHistories, readPlays } = await load()

    await readPlays([old.reader], 0)
    await dropStaleHistories(TRACEARR_KEY)
    await readPlays([old.reader], 0)

    expect(old.cursors).toEqual([undefined, undefined])
  })

  it('forgets only the histories left out of the keys given', async () => {
    const chosen = reader(`${TRACEARR_KEY}s1`, () => [play('a', 1)])
    const other = reader(`${TRACEARR_KEY}s2`, () => [play('b', 1)])
    const tautulli = reader(`${TAUTULLI_PREFIX}1`, () => [play('t', 1)])
    const { dropStaleHistories, readPlays } = await load()

    await readPlays([chosen.reader, other.reader, tautulli.reader], 0)
    await dropStaleHistories([`${TRACEARR_KEY}s1`])
    await readPlays([chosen.reader, other.reader, tautulli.reader], 0)

    expect(chosen.cursors).toEqual([undefined])
    expect(other.cursors).toEqual([undefined, undefined])
    expect(tautulli.cursors).toEqual([undefined])
  })

  it('keeps the plays of each history apart when asked to', async () => {
    const chosen = reader(`${TRACEARR_KEY}s1`, () => [play('a', 1)])
    const other = reader(`${TRACEARR_KEY}s2`, () => [play('b', 1)])
    const { readHistories } = await load()
    const [chosenPlays, otherPlays] = await readHistories(
      [chosen.reader, other.reader],
      0,
    )

    expect(chosenPlays.map((play) => play.id)).toEqual(['a'])
    expect(otherPlays.map((play) => play.id)).toEqual(['b'])
  })

  it('saves the histories nothing has read since the start with the rest', async () => {
    const tautulliKey = `${TAUTULLI_PREFIX}1`
    const { readHistoryFile, readPlays, writeHistoryFile } = await load()

    vi.mocked(readHistoryFile).mockResolvedValue(
      new Map([[tautulliKey, snapshot([play('t', 5)])]]),
    )

    await readPlays([reader(TRACEARR_KEY, () => [play('a', 1)]).reader], 0)
    await vi.advanceTimersByTimeAsync(60 * 1000)

    expect(writeHistoryFile).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(writeHistoryFile).mock.calls[0][0].map(([key]) => key),
    ).toEqual([TRACEARR_KEY, tautulliKey])
  })

  it('leaves out the plays a page repeats when new ones come in', async () => {
    const plays = [play('a', 1), play('b', 2), play('c', 3), play('d', 4)]
    const tautulli = reader(`${TAUTULLI_PREFIX}1`, () => plays)
    const readPage = tautulli.reader.readPage

    // A new play pushes the first page's last play onto the next page
    tautulli.reader.readPage = async (cursor) => {
      const page = await readPage(cursor)

      if (!cursor) {
        plays.push(play('new', 0.5))
      }

      return page
    }

    const { readPlays } = await load()
    const read = await readPlays([tautulli.reader], 0)

    expect(read.map((play) => play.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps one copy of a resumed play that moved up the history', async () => {
    const plays = [play('a', 1), play('b', 2), play('c', 3)]
    const tautulli = reader(`${TAUTULLI_PREFIX}1`, () => plays)
    const { readPlays } = await load()

    await readPlays([tautulli.reader], 0)

    // Resumed, the play is ordered by its last session
    plays[2] = play('c', 3, { orderedAt: now, durationMs: 120_000 })
    vi.setSystemTime(now + 10 * 60 * 1000)

    const read = await readPlays([tautulli.reader], 0)

    expect(read.map((play) => play.id).sort()).toEqual(['a', 'b', 'c'])
    expect(read.find((play) => play.id === 'c')?.durationMs).toBe(120_000)
  })

  it('adds up the plays of every history in the status', async () => {
    const { getReadStatus, readPlays } = await load()
    const movies = reader(`${TAUTULLI_PREFIX}1`, () => [
      play('a', 1),
      play('b', 30),
    ])
    const shows = reader(`${TAUTULLI_PREFIX}2`, () => [play('c', 10)])

    await readPlays([movies.reader, shows.reader], 0)

    await expect(
      getReadStatus([movies.reader, shows.reader]),
    ).resolves.toMatchObject({
      playCount: 3,
      oldestPlayAt: now - 30 * HOUR,
      progress: 1,
      isComplete: true,
      isReading: false,
    })
  })

  it('says how far back every history has its plays', async () => {
    const { getReadFrom, readHistoryFile } = await load()
    const movies = reader(`${TAUTULLI_PREFIX}1`, () => [])
    const shows = reader(`${TAUTULLI_PREFIX}2`, () => [])

    vi.mocked(readHistoryFile).mockResolvedValue(
      new Map([
        [movies.reader.key, snapshot([play('a', 1)])],
        [shows.reader.key, { ...snapshot([]), readTo: now - 5 * HOUR }],
      ]),
    )

    await expect(getReadFrom([movies.reader])).resolves.toBe(-Infinity)
    await expect(getReadFrom([movies.reader, shows.reader])).resolves.toBe(
      now - 5 * HOUR,
    )
    // Without waiting for a read
    expect(shows.cursors).toEqual([])
  })

  it('has nothing read back before any history was read', async () => {
    const { getReadFrom } = await load()
    const movies = reader(`${TAUTULLI_PREFIX}1`, () => [play('a', 1)])

    await expect(getReadFrom([movies.reader])).resolves.toBe(Infinity)
  })

  it('says when the least recent history was last brought up to date', async () => {
    const { getUpdatedAt, readHistoryFile } = await load()
    const movies = reader(`${TAUTULLI_PREFIX}1`, () => [])
    const shows = reader(`${TAUTULLI_PREFIX}2`, () => [])
    const music = reader(`${TAUTULLI_PREFIX}3`, () => [])

    vi.mocked(readHistoryFile).mockResolvedValue(
      new Map([
        [movies.reader.key, { ...snapshot([]), toppedUpAt: now - 2 * HOUR }],
        [shows.reader.key, { ...snapshot([]), toppedUpAt: now - 5 * HOUR }],
      ]),
    )

    // The music history was never read, so it's left out
    await expect(
      getUpdatedAt([movies.reader, shows.reader, music.reader]),
    ).resolves.toBe(now - 5 * HOUR)
    expect(movies.cursors).toEqual([])
  })

  it('has no time before any history was read', async () => {
    const { getUpdatedAt } = await load()
    const movies = reader(`${TAUTULLI_PREFIX}1`, () => [play('a', 1)])

    await expect(getUpdatedAt([movies.reader])).resolves.toBeNull()
  })

  it('purges stale histories from disk even before any history is read', async () => {
    const staleKey = 'tracearr|http://old:3000|'
    const keptKey = `${TAUTULLI_PREFIX}1`
    const { dropStaleHistories, readHistoryFile, writeHistoryFile } =
      await load()

    vi.mocked(readHistoryFile).mockResolvedValue(
      new Map([
        [staleKey, snapshot([play('a', 1)])],
        [keptKey, snapshot([play('t', 1)])],
      ]),
    )

    await dropStaleHistories(TRACEARR_KEY)

    expect(writeHistoryFile).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(writeHistoryFile).mock.calls[0][0].map(([key]) => key),
    ).toEqual([keptKey])
  })

  it('does not resurrect a store dropped while its saved snapshot is loading', async () => {
    let resolveFile!: (value: Map<string, PlaysSnapshot>) => void

    const old = reader('tracearr|http://old:3000|', () => [play('a', 1)])
    const { dropStaleHistories, getStoredPlays, readHistoryFile, readPlays } =
      await load()

    vi.mocked(readHistoryFile).mockReturnValue(
      new Promise((resolve) => {
        resolveFile = resolve
      }),
    )

    const readPromise = readPlays([old.reader], 0)
    const dropPromise = dropStaleHistories(TRACEARR_KEY)

    resolveFile(new Map([[old.reader.key, snapshot([play('a', 1)])]]))
    await Promise.all([readPromise, dropPromise])

    expect(getStoredPlays([old.reader.key])).toEqual([])
    expect(old.cursors).toEqual([])
  })

  it('keeps current histories in the saved file when dropStaleHistories saves while they are loading', async () => {
    let resolveFile!: (value: Map<string, PlaysSnapshot>) => void

    const staleKey = 'tracearr|http://old:3000|'
    const currentReader = reader(`${TRACEARR_KEY}s1`, () => [play('b', 1)])
    const { dropStaleHistories, readHistoryFile, readPlays, writeHistoryFile } =
      await load()

    vi.mocked(readHistoryFile).mockReturnValue(
      new Promise((resolve) => {
        resolveFile = resolve
      }),
    )

    const readPromise = readPlays([currentReader.reader], 0)
    const dropPromise = dropStaleHistories(`${TRACEARR_KEY}s1`)

    resolveFile(
      new Map([
        [staleKey, snapshot([play('old', 2)])],
        [currentReader.reader.key, snapshot([play('b', 1)])],
      ]),
    )
    await Promise.all([readPromise, dropPromise])

    expect(writeHistoryFile).toHaveBeenCalledTimes(1)
    expect(
      vi.mocked(writeHistoryFile).mock.calls[0][0].map(([key]) => key),
    ).toEqual([currentReader.reader.key])
  })

  it('retries a failed rebuild page without losing already-read pages, and backs off after repeated failures', async () => {
    const allPlays = [play('a', 1), play('b', 2), play('c', 3), play('d', 4)]
    const base = reader(`${TAUTULLI_PREFIX}1`, () => allPlays)
    const baseReadPage = base.reader.readPage

    let failSecondPage = true

    const { readAgain, readPlays } = await load()

    await readPlays([base.reader], 0)
    allPlays.push(play('e', 5))

    base.cursors.length = 0
    base.reader.readPage = async (cursor) => {
      if (cursor === '2' && failSecondPage) {
        failSecondPage = false
        base.cursors.push(cursor)

        return null
      }

      return baseReadPage(cursor)
    }

    await readAgain([base.reader])
    // Let the first page read and the second page fail
    await vi.advanceTimersByTimeAsync(1000)
    expect(base.cursors).toEqual([undefined, '2'])

    // After RETRY_DELAY, the rebuild resumes from cursor '2' without re-reading page 1
    await vi.advanceTimersByTimeAsync(60 * 1000)
    await expect(readPlays([base.reader], 0)).resolves.toHaveLength(5)
    expect(base.cursors).toEqual([undefined, '2', '2', '4'])

    // Always-failing page stops after MAX_REBUILD_RETRIES and postpones rebuild
    base.cursors.length = 0
    base.reader.readPage = async (cursor) => {
      base.cursors.push(cursor)

      return null
    }

    await readAgain([base.reader])
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000)
    // Initial attempt + 3 retries = 4 attempts
    expect(base.cursors).toEqual([undefined, undefined, undefined, undefined])
  })
})
