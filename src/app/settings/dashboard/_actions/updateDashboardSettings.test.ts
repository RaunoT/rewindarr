import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveDashboardSettings from './updateDashboardSettings'

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

function formDataFrom(fields: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries({
    isActive: 'on',
    customPeriod: '30',
    startDate: '',
    ...fields,
  })) {
    formData.set(key, value)
  }

  return formData
}

let settings: Settings

beforeEach(() => {
  vi.clearAllMocks()
  settings = cloneDeep(DEFAULT_SETTINGS)
  settings.connection.complete = true
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: '1', isAdmin: true },
    expires: '',
  })
})

describe('saveDashboardSettings', () => {
  const initialState = { message: '', status: '', fields: {} }

  it('rejects saves before connection settings are complete', async () => {
    settings.connection.complete = false

    const result = await saveDashboardSettings(initialState, formDataFrom({}))

    expect(result).toMatchObject({ status: 'error', message: 'genericError' })
    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('rejects impossible or non-ISO start dates', async () => {
    for (const startDate of [
      '2024-02-31',
      'March 1, 2026',
      '2026-03-01T00:00Z',
    ]) {
      const result = await saveDashboardSettings(
        initialState,
        formDataFrom({ startDate }),
      )

      expect(result).toMatchObject({
        status: 'error',
        message: 'startDateError',
      })
    }

    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('accepts valid ISO calendar dates', async () => {
    const result = await saveDashboardSettings(
      initialState,
      formDataFrom({ startDate: '2024-02-29' }),
    )

    expect(result.status).toBe('success')
    expect(writeSettings).toHaveBeenCalledTimes(1)
  })
})
