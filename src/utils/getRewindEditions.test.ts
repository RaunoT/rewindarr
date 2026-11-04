import { DurationQuery, HistoryPlay } from '@/types/statsSource'
import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import getRewindEditions from './getRewindEditions'
import getSettings from './getSettings'
import { getHistoryReadFrom, getLibraries, getStatsSource } from './statsSource'

vi.mock('./getSettings', () => ({ default: vi.fn() }))
vi.mock('./statsSource', () => ({
  getHistoryReadFrom: vi.fn(),
  getLibraries: vi.fn(),
  getStatsSource: vi.fn(),
}))

// Years are in the server's timezone, which the tests run in too
const now = new Date(2026, 2, 10)

function play(userId: string, year: number): HistoryPlay {
  return { userId, startedAt: new Date(year, 5, 1).getTime() } as HistoryPlay
}

// Bob is excluded, so only his own query has his plays
const plays = [play('1', 2024), play('1', 2022), play('3', 2023)]
const bobPlays = [play('2', 2021)]
const getHistoryPlays = vi.fn(async ({ userId }: DurationQuery) =>
  userId === '2'
    ? bobPlays
    : plays.filter((play) => !userId || play.userId === userId),
)

beforeEach(() => {
  getHistoryPlays.mockClear()
  vi.mocked(getSettings).mockReturnValue(cloneDeep(DEFAULT_SETTINGS))
  vi.mocked(getLibraries).mockResolvedValue([])
  vi.mocked(getHistoryReadFrom).mockResolvedValue(-Infinity)
  vi.mocked(getStatsSource).mockReturnValue({
    getHistoryPlays,
  } as unknown as ReturnType<typeof getStatsSource>)
})

describe('getRewindEditions', () => {
  it("lists only the user's own years", async () => {
    await expect(getRewindEditions('1', false, now)).resolves.toEqual({
      1: [2024, 2022],
    })
    expect(getHistoryPlays).toHaveBeenCalledTimes(1)
  })

  it("lists everyone's years for an admin, excluded or not", async () => {
    await expect(getRewindEditions('2', true, now)).resolves.toEqual({
      1: [2024, 2022],
      2: [2021],
      3: [2023],
    })
  })

  it('asks for the plays up to the latest edition', async () => {
    vi.mocked(getHistoryReadFrom).mockResolvedValue(
      new Date(2022, 4, 1).getTime(),
    )

    await getRewindEditions('1', false, now)

    expect(getHistoryPlays).toHaveBeenCalledWith({
      since: new Date(2023, 0, 1).toISOString(),
      until: new Date(2025, 0, 1).toISOString(),
      libraries: [],
      userId: '1',
    })
  })

  it('has no past editions before the history is read back to one', async () => {
    vi.mocked(getHistoryReadFrom).mockResolvedValue(
      new Date(2024, 4, 1).getTime(),
    )

    await expect(getRewindEditions('1', true, now)).resolves.toEqual({})
    expect(getHistoryPlays).not.toHaveBeenCalled()
  })

  it('has no past editions before any play is read', async () => {
    vi.mocked(getHistoryReadFrom).mockResolvedValue(Infinity)

    await expect(getRewindEditions('1', true, now)).resolves.toEqual({})
  })
})
