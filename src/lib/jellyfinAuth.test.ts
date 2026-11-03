import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getQuickConnectState, startQuickConnect } from './jellyfinAuth'
import { LoginError } from './loginError'

const fetchMock = vi.fn()
const JELLYFIN_URL = 'http://jellyfin:8096'
const SECRET = 'A1B2C3D4'

async function loginErrorCode(promise: Promise<unknown>) {
  const error = await promise.catch((error: unknown) => error)

  expect(error).toBeInstanceOf(LoginError)

  return (error as LoginError).message
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('startQuickConnect', () => {
  it('asks Jellyfin for a code as a named client', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ Code: '123456', Secret: SECRET, Authenticated: false }),
    )

    await expect(startQuickConnect(JELLYFIN_URL)).resolves.toEqual({
      code: '123456',
      secret: SECRET,
    })

    const [[url, init]] = fetchMock.mock.calls

    expect(url).toBe('http://jellyfin:8096/QuickConnect/Initiate')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toMatch(
      /^MediaBrowser Client=".+", Device=".+", DeviceId=".+", Version=".+"$/,
    )
  })

  it('fails with jellyfinQuickConnectDisabled while it is turned off', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    await expect(loginErrorCode(startQuickConnect(JELLYFIN_URL))).resolves.toBe(
      'jellyfinQuickConnectDisabled',
    )
  })

  it('fails with jellyfinUnavailable when Jellyfin cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(loginErrorCode(startQuickConnect(JELLYFIN_URL))).resolves.toBe(
      'jellyfinUnavailable',
    )
  })

  it('fails with jellyfinUnavailable without a code', async () => {
    fetchMock.mockResolvedValue(Response.json({}))

    await expect(loginErrorCode(startQuickConnect(JELLYFIN_URL))).resolves.toBe(
      'jellyfinUnavailable',
    )
  })
})

describe('getQuickConnectState', () => {
  it('waits until the code is entered', async () => {
    fetchMock.mockResolvedValue(Response.json({ Authenticated: false }))

    await expect(getQuickConnectState(JELLYFIN_URL, SECRET)).resolves.toBe(
      'waiting',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      `http://jellyfin:8096/QuickConnect/Connect?secret=${SECRET}`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('is authorized once the code is entered', async () => {
    fetchMock.mockResolvedValue(Response.json({ Authenticated: true }))

    await expect(getQuickConnectState(JELLYFIN_URL, SECRET)).resolves.toBe(
      'authorized',
    )
  })

  it('is expired once Jellyfin forgets the request', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(getQuickConnectState(JELLYFIN_URL, SECRET)).resolves.toBe(
      'expired',
    )
  })

  it('leaves the secret out of the log', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    await expect(
      loginErrorCode(getQuickConnectState(JELLYFIN_URL, SECRET)),
    ).resolves.toBe('jellyfinUnavailable')
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      SECRET,
    )
  })
})
