import { canPlayRewind } from '@/lib/access'
import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { getPlexTrackUrl, streamPlexAudio } from '@/utils/plexAudio'
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

describe('GET /api/rewind/track', () => {
  it('streams audio when authorized and validly signed', async () => {
    const signedPath = getPlexTrackUrl(testSettings(), '77')!
    const req = new Request(`http://localhost${signedPath}`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(streamPlexAudio).toHaveBeenCalledWith(
      expect.anything(),
      'track',
      '77',
      req,
    )
  })

  it('returns 404 when unauthorized, disabled, or missing a valid signature', async () => {
    const signedPath = getPlexTrackUrl(testSettings(), '77')!

    vi.mocked(canPlayRewind).mockResolvedValueOnce(false)
    expect(
      (await GET(new Request(`http://localhost${signedPath}`))).status,
    ).toBe(404)

    vi.mocked(getSettings).mockReturnValueOnce(testSettings(false))
    expect(
      (await GET(new Request(`http://localhost${signedPath}`))).status,
    ).toBe(404)

    expect(
      (await GET(new Request('http://localhost/api/rewind/track?key=77')))
        .status,
    ).toBe(404)
    expect(
      (
        await GET(
          new Request('http://localhost/api/rewind/track?key=77&sig=invalid'),
        )
      ).status,
    ).toBe(404)
    expect(streamPlexAudio).not.toHaveBeenCalled()
  })
})
