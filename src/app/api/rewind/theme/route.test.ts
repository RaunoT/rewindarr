import { canPlayRewind } from '@/lib/access'
import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import {
  getPlexThemeUrl,
  getPlexTrackUrl,
  streamPlexAudio,
} from '@/utils/plexAudio'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/access', () => ({ canPlayRewind: vi.fn() }))
vi.mock('@/utils/getSettings', () => ({ default: vi.fn() }))
vi.mock('@/utils/plexAudio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/plexAudio')>()),
  streamPlexAudio: vi.fn(),
}))

function testSettings(themeActive = true): Settings {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.connection.plexUrl = 'http://plex:32400'
  settings.connection.plexToken = 'plex-token'
  settings.rewind.isThemeMusicActive = themeActive

  return settings
}

beforeEach(() => {
  vi.stubEnv('NEXTAUTH_SECRET', 'secret')
  vi.mocked(canPlayRewind).mockResolvedValue(true)
  vi.mocked(getSettings).mockReturnValue(testSettings())
  vi.mocked(streamPlexAudio).mockResolvedValue(new Response('audio'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/rewind/theme', () => {
  it('streams audio when authorized and validly signed', async () => {
    const signedPath = getPlexThemeUrl(testSettings(), 42)!
    const req = new Request(`http://localhost${signedPath}`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(streamPlexAudio).toHaveBeenCalledWith(
      expect.anything(),
      'theme',
      '42',
      req,
    )
  })

  it('returns 404 when the viewer cannot play Rewind', async () => {
    vi.mocked(canPlayRewind).mockResolvedValue(false)

    const signedPath = getPlexThemeUrl(testSettings(), 42)!
    const res = await GET(new Request(`http://localhost${signedPath}`))

    expect(res.status).toBe(404)
    expect(streamPlexAudio).not.toHaveBeenCalled()
  })

  it('returns 404 when theme music is disabled', async () => {
    vi.mocked(getSettings).mockReturnValue(testSettings(false))

    const signedPath = getPlexThemeUrl(testSettings(), 42)!
    const res = await GET(new Request(`http://localhost${signedPath}`))

    expect(res.status).toBe(404)
    expect(streamPlexAudio).not.toHaveBeenCalled()
  })

  it('returns 404 without a valid key or signature, including track signatures', async () => {
    const trackSignedPath = new URL(
      getPlexTrackUrl(testSettings(), '42')!,
      'http://localhost',
    )

    for (const query of [
      '',
      '?key=42',
      '?key=42&sig=bad',
      '?key=abc&sig=bad',
      trackSignedPath.search,
    ]) {
      const res = await GET(
        new Request(`http://localhost/api/rewind/theme${query}`),
      )

      expect(res.status).toBe(404)
    }

    expect(streamPlexAudio).not.toHaveBeenCalled()
  })
})
