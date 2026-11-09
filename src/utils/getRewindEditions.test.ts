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

const now = new Date('2026-03-10T12:00:00Z')

function play(userId: string, year: number): HistoryPlay {
  return { userId, startedAt: Date.UTC(year, 5, 1) } as HistoryPlay
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
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.rewind.period = 'calendarYear'
  getHistoryPlays.mockClear()
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(getLibraries).mockResolvedValue([])
  vi.mocked(getHistoryReadFrom).mockResolvedValue(-Infinity)
  vi.mocked(getStatsSource).mockReturnValue({
    getHistoryPlays,
  } as unknown as ReturnType<typeof getStatsSource>)
})

describe('getRewindEditions', () => {
  it("lists only the user's own years", async () => {
    await expect(getRewindEditions('1', false, 'UTC', now)).resolves.toEqual({
      1: [2024, 2022],
    })
    expect(getHistoryPlays).toHaveBeenCalledTimes(1)
  })

  it("lists everyone's years for an admin, excluded or not", async () => {
    await expect(getRewindEditions('2', true, 'UTC', now)).resolves.toEqual({
      1: [2024, 2022],
      2: [2021],
      3: [2023],
    })
  })

  it('asks for the plays up to the latest edition', async () => {
    vi.mocked(getHistoryReadFrom).mockResolvedValue(
      Date.parse('2022-05-01T00:00Z'),
    )

    await getRewindEditions('1', false, 'UTC', now)

    expect(getHistoryPlays).toHaveBeenCalledWith({
      since: '2023-01-01T00:00:00.000Z',
      until: '2025-01-01T00:00:00.000Z',
      libraries: [],
      userId: '1',
    })
  })

  it('has no past editions before the history is read back to one', async () => {
    vi.mocked(getHistoryReadFrom).mockResolvedValue(
      Date.parse('2024-05-01T00:00Z'),
    )

    await expect(getRewindEditions('1', true, 'UTC', now)).resolves.toEqual({})
    expect(getHistoryPlays).not.toHaveBeenCalled()
  })

  it('has no past editions before any play is read', async () => {
    vi.mocked(getHistoryReadFrom).mockResolvedValue(Infinity)

    await expect(getRewindEditions('1', true, 'UTC', now)).resolves.toEqual({})
  })
})
