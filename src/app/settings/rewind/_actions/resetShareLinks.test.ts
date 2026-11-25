import { canManageSettings } from '@/lib/access'
import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import resetShareLinks from './resetShareLinks'

vi.mock('@/lib/access', () => ({ canManageSettings: vi.fn() }))
vi.mock('@/utils/getSettings', () => ({
  default: vi.fn(),
  writeSettings: vi.fn(),
}))

let settings: Settings

beforeEach(() => {
  vi.clearAllMocks()
  settings = cloneDeep(DEFAULT_SETTINGS)
  settings.connection.complete = true
  settings.rewind.shareVersion = 3
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(canManageSettings).mockResolvedValue(true)
})

describe('resetShareLinks', () => {
  it('returns false when unauthorized or rewind settings are locked', async () => {
    vi.mocked(canManageSettings).mockResolvedValueOnce(false)
    await expect(resetShareLinks()).resolves.toBe(false)

    settings.connection.complete = false
    await expect(resetShareLinks()).resolves.toBe(false)

    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('increments shareVersion and persists settings', async () => {
    await expect(resetShareLinks()).resolves.toBe(true)

    expect(settings.rewind.shareVersion).toBe(4)
    expect(writeSettings).toHaveBeenCalledWith(settings)
  })

  it('returns false when writing settings throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(writeSettings).mockImplementationOnce(() => {
      throw new Error('EIO')
    })

    await expect(resetShareLinks()).resolves.toBe(false)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
