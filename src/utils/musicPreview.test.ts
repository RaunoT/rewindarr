import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./fetchTmdb', () => ({ default: vi.fn() }))
vi.mock('./musicPreviewSources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./musicPreviewSources')>()),
  searchSoundtrack: vi.fn(),
  searchSong: vi.fn(),
  fetchDeezerPreview: vi.fn(),
}))

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-23T12:00:00Z')
const ITUNES_PREVIEW =
  'https://audio-ssl.itunes.apple.com/itunes-assets/a/b/c.plus.aac.p.m4a'
const itunes = { source: 'itunes', url: ITUNES_PREVIEW } as const
const deezer = { source: 'deezer', id: 11 } as const
const inception = { kind: 'movie', tmdbId: 27205 } as const
const severance = { kind: 'show', tmdbId: 95396 } as const
const creep = { kind: 'song', artist: 'Radiohead', title: 'Creep' } as const
const fetchMock = vi.fn()

let directory: string

function filePath() {
  return path.join(directory, 'config/music-previews.json')
}

function readFile() {
  return JSON.parse(fs.readFileSync(filePath(), 'utf8'))
}

function writeFile(previews: unknown) {
  fs.writeFileSync(filePath(), JSON.stringify({ version: 1, previews }))
}

// As after a restart
async function load() {
  delete (globalThis as { rewindarrMusicPreviews?: unknown })
    .rewindarrMusicPreviews
  vi.resetModules()

  const musicPreview = await import('./musicPreview')
  const sources = await import('./musicPreviewSources')
  const fetchTmdb = vi.mocked((await import('./fetchTmdb')).default)

  // The mocks outlive the restart
  vi.mocked(sources.searchSoundtrack).mockReset()
  vi.mocked(sources.searchSong).mockReset()
  vi.mocked(sources.fetchDeezerPreview).mockReset()
  fetchTmdb.mockReset().mockImplementation(async (endpoint) =>
    endpoint.startsWith('movie/')
      ? {
          title: 'Inception',
          original_title: 'Inception',
          release_date: '2010-07-15',
          credits: {
            crew: [
              { name: 'Christopher Nolan', job: 'Director' },
              { name: 'Hans Zimmer', job: 'Original Music Composer' },
            ],
          },
        }
      : {
          name: 'Severance',
          original_name: 'Severance',
          first_air_date: '2022-02-17',
          aggregate_credits: {
            crew: [
              {
                name: 'George Drakoulias',
                jobs: [{ job: 'Music Supervisor', episode_count: 19 }],
              },
              {
                name: 'Guest Composer',
                jobs: [{ job: 'Original Music Composer', episode_count: 1 }],
              },
              {
                name: 'Theodore Shapiro',
                jobs: [
                  { job: 'Original Music Composer', episode_count: 10 },
                  { job: 'Main Title Theme Composer', episode_count: 9 },
                ],
              },
            ],
          },
        },
  )

  return {
    ...musicPreview,
    fetchTmdb,
    searchSoundtrack: vi.mocked(sources.searchSoundtrack),
    searchSong: vi.mocked(sources.searchSong),
    fetchDeezerPreview: vi.mocked(sources.fetchDeezerPreview),
  }
}

// Lets the save run once its delay is over
async function waitForSave() {
  await vi.advanceTimersByTimeAsync(1000)
  await vi.waitFor(() => expect(fs.existsSync(filePath())).toBe(true))
}

function request(range?: string) {
  return new Request('http://rewindarr/api/rewind/preview?movie=27205', {
    headers: range ? { Range: range } : {},
  })
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rewindarr-previews-'))
  fs.mkdirSync(path.join(directory, 'config'))
  vi.spyOn(process, 'cwd').mockReturnValue(directory)
  vi.stubEnv('NEXTAUTH_SECRET', 'secret')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(NOW)
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  fetchMock.mockReset()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('getPreviewUrl', () => {
  function toParams(url: string | null) {
    return new URLSearchParams((url ?? '').split('?')[1])
  }

  it("goes by a movie's or show's TMDB ID", async () => {
    const { getPreviewUrl, toSoundtrackItem, parsePreviewItem } = await load()

    expect(getPreviewUrl(inception)).toMatch(
      /^\/api\/rewind\/preview\?movie=27205&sig=[\w-]+$/,
    )
    expect(getPreviewUrl(severance)).toMatch(
      /^\/api\/rewind\/preview\?show=95396&sig=[\w-]+$/,
    )
    expect(parsePreviewItem(toParams(getPreviewUrl(inception)))).toEqual(
      inception,
    )
    expect(parsePreviewItem(toParams(getPreviewUrl(severance)))).toEqual(
      severance,
    )
    expect(toSoundtrackItem('movie', null)).toBeNull()
  })

  it("goes by a song's artist and title", async () => {
    const { getPreviewUrl, parsePreviewItem, toSongItem } = await load()

    expect(getPreviewUrl(creep)).toMatch(
      /^\/api\/rewind\/preview\?artist=Radiohead&title=Creep&sig=[\w-]+$/,
    )
    expect(parsePreviewItem(toParams(getPreviewUrl(creep)))).toEqual(creep)
    expect(toSongItem({ artist: null, title: 'Creep' })).toBeNull()
    expect(toSongItem({ artist: 'Radiohead', title: 'Creep' })).toEqual(creep)
  })

  it('only takes what Rewind signed, so nothing else can be searched for', async () => {
    const { getPreviewUrl, parsePreviewItem } = await load()
    const movie = toParams(getPreviewUrl(inception))
    const song = toParams(getPreviewUrl(creep))

    // Another movie, the same ID as a show, and another song
    movie.set('movie', '603')
    song.set('title', 'Karma Police')

    expect(parsePreviewItem(movie)).toBeNull()
    expect(
      parsePreviewItem(
        new URLSearchParams({ show: '27205', sig: movie.get('sig') ?? '' }),
      ),
    ).toBeNull()
    expect(parsePreviewItem(song)).toBeNull()
    expect(parsePreviewItem(new URLSearchParams('movie=27205'))).toBeNull()
    expect(parsePreviewItem(new URLSearchParams('movie=abc&sig=x'))).toBeNull()
    expect(
      parsePreviewItem(new URLSearchParams('artist=Radiohead&title=Creep')),
    ).toBeNull()
    expect(parsePreviewItem(new URLSearchParams(''))).toBeNull()
  })

  it("signs an artist and title that can't be read as another's", async () => {
    const { getPreviewUrl, parsePreviewItem } = await load()
    const signed = toParams(
      getPreviewUrl({ kind: 'song', artist: 'A\nB', title: 'C' }),
    )

    signed.set('artist', 'A')
    signed.set('title', 'B\nC')

    expect(parsePreviewItem(signed)).toBeNull()
  })

  it('gives none without a secret to sign it with', async () => {
    const { getPreviewUrl } = await load()

    vi.stubEnv('NEXTAUTH_SECRET', '')

    expect(getPreviewUrl(creep)).toBeNull()
    expect(getPreviewUrl(inception)).toBeNull()
  })
})

describe('findPreview', () => {
  it("searches by TMDB's title, year and composers, and saves what it finds", async () => {
    const { findPreview, searchSoundtrack, fetchTmdb } = await load()

    searchSoundtrack.mockResolvedValue(deezer)

    await expect(findPreview(inception)).resolves.toEqual(deezer)
    await expect(findPreview(inception)).resolves.toEqual(deezer)

    expect(fetchTmdb).toHaveBeenCalledWith('movie/27205', {
      append_to_response: 'credits',
    })
    expect(searchSoundtrack).toHaveBeenCalledTimes(1)
    expect(searchSoundtrack).toHaveBeenCalledWith({
      kind: 'movie',
      titles: ['Inception'],
      year: 2010,
      composers: ['Hans Zimmer'],
    })

    await waitForSave()

    expect(readFile()).toEqual({
      version: 1,
      previews: { 'movie:27205': { preview: deezer, checkedAt: NOW } },
    })

    const restarted = await load()

    await expect(restarted.findPreview(inception)).resolves.toEqual(deezer)
    expect(restarted.searchSoundtrack).not.toHaveBeenCalled()
  })

  it('searches for a show by who scored the most of its episodes', async () => {
    const { findPreview, searchSoundtrack, fetchTmdb } = await load()

    searchSoundtrack.mockResolvedValue(itunes)

    await expect(findPreview(severance)).resolves.toEqual(itunes)
    expect(fetchTmdb).toHaveBeenCalledWith('tv/95396', {
      append_to_response: 'aggregate_credits',
    })
    expect(searchSoundtrack).toHaveBeenCalledWith({
      kind: 'show',
      titles: ['Severance'],
      year: 2022,
      composers: ['Theodore Shapiro', 'Guest Composer'],
    })
  })

  it('searches for a song by its artist and title, saved however they are written', async () => {
    const { findPreview, searchSong, fetchTmdb } = await load()

    searchSong.mockResolvedValue(deezer)

    await expect(findPreview(creep)).resolves.toEqual(deezer)
    await expect(
      findPreview({ kind: 'song', artist: 'RADIOHEAD', title: 'creep' }),
    ).resolves.toEqual(deezer)

    expect(searchSong).toHaveBeenCalledTimes(1)
    expect(searchSong).toHaveBeenCalledWith(creep)
    expect(fetchTmdb).not.toHaveBeenCalled()

    await waitForSave()

    expect(Object.keys(readFile().previews)).toEqual(['song:radiohead|creep'])
  })

  it('searches once for an item asked for twice at a time', async () => {
    const { findPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockResolvedValue(itunes)

    await expect(
      Promise.all([findPreview(inception), findPreview(inception)]),
    ).resolves.toEqual([itunes, itunes])
    expect(searchSoundtrack).toHaveBeenCalledTimes(1)
  })

  it('remembers an item without a preview for a week', async () => {
    writeFile({ 'movie:27205': { preview: null, checkedAt: NOW - 6 * DAY } })

    const { findPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockResolvedValue(itunes)

    await expect(findPreview(inception)).resolves.toBeNull()
    expect(searchSoundtrack).not.toHaveBeenCalled()

    vi.setSystemTime(NOW + 2 * DAY)

    await expect(findPreview(inception)).resolves.toEqual(itunes)
  })

  it('searches again for a preview found a month ago', async () => {
    writeFile({ 'movie:27205': { preview: itunes, checkedAt: NOW - 31 * DAY } })

    const { findPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockResolvedValue(deezer)

    await expect(findPreview(inception)).resolves.toEqual(deezer)
  })

  it("keeps what was saved when the search couldn't be made, and saves nothing", async () => {
    writeFile({ 'movie:27205': { preview: itunes, checkedAt: NOW - 31 * DAY } })

    const { findPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockRejectedValue(new Error('offline'))

    await expect(findPreview(inception)).resolves.toEqual(itunes)
    await expect(findPreview(severance)).resolves.toBeNull()

    await vi.advanceTimersByTimeAsync(1000)

    expect(Object.keys(readFile().previews)).toEqual(['movie:27205'])
    expect(readFile().previews['movie:27205'].checkedAt).toBe(NOW - 31 * DAY)
  })

  it("doesn't search for a title TMDB can't tell about", async () => {
    const { findPreview, searchSoundtrack, fetchTmdb } = await load()

    fetchTmdb.mockResolvedValue(null)

    await expect(findPreview(inception)).resolves.toBeNull()
    expect(searchSoundtrack).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)

    expect(fs.existsSync(filePath())).toBe(false)
  })

  it("starts over from a saved file that isn't one", async () => {
    fs.writeFileSync(filePath(), 'null')

    const { findPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockResolvedValue(itunes)

    await expect(findPreview(inception)).resolves.toEqual(itunes)
  })

  it("leaves out saved previews that aren't valid", async () => {
    writeFile({
      'movie:1': { preview: itunes, checkedAt: NOW },
      'movie:2': {
        preview: { source: 'itunes', url: 'https://elsewhere.example/a' },
        checkedAt: NOW,
      },
      'movie:3': { preview: { source: 'deezer', id: 'x' }, checkedAt: NOW },
      'game:4': { preview: null, checkedAt: NOW },
    })

    const { findPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockResolvedValue(null)

    await expect(findPreview({ kind: 'movie', tmdbId: 1 })).resolves.toEqual(
      itunes,
    )
    await expect(findPreview({ kind: 'movie', tmdbId: 2 })).resolves.toBeNull()
    await expect(findPreview({ kind: 'movie', tmdbId: 3 })).resolves.toBeNull()
    expect(searchSoundtrack).toHaveBeenCalledTimes(2)

    // The file is there already, so the save is told by what's in it
    await vi.advanceTimersByTimeAsync(1000)
    await vi.waitFor(() =>
      expect(Object.keys(readFile().previews)).toEqual([
        'movie:1',
        'movie:2',
        'movie:3',
      ]),
    )
  })
})

describe('streamPreview', () => {
  it('passes the preview on, with the part the browser asked for', async () => {
    writeFile({ 'movie:27205': { preview: itunes, checkedAt: NOW } })
    fetchMock.mockResolvedValue(
      new Response('audio', {
        status: 206,
        headers: {
          'Content-Type': 'audio/x-m4a',
          'Content-Range': 'bytes 0-4/5',
          'Set-Cookie': 'a=b',
        },
      }),
    )

    const { streamPreview } = await load()
    const response = await streamPreview(inception, request('bytes=0-'))

    expect(fetchMock).toHaveBeenCalledWith(
      ITUNES_PREVIEW,
      expect.objectContaining({
        headers: { Range: 'bytes=0-' },
        redirect: 'manual',
      }),
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Type')).toBe('audio/mp4')
    expect(response.headers.get('Content-Range')).toBe('bytes 0-4/5')
    expect(response.headers.get('Content-Security-Policy')).toBe('sandbox')
    expect(response.headers.get('Set-Cookie')).toBeNull()
    await expect(response.text()).resolves.toBe('audio')
  })

  it("asks Deezer for a track's link again once it stops working", async () => {
    const link = (expiry: number) =>
      `https://cdnt-preview.dzcdn.net/a.mp3?hdnea=exp=${expiry / 1000}~acl=/a`

    writeFile({ 'movie:27205': { preview: deezer, checkedAt: NOW } })
    fetchMock.mockImplementation(async () => new Response('audio'))

    const { streamPreview, fetchDeezerPreview } = await load()

    fetchDeezerPreview.mockResolvedValue(link(NOW + 15 * 60 * 1000))

    await streamPreview(inception, request())
    vi.setSystemTime(NOW + 13 * 60 * 1000)
    await streamPreview(inception, request())

    expect(fetchDeezerPreview).toHaveBeenCalledTimes(1)
    expect(fetchDeezerPreview).toHaveBeenCalledWith(11)

    vi.setSystemTime(NOW + 14.5 * 60 * 1000)

    const response = await streamPreview(inception, request())

    expect(fetchDeezerPreview).toHaveBeenCalledTimes(2)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
  })

  it('asks Deezer once for the link of a preview asked for in parts', async () => {
    writeFile({ 'movie:27205': { preview: deezer, checkedAt: NOW } })
    fetchMock.mockImplementation(async () => new Response('audio'))

    const { streamPreview, fetchDeezerPreview } = await load()

    fetchDeezerPreview.mockResolvedValue('https://cdnt-preview.dzcdn.net/a.mp3')

    const responses = await Promise.all([
      streamPreview(inception, request('bytes=0-1')),
      streamPreview(inception, request('bytes=2-3')),
    ])

    expect(responses.map(({ status }) => status)).toEqual([200, 200])
    expect(fetchDeezerPreview).toHaveBeenCalledTimes(1)
  })

  it('searches again for a preview that was taken down', async () => {
    writeFile({ 'movie:27205': { preview: itunes, checkedAt: NOW } })
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    const { streamPreview, searchSoundtrack } = await load()

    searchSoundtrack.mockResolvedValue(null)

    expect((await streamPreview(inception, request())).status).toBe(404)
    expect(searchSoundtrack).not.toHaveBeenCalled()

    await streamPreview(inception, request())

    expect(searchSoundtrack).toHaveBeenCalledTimes(1)
  })

  it('searches again for an item whose track Deezer no longer has', async () => {
    writeFile({ 'song:radiohead|creep': { preview: deezer, checkedAt: NOW } })

    const { streamPreview, fetchDeezerPreview, searchSong } = await load()

    fetchDeezerPreview.mockResolvedValue(null)
    searchSong.mockResolvedValue(null)

    expect((await streamPreview(creep, request())).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()

    await streamPreview(creep, request())

    expect(searchSong).toHaveBeenCalledTimes(1)
  })

  it("keeps the track when Deezer couldn't be asked for its link", async () => {
    writeFile({ 'movie:27205': { preview: deezer, checkedAt: NOW } })

    const { streamPreview, fetchDeezerPreview, searchSoundtrack } = await load()

    fetchDeezerPreview.mockRejectedValue(new Error('offline'))

    expect((await streamPreview(inception, request())).status).toBe(404)
    expect((await streamPreview(inception, request())).status).toBe(404)
    expect(fetchDeezerPreview).toHaveBeenCalledTimes(2)
    expect(searchSoundtrack).not.toHaveBeenCalled()
  })

  it('stops waiting for a search once the browser has gone', async () => {
    const { streamPreview, searchSoundtrack } = await load()
    const browser = new AbortController()

    searchSoundtrack.mockReturnValue(new Promise(() => {}))

    const response = streamPreview(
      inception,
      new Request('http://rewindarr/api/rewind/preview', {
        signal: browser.signal,
      }),
    )

    await vi.advanceTimersByTimeAsync(1000)
    browser.abort()

    expect((await response).status).toBe(404)
  })

  it('answers 404 without a preview, or when it is gone', async () => {
    writeFile({
      'movie:27205': { preview: null, checkedAt: NOW },
      'show:95396': { preview: itunes, checkedAt: NOW },
    })
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))

    const { streamPreview } = await load()

    expect((await streamPreview(inception, request())).status).toBe(404)
    expect((await streamPreview(severance, request())).status).toBe(404)
  })

  it("doesn't keep the browser waiting for a slow search, which goes on", async () => {
    const { streamPreview, findPreview, searchSoundtrack } = await load()

    let finish: (preview: typeof itunes) => void = () => {}

    searchSoundtrack.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )

    const response = streamPreview(inception, request())

    await vi.advanceTimersByTimeAsync(29_000)
    await expect(
      Promise.race([response, Promise.resolve('waiting')]),
    ).resolves.toBe('waiting')

    await vi.advanceTimersByTimeAsync(1000)

    expect((await response).status).toBe(404)

    finish(itunes)

    await expect(findPreview(inception)).resolves.toEqual(itunes)
    expect(searchSoundtrack).toHaveBeenCalledTimes(1)
  })

  it('sweeps expired Deezer link entries on subsequent lookups', async () => {
    const link = (expiry: number) =>
      `https://cdnt-preview.dzcdn.net/a.mp3?hdnea=exp=${expiry / 1000}~acl=/a`
    const matrix = { kind: 'movie', tmdbId: 603 } as const

    writeFile({
      'movie:27205': { preview: deezer, checkedAt: NOW },
      'movie:603': { preview: { source: 'deezer', id: 12 }, checkedAt: NOW },
    })
    fetchMock.mockImplementation(async () => new Response('audio'))

    const { streamPreview, fetchDeezerPreview } = await load()

    fetchDeezerPreview.mockResolvedValue(link(NOW + 15 * 60 * 1000))

    const stateLinks = () =>
      (
        globalThis as {
          rewindarrMusicPreviews?: { links: Map<number, unknown> }
        }
      ).rewindarrMusicPreviews?.links

    await streamPreview(inception, request())
    expect(stateLinks()?.has(11)).toBe(true)

    // After track 11 expires, looking up track 12 sweeps track 11 from state.links
    vi.setSystemTime(NOW + 15 * 60 * 1000)
    await streamPreview(matrix, request())

    expect(stateLinks()?.has(11)).toBe(false)
    expect(stateLinks()?.has(12)).toBe(true)
  })

  it('evicts failed Deezer link lookups and caps state.links at 500 entries', async () => {
    writeFile({ 'movie:27205': { preview: deezer, checkedAt: NOW } })

    const { streamPreview, fetchDeezerPreview } = await load()
    const stateLinks = () =>
      (
        globalThis as {
          rewindarrMusicPreviews?: { links: Map<number, unknown> }
        }
      ).rewindarrMusicPreviews?.links

    fetchDeezerPreview.mockRejectedValueOnce(new Error('offline'))
    await streamPreview(inception, request())
    expect(stateLinks()?.has(11)).toBe(false)

    // Pre-populate 500 future entries in state.links, then stream a 501st track
    for (let id = 1000; id < 1500; id++) {
      stateLinks()?.set(id, {
        promise: Promise.resolve({
          url: `https://cdnt-preview.dzcdn.net/${id}.mp3`,
          expiresAt: NOW + 15 * 60 * 1000,
        }),
        expiresAt: NOW + 15 * 60 * 1000,
      })
    }

    fetchMock.mockImplementation(async () => new Response('audio'))
    fetchDeezerPreview.mockResolvedValue(
      `https://cdnt-preview.dzcdn.net/11.mp3?hdnea=exp=${(NOW + 15 * 60 * 1000) / 1000}~acl=/a`,
    )
    await streamPreview(inception, request())

    expect(stateLinks()?.size).toBe(500)
    expect(stateLinks()?.has(1000)).toBe(false)
    expect(stateLinks()?.has(11)).toBe(true)
  })
})
