import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/utils/getSettings', () => ({ default: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/missing-setting', () => {
  it('returns the first missing required setting key', async () => {
    vi.mocked(getSettings).mockReturnValue(cloneDeep(DEFAULT_SETTINGS))

    const res = await GET()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toBe('connection.tautulliUrl')
  })

  it('returns null once every required setting is populated', async () => {
    const settings = cloneDeep(DEFAULT_SETTINGS)

    settings.connection.tautulliUrl = 'http://tautulli:8181'
    settings.connection.tautulliApiKey = 'secret'
    settings.connection.complete = true
    settings.general.complete = true
    settings.rewind.complete = true
    settings.dashboard.complete = true
    settings.activity.complete = true
    settings.history.complete = true
    vi.mocked(getSettings).mockReturnValue(settings)

    const res = await GET()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toBeNull()
  })
})
