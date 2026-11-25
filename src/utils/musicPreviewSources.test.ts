import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isHostDown, markHostDown } from './hostBackoff'
import { SoundtrackTitle } from './musicPreviewMatch'
import {
  fetchDeezerPreview,
  isPreviewUrl,
  MusicPreviewError,
  searchSong,
  searchSoundtrack,
} from './musicPreviewSources'

vi.mock('./hostBackoff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hostBackoff')>()),
  isHostDown: vi.fn(),
  markHostDown: vi.fn(),
}))

const DEEZER_PREVIEW =
  'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c.mp3?hdnea=x'
const ITUNES_PREVIEW =
  'https://audio-ssl.itunes.apple.com/itunes-assets/a/b/c.plus.aac.p.m4a'
const inception: SoundtrackTitle = {
  kind: 'movie',
  titles: ['Inception'],
  year: 2010,
  composers: ['Hans Zimmer'],
}
const severance: SoundtrackTitle = {
  kind: 'show',
  titles: ['Severance'],
  year: 2022,
  composers: ['Theodore Shapiro'],
}
const creep = { artist: 'Radiohead', title: 'Creep' }
const fetchMock = vi.fn()

// What each service answers, by the start of the path and query asked for
function mockServices(answers: Record<string, unknown>) {
  fetchMock.mockImplementation(async (url: string) => {
    const asked = decodeURIComponent(url.replace(/^https:\/\/[^/]+/, ''))
    const key = Object.keys(answers).find((key) => asked.startsWith(key))
    const answer = key ? answers[key] : {}

    return answer instanceof Response ? answer : Response.json(answer)
  })
}

// The services' requests are spaced apart by timers
async function settle<T>(request: Promise<T>) {
  const result = request.catch((error: unknown) => error)

  await vi.runAllTimersAsync()

  return result
}

function asked(): string[] {
  return fetchMock.mock.calls.map(([url]) => decodeURIComponent(url as string))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(isHostDown).mockReturnValue(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('isPreviewUrl', () => {
  it("only takes the services' own hosts over HTTPS", () => {
    expect(isPreviewUrl(DEEZER_PREVIEW)).toBe(true)
    expect(isPreviewUrl(ITUNES_PREVIEW)).toBe(true)
    expect(isPreviewUrl('http://cdnt-preview.dzcdn.net/a.mp3')).toBe(false)
    expect(isPreviewUrl('https://dzcdn.net.evil.example/a.mp3')).toBe(false)
    expect(isPreviewUrl('https://evildzcdn.net/a.mp3')).toBe(false)
    expect(isPreviewUrl('https://192.168.1.1/a.mp3')).toBe(false)
    expect(isPreviewUrl('not a link')).toBe(false)
    expect(isPreviewUrl(undefined)).toBe(false)
  })
})

describe('searchSoundtrack', () => {
  it("picks the most played track of the composer's album on Deezer", async () => {
    mockServices({
      '/search/album?q=album:"Inception" artist:"Hans Zimmer"': {
        data: [
          { id: 1, title: 'Inception (Piano Covers)', artist: { name: 'X' } },
          {
            id: 2,
            title: 'Inception (Music from the Motion Picture)',
            artist: { name: 'Hans Zimmer' },
          },
        ],
      },
      '/album/2': {
        id: 2,
        title: 'Inception (Music from the Motion Picture)',
        artist: { name: 'Hans Zimmer' },
        release_date: '2010-07-09',
        tracks: {
          data: [
            { id: 10, title: 'Dream', rank: 5, preview: DEEZER_PREVIEW },
            { id: 11, title: 'Time', rank: 9, preview: DEEZER_PREVIEW },
            { id: 12, title: 'Unplayable', rank: 99, preview: '' },
          ],
        },
      },
    })

    await expect(settle(searchSoundtrack(inception))).resolves.toEqual({
      source: 'deezer',
      id: 11,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("checks the year of an album that isn't the composer's", async () => {
    const album = {
      title: 'Inception (Original Motion Picture Soundtrack)',
      artist: { name: 'Various Artists' },
      tracks: { data: [{ id: 20, title: 'Song', preview: DEEZER_PREVIEW }] },
    }

    mockServices({
      '/search/album?q=Inception soundtrack': {
        data: [
          { id: 3, ...album },
          { id: 4, ...album },
        ],
      },
      '/album/3': { id: 3, ...album, release_date: '1998-01-01' },
      '/album/4': { id: 4, ...album, release_date: '2010-07-09' },
    })

    await expect(settle(searchSoundtrack(inception))).resolves.toEqual({
      source: 'deezer',
      id: 20,
    })
  })

  it("finds a show's soundtrack by its composer's season album", async () => {
    const album = {
      id: 5,
      title: 'Severance: Season 1 (Apple TV+ Original Series Soundtrack)',
      artist: { name: 'Theodore Shapiro' },
    }

    mockServices({
      '/search/album?q=album:"Severance" artist:"Theodore Shapiro"': {
        data: [
          {
            id: 6,
            title: 'Severance Main Titles Piano (Original Series Soundtrack)',
            artist: { name: 'Jules Piano' },
          },
          album,
        ],
      },
      '/album/5': {
        ...album,
        tracks: {
          data: [{ id: 30, title: 'Main Titles', preview: DEEZER_PREVIEW }],
        },
      },
    })

    await expect(settle(searchSoundtrack(severance))).resolves.toEqual({
      source: 'deezer',
      id: 30,
    })
    expect(asked().some((url) => url.includes('/album/6'))).toBe(false)
  })

  it('falls back to iTunes, and its track named like a theme', async () => {
    mockServices({
      '/search?term=Inception Hans Zimmer': {
        results: [
          {
            collectionId: 7,
            collectionName: 'Inception (Music from the Motion Picture)',
            artistName: 'Hans Zimmer',
            releaseDate: '2010-07-09T07:00:00Z',
          },
        ],
      },
      '/lookup?id=7': {
        results: [
          { wrapperType: 'collection', collectionId: 7 },
          {
            wrapperType: 'track',
            trackName: 'Half Remembered Dream',
            trackNumber: 1,
            previewUrl: ITUNES_PREVIEW,
          },
          {
            wrapperType: 'track',
            trackName: 'Main Theme',
            trackNumber: 2,
            previewUrl: `${ITUNES_PREVIEW}?theme`,
          },
          {
            wrapperType: 'track',
            trackName: 'Inception',
            trackNumber: 3,
            previewUrl: 'https://elsewhere.example/a.m4a',
          },
        ],
      },
    })

    await expect(settle(searchSoundtrack(inception))).resolves.toEqual({
      source: 'itunes',
      url: `${ITUNES_PREVIEW}?theme`,
    })
  })

  it('gives nothing when neither has the soundtrack', async () => {
    mockServices({
      '/search/album': {
        data: [{ id: 5, title: 'Inception', artist: { name: 'Someone' } }],
      },
      '/search?': {
        results: [
          { collectionId: 8, collectionName: 'Inception', artistName: 'Else' },
        ],
      },
    })

    await expect(settle(searchSoundtrack(inception))).resolves.toBeNull()
    expect(asked().some((url) => url.includes('/album/5'))).toBe(false)
    expect(asked().some((url) => url.includes('/lookup'))).toBe(false)
  })

  it("fails when a service couldn't be asked and the other has nothing", async () => {
    mockServices({
      '/search/album': { error: { code: 4, message: 'Quota limit exceeded' } },
    })

    await expect(settle(searchSoundtrack(inception))).resolves.toBeInstanceOf(
      MusicPreviewError,
    )
  })

  it('still asks iTunes when Deezer is down', async () => {
    vi.mocked(isHostDown).mockImplementation((url) => url.includes('deezer'))
    mockServices({
      '/search?term=Inception Hans Zimmer': {
        results: [
          {
            collectionId: 7,
            collectionName: 'Inception (Music from the Motion Picture)',
            artistName: 'Hans Zimmer',
          },
        ],
      },
      '/lookup?id=7': {
        results: [
          {
            wrapperType: 'track',
            trackName: 'Time',
            previewUrl: ITUNES_PREVIEW,
          },
        ],
      },
    })

    await expect(settle(searchSoundtrack(inception))).resolves.toEqual({
      source: 'itunes',
      url: ITUNES_PREVIEW,
    })
    expect(asked().some((url) => url.includes('deezer'))).toBe(false)
  })

  it("marks a service that doesn't answer as down", async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(settle(searchSoundtrack(inception))).resolves.toBeInstanceOf(
      MusicPreviewError,
    )
    expect(markHostDown).toHaveBeenCalledWith('https://api.deezer.com')
    expect(markHostDown).toHaveBeenCalledWith('https://itunes.apple.com')
  })
})

describe('searchSong', () => {
  it('finds the song by its artist and title on Deezer', async () => {
    mockServices({
      '/search/track?q=Radiohead Creep': {
        data: [
          {
            id: 40,
            title: 'Creep (Acoustic)',
            artist: { name: 'Radiohead' },
            preview: DEEZER_PREVIEW,
          },
          {
            id: 41,
            title: 'Creep',
            artist: { name: 'Radiohead' },
            preview: '',
          },
          {
            id: 42,
            title: 'Creep',
            artist: { name: 'Radiohead' },
            preview: DEEZER_PREVIEW,
          },
        ],
      },
    })

    await expect(settle(searchSong(creep))).resolves.toEqual({
      source: 'deezer',
      id: 42,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to iTunes', async () => {
    mockServices({
      '/search/track': {
        data: [
          {
            id: 43,
            title: 'Creep',
            artist: { name: 'TLC' },
            preview: DEEZER_PREVIEW,
          },
        ],
      },
      '/search?term=Radiohead Creep': {
        results: [
          {
            trackName: 'Creep',
            artistName: 'Radiohead',
            previewUrl: ITUNES_PREVIEW,
          },
        ],
      },
    })

    await expect(settle(searchSong(creep))).resolves.toEqual({
      source: 'itunes',
      url: ITUNES_PREVIEW,
    })
  })

  it('gives nothing when neither has the song', async () => {
    mockServices({})

    await expect(settle(searchSong(creep))).resolves.toBeNull()
  })
})

describe('fetchDeezerPreview', () => {
  it("gives the track's link", async () => {
    mockServices({ '/track/11': { id: 11, preview: DEEZER_PREVIEW } })

    await expect(settle(fetchDeezerPreview(11))).resolves.toBe(DEEZER_PREVIEW)
  })

  it('gives nothing for a track Deezer no longer has, or a link elsewhere', async () => {
    mockServices({
      '/track/11': { error: { code: 800, message: 'no data' } },
      '/track/12': { id: 12, preview: 'https://elsewhere.example/a.mp3' },
    })

    await expect(settle(fetchDeezerPreview(11))).resolves.toBeNull()
    await expect(settle(fetchDeezerPreview(12))).resolves.toBeNull()
  })

  it("fails when Deezer couldn't be asked", async () => {
    mockServices({ '/track/11': new Response(null, { status: 500 }) })

    await expect(settle(fetchDeezerPreview(11))).resolves.toBeInstanceOf(
      MusicPreviewError,
    )
  })

  it('skips the request if the host is marked down while waiting its turn', async () => {
    fetchMock.mockImplementationOnce(async () => {
      vi.mocked(isHostDown).mockReturnValue(true)

      return Response.json({ id: 11, preview: DEEZER_PREVIEW })
    })

    const first = fetchDeezerPreview(11).catch((error: unknown) => error)
    const second = fetchDeezerPreview(12).catch((error: unknown) => error)

    await vi.runAllTimersAsync()

    await expect(first).resolves.toBe(DEEZER_PREVIEW)
    await expect(second).resolves.toBeInstanceOf(MusicPreviewError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
