import { canManageSettings } from '@/lib/access'
import { HistoryStatus } from '@/types/playHistory'
import { StatisticsSource } from '@/types/settings'
import {
  getHistoryStatus as getStatus,
  readHistoryAgain as readAgain,
} from '@/utils/statsSource'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHistoryStatus, readHistoryAgain } from './playHistory'

vi.mock('@/lib/access', () => ({ canManageSettings: vi.fn() }))
vi.mock('@/utils/statsSource', () => ({
  getHistoryStatus: vi.fn(),
  readHistoryAgain: vi.fn(),
}))

const sampleStatus: HistoryStatus = {
  playCount: 100,
  oldestPlayAt: 1_700_000_000_000,
  progress: 1,
  isComplete: true,
  isReading: false,
  hasFailed: false,
  reread: null,
  hasSaveFailed: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canManageSettings).mockResolvedValue(true)
  vi.mocked(getStatus).mockResolvedValue(sampleStatus)
  vi.mocked(readAgain).mockResolvedValue()
})

describe('playHistory actions', () => {
  it('returns null when unauthorized or given an unknown source', async () => {
    vi.mocked(canManageSettings).mockResolvedValue(false)

    await expect(getHistoryStatus('tautulli')).resolves.toBeNull()
    await expect(readHistoryAgain('tracearr')).resolves.toBeNull()

    vi.mocked(canManageSettings).mockResolvedValue(true)

    await expect(
      getHistoryStatus('plex' as StatisticsSource),
    ).resolves.toBeNull()
    await expect(
      readHistoryAgain('plex' as StatisticsSource),
    ).resolves.toBeNull()
    expect(getStatus).not.toHaveBeenCalled()
    expect(readAgain).not.toHaveBeenCalled()
  })

  it('delegates to statsSource helpers when authorized', async () => {
    await expect(getHistoryStatus('tautulli')).resolves.toEqual(sampleStatus)
    expect(getStatus).toHaveBeenCalledWith('tautulli')

    await expect(readHistoryAgain('tracearr')).resolves.toEqual(sampleStatus)
    expect(readAgain).toHaveBeenCalledWith('tracearr')
    expect(getStatus).toHaveBeenCalledWith('tracearr')
  })
})
