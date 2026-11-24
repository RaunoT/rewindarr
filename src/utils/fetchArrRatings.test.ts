import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMovieRatings, getShowRatings } from './fetchArrRatings'

type Fetch = typeof fetch

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init)
}

function stubFetch(handler: (url: string) => Response) {
  const stub = vi.fn<Fetch>(async (url) => handler(String(url)))

  vi.stubGlobal('fetch', stub)

  return stub
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(
    globalThis as { rewindarrDownServices?: Map<string, unknown> }
  ).rewindarrDownServices?.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getMovieRatings', () => {
  it('reads IMDb and Rotten Tomatoes from Radarr by TMDB ID', async () => {
    const stub = stubFetch(() =>
      jsonResponse({
        MovieRatings: {
          Imdb: { Value: 7.8 },
          RottenTomatoes: { Value: 96 },
        },
      }),
    )

    expect(await getMovieRatings(37799, 'tt1285016')).toEqual({
      imdb: '7.8',
      rottenTomatoes: 96,
    })
    expect(String(stub.mock.calls[0][0])).toBe(
      'https://api.radarr.video/v1/movie/37799',
    )
  })

  it('falls back to the IMDb ID, which returns a list', async () => {
    const stub = stubFetch(() =>
      jsonResponse([{ MovieRatings: { Imdb: { Value: 8 } } }]),
    )

    expect(await getMovieRatings(null, 'tt1285016')).toEqual({
      imdb: '8.0',
      rottenTomatoes: null,
    })
    expect(String(stub.mock.calls[0][0])).toBe(
      'https://api.radarr.video/v1/movie/imdb/tt1285016',
    )
  })

  it('keeps a 0% Rotten Tomatoes score apart from a missing one', async () => {
    stubFetch(() =>
      jsonResponse({ MovieRatings: { RottenTomatoes: { Value: 0 } } }),
    )

    expect((await getMovieRatings(1, null)).rottenTomatoes).toBe(0)
  })

  it('leaves the ratings out for an unknown movie', async () => {
    stubFetch(() => new Response(null, { status: 404 }))

    expect(await getMovieRatings(1, null)).toEqual({
      imdb: null,
      rottenTomatoes: null,
    })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('leaves the ratings out when Radarr fails', async () => {
    stubFetch(() => new Response(null, { status: 500 }))

    expect(await getMovieRatings(1, null)).toEqual({
      imdb: null,
      rottenTomatoes: null,
    })
    expect(console.error).toHaveBeenCalled()
  })

  it('looks nothing up without an ID', async () => {
    const stub = stubFetch(() => jsonResponse({}))

    expect(await getMovieRatings(null, null)).toEqual({
      imdb: null,
      rottenTomatoes: null,
    })
    expect(stub).not.toHaveBeenCalled()
  })

  it('backs off after gateway or network failures and cancels non-OK bodies', async () => {
    const cancel = vi.fn(async () => {})
    const badGateway = new Response('bad gateway', { status: 502 })

    Object.defineProperty(badGateway, 'body', { value: { cancel } })

    const stub = stubFetch(() => badGateway)

    await expect(getMovieRatings(1, null)).resolves.toEqual({
      imdb: null,
      rottenTomatoes: null,
    })
    expect(cancel).toHaveBeenCalledTimes(1)

    // Backed off: next call returns immediately without fetching
    await expect(getMovieRatings(2, null)).resolves.toEqual({
      imdb: null,
      rottenTomatoes: null,
    })
    expect(stub).toHaveBeenCalledTimes(1)
  })

  it('does not back off after malformed JSON on a 200 response', async () => {
    const stub = stubFetch(() => new Response('<html>', { status: 200 }))

    await expect(getMovieRatings(1, null)).resolves.toEqual({
      imdb: null,
      rottenTomatoes: null,
    })

    await expect(getMovieRatings(2, null)).resolves.toEqual({
      imdb: null,
      rottenTomatoes: null,
    })
    expect(stub).toHaveBeenCalledTimes(2)
  })
})

describe('getShowRatings', () => {
  it('reads the IMDb rating from Sonarr by TVDB ID', async () => {
    const stub = stubFetch(() =>
      jsonResponse({ rating: { count: 2697144, value: '9.5' } }),
    )

    expect(await getShowRatings(81189)).toEqual({
      imdb: '9.5',
      rottenTomatoes: null,
    })
    expect(String(stub.mock.calls[0][0])).toBe(
      'https://skyhook.sonarr.tv/v1/tvdb/shows/en/81189',
    )
  })

  it('leaves out a rating nobody has given', async () => {
    stubFetch(() => jsonResponse({ rating: { count: 0, value: '0' } }))

    expect((await getShowRatings(1)).imdb).toBeNull()
  })

  it('looks nothing up without a TVDB ID', async () => {
    const stub = stubFetch(() => jsonResponse({}))

    expect((await getShowRatings(null)).imdb).toBeNull()
    expect(stub).not.toHaveBeenCalled()
  })
})
