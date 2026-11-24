import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  testMediaServerUrl,
  testPlexToken,
  testSeerr,
  testTautulli,
  testTracearr,
} from './connectionTests'

type Fetch = typeof fetch

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function stubFetch(answer: (url: URL, init?: RequestInit) => Response) {
  const stub = vi.fn<Fetch>(async (input, init) =>
    answer(new URL(String(input)), init),
  )

  vi.stubGlobal('fetch', stub)

  return stub
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('connection tests', () => {
  it('asks for the URL and key before testing', async () => {
    const stub = stubFetch(() => json({}))

    expect(await testTautulli('', 'key')).toEqual({ key: 'enterUrl' })
    expect(await testSeerr('http://seerr', '')).toEqual({ key: 'enterApiKey' })
    expect(await testTracearr('', '')).toEqual({ error: { key: 'enterUrl' } })
    expect(stub).not.toHaveBeenCalled()
  })

  it('tells a wrong key from an unreachable address', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(() => json({}, 401))

    expect(await testSeerr('http://seerr', 'key')).toEqual({
      key: 'invalidApiKey',
    })

    stubFetch(() => {
      throw new TypeError('fetch failed')
    })

    expect(await testSeerr('http://seerr', 'key')).toEqual({
      key: 'unableToConnect',
    })
  })

  it("doesn't follow a redirect with Seerr's key", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const stub = stubFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://elsewhere.example' },
        }),
    )

    expect(await testSeerr('http://seerr', 'key')).toEqual({
      key: 'redirected',
    })
    expect(stub.mock.calls[0][1]?.redirect).toBe('manual')
  })

  it("needs Seerr's own answer, not a proxy's sign-in page", async () => {
    stubFetch(() => new Response('<html>Sign in</html>', { status: 200 }))

    expect(await testSeerr('http://seerr', 'key')).toEqual({
      key: 'notMediaServer',
      values: { server: 'Seerr' },
    })

    stubFetch(() => json({ pageInfo: {}, results: [] }))

    expect(await testSeerr('http://seerr', 'key')).toBeNull()
  })

  it("reads a bad key from Tautulli's successful answer", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(() => json({ response: { result: 'error' } }))

    expect(await testTautulli('http://tautulli', 'key')).toEqual({
      key: 'invalidApiKey',
    })

    stubFetch(() => json({ response: { result: 'success' } }))

    expect(await testTautulli('http://tautulli', 'key')).toBeNull()
  })

  it('needs Tracearr to track a Plex or Jellyfin server', async () => {
    stubFetch(() =>
      json({
        data: [{ server_id: '1', server_name: 'Emby', server_type: 'emby' }],
      }),
    )

    expect(await testTracearr('http://tracearr', 'key')).toEqual({
      error: { key: 'noMediaServer' },
    })

    const servers = [
      { server_id: '2', server_name: 'Home', server_type: 'plex' },
    ]

    stubFetch(() => json({ data: servers }))

    expect(await testTracearr('http://tracearr', 'key')).toEqual({ servers })
  })

  it('checks that the URL answers as the media server', async () => {
    stubFetch(() => json({ Id: 'abc' }))

    expect(await testMediaServerUrl('jellyfin', 'http://jellyfin')).toBeNull()

    stubFetch(() => json({ status: 'ok' }))

    expect(await testMediaServerUrl('plex', 'http://other')).toEqual({
      key: 'notMediaServer',
      values: { server: 'Plex' },
    })
  })

  it("doesn't follow a redirect with the Plex token", async () => {
    const stub = stubFetch(() => json({}, 401))

    expect(await testPlexToken('http://plex', 'token')).toEqual({
      key: 'invalidToken',
    })
    expect(stub.mock.calls[0][1]?.redirect).toBe('manual')
    expect(await testPlexToken('', 'token')).toEqual({ key: 'tokenNeedsUrl' })
  })
})
