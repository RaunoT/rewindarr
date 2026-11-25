import getVersion from '@/utils/getVersion'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/utils/getVersion', () => ({ default: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/status', () => {
  it('maps version info to the status payload', async () => {
    vi.mocked(getVersion).mockResolvedValue({
      currentVersion: '5.5.0',
      latestVersion: '5.6.0',
      channel: 'stable',
      hasUpdate: true,
    })

    const res = await GET()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      version: '5.5.0',
      channel: 'stable',
      updateAvailable: true,
    })
  })
})
