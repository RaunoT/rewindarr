import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings, { writeSettings } from '@/utils/getSettings'
import { cloneDeep } from 'lodash'
import { getServerSession } from 'next-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveConnectionSettings from './updateConnectionSettings'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    async () => (key: string, values?: Record<string, string>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  ),
}))
vi.mock('@/utils/getSettings', () => ({
  default: vi.fn(),
  writeSettings: vi.fn(),
}))
vi.mock('@/utils/statsSource', () => ({
  getReachableLibraries: vi.fn(async () => null),
  startHistoryRead: vi.fn(),
}))
vi.mock('@/utils/connectionTests', () => ({
  testTautulli: vi.fn(async () => null),
  testTracearr: vi.fn(),
  testSeerr: vi.fn(async (url: string, apiKey: string) => {
    if (!url) {
      return { key: 'enterUrl' }
    }

    return apiKey ? null : { key: 'enterApiKey' }
  }),
  testMediaServerUrl: vi.fn(async () => null),
  testPlexToken: vi.fn(async () => null),
}))

function formDataFrom(fields: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries({
    statisticsSource: 'tautulli',
    tautulliUrl: 'http://tautulli:8181',
    tautulliApiKey: 'tautulli-key',
    tracearrUrl: '',
    tracearrApiKey: '',
    tracearrServerId: '',
    seerrUrl: '',
    seerrApiKey: '',
    plexUrl: '',
    plexToken: '',
    jellyfinUrl: '',
    ...fields,
  })) {
    formData.set(key, value)
  }

  return formData
}

beforeEach(() => {
  vi.clearAllMocks()

  const settings: Settings = cloneDeep(DEFAULT_SETTINGS)

  vi.mocked(getSettings).mockReturnValue(settings)
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: '1', isAdmin: true },
    expires: '',
  })
})

describe('saveConnectionSettings', () => {
  const initialState = {
    message: '',
    status: '',
    fields: DEFAULT_SETTINGS.connection,
  }

  it('tests and rejects half-configured Seerr settings', async () => {
    const onlyUrl = await saveConnectionSettings(
      initialState,
      formDataFrom({ seerrUrl: 'http://seerr:5055', seerrApiKey: '' }),
    )
    const onlyKey = await saveConnectionSettings(
      initialState,
      formDataFrom({ seerrUrl: '', seerrApiKey: 'seerr-key' }),
    )

    expect(onlyUrl).toMatchObject({
      status: 'error',
      message: 'Seerr - enterApiKey',
    })
    expect(onlyKey).toMatchObject({
      status: 'error',
      message: 'Seerr - enterUrl',
    })
    expect(writeSettings).not.toHaveBeenCalled()
  })

  it('rejects non-HTTP(S) URL schemes such as javascript: or file:', async () => {
    const jsScheme = await saveConnectionSettings(
      initialState,
      formDataFrom({ plexUrl: 'javascript:alert(1)' }),
    )
    const fileScheme = await saveConnectionSettings(
      initialState,
      formDataFrom({ jellyfinUrl: 'file:///etc/passwd' }),
    )

    expect(jsScheme).toMatchObject({ status: 'error' })
    expect(fileScheme).toMatchObject({ status: 'error' })
    expect(writeSettings).not.toHaveBeenCalled()
  })
})
