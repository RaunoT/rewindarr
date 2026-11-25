import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import getVersion, { compareVersions } from './getVersion'

const fetchMock = vi.fn()

// Failed checks are skipped for a while, so every test starts later than the last
let clock = Date.UTC(2026, 0, 1)

describe('compareVersions', () => {
  it('compares stable versions numerically', () => {
    expect(compareVersions('v5.1.0', 'v5.2.0')).toBe(true)
    expect(compareVersions('v5.2.0', 'v5.2.0')).toBe(false)
    expect(compareVersions('v5.9.0', 'v5.10.0')).toBe(true)
    expect(compareVersions('v5.10.0', 'v5.9.0')).toBe(false)
  })

  it('puts a release after its develop builds', () => {
    expect(compareVersions('v5.3.0-develop.18', 'v5.3.0')).toBe(true)
    expect(compareVersions('v5.3.0', 'v5.3.0-develop.18')).toBe(false)
  })

  it('compares develop versions numerically', () => {
    expect(compareVersions('v5.2.1-develop.2', 'v5.2.1-develop.10')).toBe(true)
    expect(compareVersions('v5.2.1-develop.10', 'v5.2.1-develop.2')).toBe(false)
    expect(compareVersions('v5.2.1-develop.2', 'v5.3.0-develop.1')).toBe(true)
    expect(compareVersions('v5.3.0-develop.1', 'v5.2.1-develop.9')).toBe(false)
  })
})

describe('getVersion', () => {
  const latestRelease = { tag_name: 'v5.1.0', draft: false, prerelease: false }

  beforeEach(() => {
    delete (globalThis as { rewindarrVersionCache?: unknown })
      .rewindarrVersionCache
    clock += 24 * 60 * 60 * 1000
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(clock)
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('NEXT_PUBLIC_VERSION_TAG', '5.0.0')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fetchMock.mockReset()
  })

  it('finds the latest stable release via /releases/latest', async () => {
    fetchMock.mockResolvedValue(Response.json(latestRelease))

    const version = await getVersion()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/RaunoT/rewindarr/releases/latest',
      expect.any(Object),
    )
    expect(version).toMatchObject({
      currentVersion: 'v5.0.0',
      latestVersion: 'v5.1.0',
      hasUpdate: true,
    })
  })

  it('finds the highest develop release in the order GitHub lists them', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERSION_TAG', '5.3.0-develop.10')
    fetchMock.mockResolvedValue(
      Response.json([
        { tag_name: 'v5.3.0-develop.9', draft: false, prerelease: true },
        { tag_name: 'v5.3.0-develop.18', draft: false, prerelease: true },
        { tag_name: 'v5.3.0-develop.10', draft: false, prerelease: true },
      ]),
    )

    const version = await getVersion()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/RaunoT/rewindarr/releases?per_page=100',
      expect.any(Object),
    )
    expect(version).toMatchObject({
      currentVersion: 'v5.3.0-develop.10',
      latestVersion: 'v5.3.0-develop.18',
      hasUpdate: true,
    })
  })

  it('does not call GitHub for a local build', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERSION_TAG', '')

    const version = await getVersion()

    expect(version.currentVersion).toBe('local')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a timeout signal', async () => {
    fetchMock.mockResolvedValue(Response.json(latestRelease))

    await getVersion()

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    [
      'a rate limit',
      () => Response.json({ message: 'rate limit' }, { status: 403 }),
    ],
    [
      'an unexpected object body',
      () => Response.json({ message: 'unexpected' }),
    ],
    ['a non-JSON body', () => new Response('<html></html>')],
  ])('keeps the current version after %s', async (_name, respond) => {
    fetchMock.mockResolvedValue(respond())

    const version = await getVersion()

    expect(version).toMatchObject({
      currentVersion: 'v5.0.0',
      latestVersion: 'v5.0.0',
      hasUpdate: false,
    })
  })

  it('backs off after an unexpected 200 object body instead of refetching immediately', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'unexpected' }))

    await getVersion()
    await getVersion()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ignores releases without a tag name', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERSION_TAG', '5.0.0-develop.1')
    fetchMock.mockResolvedValue(
      Response.json([
        { draft: false, prerelease: true },
        { tag_name: 'v5.0.0-develop.2', draft: false, prerelease: true },
      ]),
    )

    const version = await getVersion()

    expect(version.latestVersion).toBe('v5.0.0-develop.2')
  })

  it('waits 15 minutes before checking again after a failed response', async () => {
    const cancel = vi.fn(async () => {})

    fetchMock.mockImplementation(async () => {
      const res = Response.json({ message: 'rate limit' }, { status: 403 })

      Object.defineProperty(res, 'body', { value: { cancel } })

      return res
    })

    await getVersion()
    await getVersion()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)

    vi.setSystemTime(clock + 16 * 60 * 1000)
    await getVersion()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the current version when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const version = await getVersion()

    expect(version.hasUpdate).toBe(false)
  })

  it('returns without blocking when wait is false and refreshes in the background', async () => {
    let resolveFetch: (response: Response) => void = () => {}

    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )

    const immediate = await getVersion({ wait: false })

    expect(immediate).toMatchObject({
      currentVersion: 'v5.0.0',
      latestVersion: 'v5.0.0',
      hasUpdate: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(Response.json(latestRelease))

    await vi.waitFor(async () => {
      expect(await getVersion({ wait: false })).toMatchObject({
        latestVersion: 'v5.1.0',
        hasUpdate: true,
      })
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
