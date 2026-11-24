import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveRewindSettings from './updateRewindSettings'

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
    autoplaySpeed: 'normal',
    period: 'calendarYear',
    releaseDate: '2026-12-01',
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

describe('saveRewindSettings', () => {
  const initialState = { message: '', status: '', fields: {} }

  it('requires a valid ISO calendar start date when period is custom', async () => {
    for (const startDate of ['', '2025-02-31', 'March 1, 2026']) {
      const result = await saveRewindSettings(
        initialState,
        formDataFrom({ period: 'custom', startDate }),
      )

      expect(result).toMatchObject({
        status: 'error',
        message: 'startDateError',
      })
    }

    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('saves valid custom start dates', async () => {
    const result = await saveRewindSettings(
      initialState,
      formDataFrom({ period: 'custom', startDate: '2025-06-01' }),
    )

    expect(result.status).toBe('success')
    expect(writeSettings).toHaveBeenCalledTimes(1)
  })
})
