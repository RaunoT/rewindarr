import { Settings } from '@/types/settings'
import { cloneDeep } from 'lodash'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './constants'
import { isHostDown } from './hostBackoff'
import {
  getPlexThemeUrl,
  getPlexTrackUrl,
  isSignedTheme,
  isSignedTrack,
  isThemePath,
  isTrackPath,
  MAX_AUDIO_PATHS,
  streamPlexAudio,
} from './plexAudio'

vi.mock('./hostBackoff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hostBackoff')>()),
  isHostDown: vi.fn(),
  markHostDown: vi.fn(),
  markHostUp: vi.fn(),
}))

const fetchMock = vi.fn()

let ratingKey = 100

function testSettings(token = 'plex-token'): Settings {
  const settings = cloneDeep(DEFAULT_SETTINGS)

  settings.connection.plexUrl = 'http://plex:32400'
  settings.connection.plexToken = token

  return settings
}

function metadata(item: Record<string, unknown>) {
  return Response.json({ MediaContainer: { Metadata: [item] } })
}

function themeMetadata(theme: unknown) {
  return metadata({ theme })
}

function trackMetadata(key: unknown, type = 'track') {
  return metadata({ type, Media: [{ Part: [{ key }] }] })
}

function request(range?: string) {
  return new Request('http://rewindarr/api/rewind/theme', {
    headers: range ? { Range: range } : {},
  })
}

// Theme paths are remembered per item, so each test asks for a new one
function nextKey() {
  ratingKey += 1

  return String(ratingKey)
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXTAUTH_SECRET', 'secret')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(isHostDown).mockReturnValue(false)
  fetchMock.mockReset()

  const { rewindarrPlexAudioPaths, rewindarrPendingPlexAudioPaths } =
    globalThis as {
      rewindarrPlexAudioPaths?: Map<string, unknown>
      rewindarrPendingPlexAudioPaths?: Map<string, unknown>
    }

  rewindarrPlexAudioPaths?.clear()
  rewindarrPendingPlexAudioPaths?.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('getPlexThemeUrl', () => {
  it('signs the rating key separately from track URLs', () => {
    const themeUrl = new URL(
      getPlexThemeUrl(testSettings(), 123) ?? '',
      'http://x',
    )
    const trackUrl = new URL(
      getPlexTrackUrl(testSettings(), '123') ?? '',
      'http://x',
    )

    expect(themeUrl.pathname).toBe('/api/rewind/theme')
    expect(themeUrl.searchParams.get('key')).toBe('123')
    expect(isSignedTheme('123', themeUrl.searchParams.get('sig') ?? '')).toBe(
      true,
    )
    expect(isSignedTheme('124', themeUrl.searchParams.get('sig') ?? '')).toBe(
      false,
    )
    expect(isSignedTheme('123', trackUrl.searchParams.get('sig') ?? '')).toBe(
      false,
    )
    expect(isSignedTrack('123', themeUrl.searchParams.get('sig') ?? '')).toBe(
      false,
    )
    expect(isSignedTheme('123', '')).toBe(false)
  })

  it('has none for Jellyfin, without a token, invalid key, or without a secret', () => {
    const jellyfin = testSettings()

    jellyfin.connection.mediaServerType = 'jellyfin'

    expect(getPlexThemeUrl(jellyfin, 123)).toBeNull()
    expect(getPlexThemeUrl(testSettings(''), 123)).toBeNull()
    expect(getPlexThemeUrl(testSettings(), 0)).toBeNull()
    expect(getPlexThemeUrl(testSettings(), 'abc')).toBeNull()
    expect(getPlexThemeUrl(testSettings(), undefined)).toBeNull()

    vi.stubEnv('NEXTAUTH_SECRET', '')

    expect(getPlexThemeUrl(testSettings(), 123)).toBeNull()
    expect(isSignedTheme('123', 'anything')).toBe(false)
  })
})

describe('getPlexTrackUrl', () => {
  it('signs the rating key', () => {
    const url = new URL(
      getPlexTrackUrl(testSettings(), '123') ?? '',
      'http://x',
    )

    expect(url.pathname).toBe('/api/rewind/track')
    expect(url.searchParams.get('key')).toBe('123')
    expect(isSignedTrack('123', url.searchParams.get('sig') ?? '')).toBe(true)
    expect(isSignedTrack('124', url.searchParams.get('sig') ?? '')).toBe(false)
    expect(isSignedTrack('123', '')).toBe(false)
  })

  it('has none for Jellyfin, without a token or without a secret', () => {
    const jellyfin = testSettings()

    jellyfin.connection.mediaServerType = 'jellyfin'

    expect(getPlexTrackUrl(jellyfin, '123')).toBeNull()
    expect(getPlexTrackUrl(testSettings(''), '123')).toBeNull()

    vi.stubEnv('NEXTAUTH_SECRET', '')

    expect(getPlexTrackUrl(testSettings(), '123')).toBeNull()
    expect(isSignedTrack('123', 'anything')).toBe(false)
  })
})

describe('isTrackPath', () => {
  it("accepts Plex's file paths only", () => {
    expect(isTrackPath('/library/parts/5/1700000000/file.flac')).toBe(true)
    expect(isTrackPath('/library/parts/5/1700000000/file.mkv?x=1')).toBe(false)
    expect(isTrackPath('/library/metadata/5/theme/1')).toBe(false)
    expect(isTrackPath(undefined)).toBe(false)
  })
})

describe('isThemePath', () => {
  it("accepts Plex's theme paths only", () => {
    expect(isThemePath('/library/metadata/5/theme/1700000000')).toBe(true)
    expect(isThemePath('/library/metadata/5/thumb/1700000000')).toBe(false)
    expect(isThemePath('/photo/:/transcode?url=http://evil')).toBe(false)
    expect(isThemePath(null)).toBe(false)
  })
})

describe('streamPlexAudio', () => {
  it('looks up the theme and fetches it with the token in a header', async () => {
    const key = nextKey()

    fetchMock
      .mockResolvedValueOnce(themeMetadata(`/library/metadata/${key}/theme/1`))
      .mockResolvedValueOnce(
        new Response('audio', {
          status: 206,
          headers: {
            'Content-Type': 'audio/mpeg3',
            'Content-Range': 'bytes 0-1/5',
          },
        }),
      )

    const result = await streamPlexAudio(
      testSettings(),
      'theme',
      key,
      request('bytes=0-1'),
    )

    expect(result.status).toBe(206)
    expect(result.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(result.headers.get('Content-Range')).toBe('bytes 0-1/5')
    expect(await result.text()).toBe('audio')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `http://plex:32400/library/metadata/${key}`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Plex-Token': 'plex-token' }),
        redirect: 'manual',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://plex:32400/library/metadata/${key}/theme/1`,
      expect.objectContaining({
        headers: { Range: 'bytes=0-1', 'X-Plex-Token': 'plex-token' },
      }),
    )
  })

  it("streams a song's file as its type", async () => {
    const key = nextKey()

    fetchMock
      .mockResolvedValueOnce(trackMetadata('/library/parts/9/1/file.flac'))
      .mockResolvedValueOnce(
        new Response('audio', {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      )

    const result = await streamPlexAudio(
      testSettings(),
      'track',
      key,
      request(),
    )

    expect(result.status).toBe(200)
    expect(result.headers.get('Content-Type')).toBe('audio/flac')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://plex:32400/library/parts/9/1/file.flac',
      expect.anything(),
    )
  })

  it("doesn't stream a file that isn't a song or that browsers can't play", async () => {
    fetchMock.mockResolvedValueOnce(
      trackMetadata('/library/parts/9/1/file.mkv', 'movie'),
    )

    expect(
      (await streamPlexAudio(testSettings(), 'track', nextKey(), request()))
        .status,
    ).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock
      .mockResolvedValueOnce(trackMetadata('/library/parts/9/1/file.wma'))
      .mockResolvedValueOnce(new Response('audio'))

    expect(
      (await streamPlexAudio(testSettings(), 'track', nextKey(), request()))
        .status,
    ).toBe(404)
  })

  it('looks the item up once for several requests', async () => {
    const key = nextKey()

    fetchMock
      .mockResolvedValueOnce(themeMetadata(`/library/metadata/${key}/theme/1`))
      .mockImplementation(async () => new Response('audio'))

    await streamPlexAudio(testSettings(), 'theme', key, request())
    await streamPlexAudio(testSettings(), 'theme', key, request('bytes=100-'))

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('deduplicates concurrent metadata lookups for the same key', async () => {
    const key = nextKey()

    let resolveMetadata!: (response: Response) => void

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith(`/library/metadata/${key}`)) {
        return await new Promise<Response>((resolve) => {
          resolveMetadata = resolve
        })
      }

      return new Response('audio')
    })

    const first = streamPlexAudio(testSettings(), 'theme', key, request())
    const second = streamPlexAudio(
      testSettings(),
      'theme',
      key,
      request('bytes=10-'),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveMetadata(themeMetadata(`/library/metadata/${key}/theme/1`))
    await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('clears failed lookups without caching so the next request retries', async () => {
    const key = nextKey()

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(themeMetadata(`/library/metadata/${key}/theme/1`))
      .mockResolvedValueOnce(new Response('audio'))

    expect(
      (await streamPlexAudio(testSettings(), 'theme', key, request())).status,
    ).toBe(404)

    const retry = await streamPlexAudio(testSettings(), 'theme', key, request())

    expect(retry.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('evicts the oldest cached audio paths once past the cap', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const match = input.match(/\/library\/metadata\/(\d+)$/)

      if (match) {
        return themeMetadata(`/library/metadata/${match[1]}/theme/1`)
      }

      return new Response('audio')
    })

    const firstKey = nextKey()

    await streamPlexAudio(testSettings(), 'theme', firstKey, request())

    for (let i = 0; i < MAX_AUDIO_PATHS; i++) {
      await streamPlexAudio(testSettings(), 'theme', nextKey(), request())
    }

    const callsBefore = fetchMock.mock.calls.length

    await streamPlexAudio(testSettings(), 'theme', firstKey, request())

    // Both metadata and audio were fetched again because `firstKey` was evicted
    expect(fetchMock).toHaveBeenCalledTimes(callsBefore + 2)
  })

  it('drops expired cache entries when their TTL lapses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })

    const key = nextKey()

    fetchMock.mockImplementation(async (input: string) => {
      if (input.endsWith(`/library/metadata/${key}`)) {
        return themeMetadata(`/library/metadata/${key}/theme/1`)
      }

      return new Response('audio')
    })

    await streamPlexAudio(testSettings(), 'theme', key, request())
    vi.advanceTimersByTime(61 * 60 * 1000)
    await streamPlexAudio(testSettings(), 'theme', key, request())

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('has none for an item without a theme', async () => {
    fetchMock.mockResolvedValueOnce(themeMetadata(undefined))

    expect(
      (await streamPlexAudio(testSettings(), 'theme', nextKey(), request()))
        .status,
    ).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("doesn't request a path that isn't a theme", async () => {
    fetchMock.mockResolvedValueOnce(themeMetadata('/photo/:/transcode?url=x'))

    expect(
      (await streamPlexAudio(testSettings(), 'theme', nextKey(), request()))
        .status,
    ).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks nothing without a token or while Plex is down', async () => {
    expect(
      (await streamPlexAudio(testSettings(''), 'theme', nextKey(), request()))
        .status,
    ).toBe(404)

    vi.mocked(isHostDown).mockReturnValue(true)

    expect(
      (await streamPlexAudio(testSettings(), 'theme', nextKey(), request()))
        .status,
    ).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('has none when Plex refuses the token', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

    expect(
      (await streamPlexAudio(testSettings(), 'theme', nextKey(), request()))
        .status,
    ).toBe(404)
  })
})
