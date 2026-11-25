import { canPlayRewind } from '@/lib/access'
import { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/utils/constants'
import getSettings from '@/utils/getSettings'
import { getPreviewUrl, streamPreview } from '@/utils/musicPreview'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/access', () => ({ canPlayRewind: vi.fn() }))
vi.mock('@/utils/getSettings', () => ({ default: vi.fn() }))
vi.mock('@/utils/musicPreview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/musicPreview')>()),
  streamPreview: vi.fn(),
}))

function testSettings(themeActive = true): Settings {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.rewind.isThemeMusicActive = themeActive

  return settings
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXTAUTH_SECRET', 'secret')
  vi.mocked(canPlayRewind).mockResolvedValue(true)
  vi.mocked(getSettings).mockReturnValue(testSettings())
  vi.mocked(streamPreview).mockResolvedValue(new Response('preview-audio'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/rewind/preview', () => {
  it('streams a preview when authorized and validly signed', async () => {
    const signedPath = getPreviewUrl({ kind: 'movie', tmdbId: 603 })!
    const req = new Request(`http://localhost${signedPath}`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(streamPreview).toHaveBeenCalledWith(
      { kind: 'movie', tmdbId: 603 },
      req,
    )
  })

  it('returns 404 when the viewer cannot play Rewind or theme music is disabled', async () => {
    const signedPath = getPreviewUrl({
      kind: 'song',
      artist: 'Artist',
      title: 'Track',
    })!

    vi.mocked(canPlayRewind).mockResolvedValueOnce(false)
    await expect(
      GET(new Request(`http://localhost${signedPath}`)),
    ).resolves.toMatchObject({ status: 404 })

    vi.mocked(getSettings).mockReturnValueOnce(testSettings(false))
    await expect(
      GET(new Request(`http://localhost${signedPath}`)),
    ).resolves.toMatchObject({ status: 404 })

    expect(streamPreview).not.toHaveBeenCalled()
  })

  it('returns 404 when query params are missing, invalid, or unsigned', async () => {
    for (const query of [
      '',
      '?movie=603',
      '?movie=603&sig=invalid',
      '?movie=abc&sig=invalid',
      '?artist=Artist&title=Track',
    ]) {
      const res = await GET(
        new Request(`http://localhost/api/rewind/preview${query}`),
      )

      expect(res.status).toBe(404)
    }

    expect(streamPreview).not.toHaveBeenCalled()
  })
})
