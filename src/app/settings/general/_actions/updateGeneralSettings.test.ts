import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveGeneralSettings from './updateGeneralSettings'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))
vi.mock('@/utils/getSettings', () => ({
  default: vi.fn(),
  writeSettings: vi.fn(),
}))

function formDataFrom(
  fields: Record<string, string | string[]> = {},
): FormData {
  const formData = new FormData()
  const merged = {
    serverName: 'Home Server',
    minPlayPercent: '50',
    googleAnalyticsId: '',
    activeLibraries: ['movies'],
    excludedUsers: [],
    activeExternalLinks: ['seerr'],
    activeItemStatistics: ['year', 'plays'],
    ...fields,
  }

  for (const [key, value] of Object.entries(merged)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        formData.append(key, item)
      }
    } else {
      formData.set(key, value)
    }
  }

  return formData
}

let settings: Settings

beforeEach(() => {
  vi.clearAllMocks()
  settings = cloneDeep(DEFAULT_SETTINGS)
  settings.connection.complete = true
  settings.setupComplete = true
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: '1', isAdmin: true },
    expires: '',
  })
})

describe('saveGeneralSettings', () => {
  const initialState = {
    message: '',
    status: '',
    fields: cloneDeep(DEFAULT_SETTINGS.general),
  }

  it('denies non-admins after initial setup', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '2', isAdmin: false },
      expires: '',
    })

    const result = await saveGeneralSettings(initialState, formDataFrom())

    expect(result).toMatchObject({ status: 'error', message: 'genericError' })
    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('rejects saves before connection settings are complete', async () => {
    settings.connection.complete = false

    const result = await saveGeneralSettings(initialState, formDataFrom())

    expect(result).toMatchObject({ status: 'error', message: 'genericError' })
    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('validates minPlayPercent as an integer between 0 and 100', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    for (const minPlayPercent of ['-1', '101', '50.5', '']) {
      const result = await saveGeneralSettings(
        initialState,
        formDataFrom({ minPlayPercent }),
      )

      expect(result).toMatchObject({
        status: 'error',
        message: 'minPlayPercentError',
      })
    }

    expect(writeSettings).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('validates Google Analytics IDs and link/statistic enums', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    for (const googleAnalyticsId of ['UA-12345-1', 'AW-12345']) {
      const result = await saveGeneralSettings(
        initialState,
        formDataFrom({ googleAnalyticsId }),
      )

      expect(result.status).toBe('error')
    }

    const badStats = await saveGeneralSettings(
      initialState,
      formDataFrom({ activeItemStatistics: ['notAStat'] }),
    )

    expect(badStats.status).toBe('error')
    expect(writeSettings).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('saves valid general settings including GA4/GT tags, exclusions, and flags', async () => {
    const result = await saveGeneralSettings(
      initialState,
      formDataFrom({
        serverName: 'Cinema',
        activeLibraries: ['movies', 'tv-shows'],
        excludedUsers: ['42'],
        isPostersTmdbOnly: 'on',
        isOutsideAccess: 'on',
        isAnonymized: 'on',
        minPlayPercent: '0',
        googleAnalyticsId: ' GT-ABC123 ',
      }),
    )

    expect(result.status).toBe('success')
    expect(writeSettings).toHaveBeenCalledTimes(1)
    expect(settings.general).toMatchObject({
      serverName: 'Cinema',
      activeLibraries: ['movies', 'tv-shows'],
      excludedUsers: ['42'],
      isPostersTmdbOnly: true,
      isOutsideAccess: true,
      isAnonymized: true,
      minPlayPercent: 0,
      googleAnalyticsId: 'GT-ABC123',
      complete: true,
    })
  })
})
