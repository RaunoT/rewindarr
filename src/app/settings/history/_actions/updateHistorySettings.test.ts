import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveHistorySettings from './updateHistorySettings'

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

function formDataFrom(fields: Record<string, string> = {}): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
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

describe('saveHistorySettings', () => {
  const initialState = { message: '', status: '', fields: {} }

  it('denies non-admins after setup and rejects locked saves', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '2', isAdmin: false },
      expires: '',
    })

    const nonAdmin = await saveHistorySettings(initialState, formDataFrom())

    expect(nonAdmin).toMatchObject({ status: 'error', message: 'genericError' })

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', isAdmin: true },
      expires: '',
    })
    settings.connection.complete = false

    const locked = await saveHistorySettings(initialState, formDataFrom())

    expect(locked).toMatchObject({ status: 'error', message: 'genericError' })
    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('leaves nested visibility flags unchanged when disabled', async () => {
    settings.history.isAdminOnly = true
    settings.history.isOwnOnly = true

    const result = await saveHistorySettings(initialState, formDataFrom())

    expect(result.status).toBe('success')
    expect(settings.history).toMatchObject({
      isActive: false,
      isAdminOnly: true,
      isOwnOnly: true,
      complete: true,
    })
  })

  it('saves active flags and updates own-only options', async () => {
    const result = await saveHistorySettings(
      initialState,
      formDataFrom({
        isActive: 'on',
        isOwnOnly: 'on',
        isOwnOnlyForAdmin: 'on',
      }),
    )

    expect(result.status).toBe('success')
    expect(settings.history).toEqual({
      isActive: true,
      isAdminOnly: false,
      isOwnOnly: true,
      isOwnOnlyForAdmin: true,
      complete: true,
    })
  })
})
