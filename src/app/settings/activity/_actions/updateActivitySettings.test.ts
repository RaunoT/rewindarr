import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveActivitySettings from './updateActivitySettings'

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

describe('saveActivitySettings', () => {
  const initialState = { message: '', status: '', fields: {} }

  it('denies non-admins after setup and rejects locked saves', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '2', isAdmin: false },
      expires: '',
    })

    const nonAdmin = await saveActivitySettings(initialState, formDataFrom())

    expect(nonAdmin).toMatchObject({ status: 'error', message: 'genericError' })

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', isAdmin: true },
      expires: '',
    })
    settings.connection.complete = false

    const locked = await saveActivitySettings(initialState, formDataFrom())

    expect(locked).toMatchObject({ status: 'error', message: 'genericError' })
    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('leaves admin/own-only flags untouched when disabled', async () => {
    settings.activity.isAdminOnly = true
    settings.activity.isOwnOnly = true
    settings.activity.isOwnOnlyForAdmin = true

    const result = await saveActivitySettings(
      initialState,
      formDataFrom({ isAdminOnly: 'on', isOwnOnly: 'on' }),
    )

    expect(result.status).toBe('success')
    expect(settings.activity).toEqual({
      isActive: false,
      isAdminOnly: true,
      isOwnOnly: true,
      isOwnOnlyForAdmin: true,
      complete: true,
    })
  })

  it('saves active flags and updates isOwnOnlyForAdmin only when isOwnOnly is enabled', async () => {
    const result = await saveActivitySettings(
      initialState,
      formDataFrom({
        isActive: 'on',
        isAdminOnly: 'on',
        isOwnOnly: 'on',
        isOwnOnlyForAdmin: 'on',
      }),
    )

    expect(result.status).toBe('success')
    expect(settings.activity).toEqual({
      isActive: true,
      isAdminOnly: true,
      isOwnOnly: true,
      isOwnOnlyForAdmin: true,
      complete: true,
    })
  })
})
