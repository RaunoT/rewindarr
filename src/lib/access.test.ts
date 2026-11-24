import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { denySettingsAccess, requireSettingsAccess } from './access'

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('./auth', () => ({ authOptions: {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/utils/getSettings', () => ({ default: vi.fn() }))

let settings: Settings

beforeEach(() => {
  vi.clearAllMocks()
  settings = cloneDeep(DEFAULT_SETTINGS)
  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(getServerSession).mockResolvedValue(null)
})

describe('requireSettingsAccess', () => {
  it('allows initial setup only for connection until it is complete', async () => {
    await expect(requireSettingsAccess('connection')).resolves.toBeUndefined()
    await expect(requireSettingsAccess('general')).rejects.toThrow(
      'NEXT_REDIRECT:/settings/connection',
    )

    settings.connection.complete = true
    await expect(requireSettingsAccess('general')).resolves.toBeUndefined()
  })

  it('redirects non-admins after initial setup and sends admins to connection when locked', async () => {
    settings.setupComplete = true
    await expect(requireSettingsAccess('general')).rejects.toThrow(
      'NEXT_REDIRECT:/',
    )

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', isAdmin: false },
      expires: '',
    })
    await expect(requireSettingsAccess('general')).rejects.toThrow(
      'NEXT_REDIRECT:/',
    )

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', isAdmin: true },
      expires: '',
    })
    await expect(requireSettingsAccess('general')).rejects.toThrow(
      'NEXT_REDIRECT:/settings/connection',
    )
    await expect(requireSettingsAccess('connection')).resolves.toBeUndefined()

    settings.connection.complete = true
    await expect(requireSettingsAccess('general')).resolves.toBeUndefined()
  })
})

describe('denySettingsAccess', () => {
  const initialState = { message: '', status: '', fields: { test: true } }

  it('denies non-admins after setup and locked pages even for admins', async () => {
    settings.setupComplete = true
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', isAdmin: false },
      expires: '',
    })
    await expect(denySettingsAccess(initialState, 'general')).resolves.toEqual({
      message: 'genericError',
      status: 'error',
      fields: initialState.fields,
    })

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: '1', isAdmin: true },
      expires: '',
    })
    await expect(denySettingsAccess(initialState, 'general')).resolves.toEqual({
      message: 'genericError',
      status: 'error',
      fields: initialState.fields,
    })
    await expect(
      denySettingsAccess(initialState, 'connection'),
    ).resolves.toBeNull()

    settings.connection.complete = true
    await expect(
      denySettingsAccess(initialState, 'general'),
    ).resolves.toBeNull()
  })
})
