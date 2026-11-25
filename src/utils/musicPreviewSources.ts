import { orderBy } from 'lodash'
import qs from 'qs'
import { isGatewayError, isHostDown, markHostDown } from './hostBackoff'
import {
  getSongName,
  isAlbumCandidate,
  isSoundtrackAlbum,
  pickSong,
  pickThemeTrack,
  rankAlbum,
  Song,
  SoundtrackAlbum,
  SoundtrackTitle,
} from './musicPreviewMatch'

// Where the music the media server can't play comes from: the 30-second
// previews Deezer and iTunes give of every track, found by a search for a
// movie's or show's soundtrack album, or for a song. Neither needs a key.

// Deezer's preview links stop working after minutes, so its track is saved
// and the link asked for again. iTunes' links stay.
export type MusicPreview =
  | { source: 'deezer'; id: number }
  | { source: 'itunes'; url: string }

type Service = {
  name: string
  url: string
  // The least time between two requests, which keeps to the service's limit
  interval: number
}

type DeezerTrack = {
  id: number
  title?: string
  artist?: { name?: string }
  rank?: number
  preview?: string
  readable?: boolean
}

type DeezerAlbum = {
  id: number
  title?: string
  artist?: { name?: string }
  release_date?: string
  tracks?: { data?: DeezerTrack[] }
}

type DeezerArtist = {
  name?: string
  picture_medium?: string
}

type DeezerError = {
  error?: { code?: number; message?: string }
}

type ItunesResult = {
  wrapperType?: string
  collectionId?: number
  collectionName?: string
  artistName?: string
  releaseDate?: string
  trackName?: string
  trackNumber?: number
  discNumber?: number
  previewUrl?: string
}

type ItunesAnswer = {
  results?: ItunesResult[]
}

// A service that couldn't be asked, which says nothing about the music
export class MusicPreviewError extends Error {}

// 50 requests in 5 seconds
const DEEZER: Service = {
  name: 'Deezer',
  url: 'https://api.deezer.com',
  interval: 120,
}
// About 20 requests a minute
const ITUNES: Service = {
  name: 'iTunes',
  url: 'https://itunes.apple.com',
  interval: 3000,
}
const REQUEST_TIMEOUT_MS = 10_000
const ALBUM_SEARCH_LIMIT = 25
const SONG_SEARCH_LIMIT = 10
// The albums of a search whose tracks are looked up
const MAX_ALBUMS = 2
// The composers a search is made for
const MAX_COMPOSERS = 2
// Deezer's answer for an ID it doesn't have
const DEEZER_NO_DATA = 800
// Where the previews are served from. The link comes from the service's
// answer, and the server fetches it, so nowhere else is.
const PREVIEW_HOSTS = ['dzcdn.net', 'itunes.apple.com', 'mzstatic.com']
// Next.js can bundle this file into more than one chunk, and each copy would
// otherwise keep to the limits on its own.
const globalForSources = globalThis as unknown as {
  rewindarrMusicPreviewTurns?: Map<string, number>
}
const turns = (globalForSources.rewindarrMusicPreviewTurns ??= new Map())

export function isPreviewUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !URL.canParse(url)) {
    return false
  }

  const { protocol, hostname } = new URL(url)

  return (
    protocol === 'https:' &&
    PREVIEW_HOSTS.some((host) => hostname.endsWith(`.${host}`))
  )
}

// Requests to a service go one after the other, its interval apart
async function waitTurn(service: Service): Promise<void> {
  const now = Date.now()
  const at = Math.max(now, turns.get(service.url) ?? 0)

  turns.set(service.url, at + service.interval)

  if (at > now) {
    await new Promise((resolve) => setTimeout(resolve, at - now))
  }
}

async function fetchService<T>(service: Service, path: string): Promise<T> {
  if (isHostDown(service.url)) {
    throw new MusicPreviewError(`${service.name} can't be reached`)
  }

  await waitTurn(service)

  if (isHostDown(service.url)) {
    throw new MusicPreviewError(`${service.name} can't be reached`)
  }

  let res: Response

  try {
    res = await fetch(`${service.url}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    markHostDown(service.url)

    throw new MusicPreviewError(`${service.name} didn't answer`, {
      cause: error,
    })
  }

  if (!res.ok) {
    await res.body?.cancel()

    if (isGatewayError(res.status)) {
      markHostDown(service.url)
    }

    throw new MusicPreviewError(`${service.name} answered ${res.status}`)
  }

  try {
    return (await res.json()) as T
  } catch (error) {
    throw new MusicPreviewError(`${service.name}'s answer isn't JSON`, {
      cause: error,
    })
  }
}

// Deezer answers its errors, like too many requests, with a successful
// status. Null for an ID it doesn't have.
async function fetchDeezer<T>(path: string): Promise<T | null> {
  const answer = await fetchService<T & DeezerError>(DEEZER, path)

  if (answer.error) {
    if (answer.error.code === DEEZER_NO_DATA) {
      return null
    }

    throw new MusicPreviewError(`Deezer answered '${answer.error.message}'`)
  }

  return answer
}

function isPlayable(track: DeezerTrack): boolean {
  return isPreviewUrl(track.preview) && track.readable !== false
}

function toYear(date: string | undefined): number | null {
  return Number(date?.slice(0, 4)) || null
}

function toDeezerAlbum(album: DeezerAlbum): SoundtrackAlbum {
  return {
    title: album.title ?? '',
    artist: album.artist?.name ?? '',
    year: toYear(album.release_date),
  }
}

function toItunesAlbum(album: ItunesResult): SoundtrackAlbum {
  return {
    title: album.collectionName ?? '',
    artist: album.artistName ?? '',
    year: toYear(album.releaseDate),
  }
}

// The likeliest albums first, otherwise in the service's order
function orderAlbums<T>(
  title: SoundtrackTitle,
  albums: T[],
  toAlbum: (album: T) => SoundtrackAlbum,
): T[] {
  return orderBy(
    albums,
    (album) => rankAlbum(title, toAlbum(album)),
    'desc',
  ).slice(0, MAX_ALBUMS)
}

// The title without the recording, which narrows the search to its wording
function getSongQuery(song: Song): string {
  return `${song.artist} ${getSongName(song.title)}`
}

// The composer's album of the title first, then a search for its soundtrack,
// also under its original title
function getDeezerQueries({ titles, composers }: SoundtrackTitle): string[] {
  const quote = (text: string) => `"${text.replaceAll('"', '')}"`

  return [
    ...composers
      .slice(0, MAX_COMPOSERS)
      .map((composer) => `album:${quote(titles[0])} artist:${quote(composer)}`),
    ...titles.map((title) => `${title} soundtrack`),
  ]
}

async function findSoundtrackOnDeezer(
  title: SoundtrackTitle,
): Promise<MusicPreview | null> {
  const tried = new Set<number>()

  for (const query of getDeezerQueries(title)) {
    const search = await fetchDeezer<{ data?: DeezerAlbum[] }>(
      `/search/album?${qs.stringify({ q: query, limit: ALBUM_SEARCH_LIMIT })}`,
    )
    // The year isn't in the search, so it's checked with the tracks
    const candidates = orderAlbums(
      title,
      (search?.data ?? []).filter(
        (album) =>
          !tried.has(album.id) && isAlbumCandidate(title, toDeezerAlbum(album)),
      ),
      toDeezerAlbum,
    )

    for (const candidate of candidates) {
      tried.add(candidate.id)

      const album = await fetchDeezer<DeezerAlbum>(`/album/${candidate.id}`)

      if (!album || !isSoundtrackAlbum(title, toDeezerAlbum(album))) {
        continue
      }

      const track = pickThemeTrack(
        title,
        (album.tracks?.data ?? []).filter(isPlayable).map((track, i) => ({
          id: track.id,
          title: track.title ?? '',
          position: i + 1,
          rank: track.rank,
        })),
      )

      if (track) {
        return { source: 'deezer', id: track.id }
      }
    }
  }

  return null
}

function getItunesTerms({ titles, composers }: SoundtrackTitle): string[] {
  return [
    ...composers.slice(0, 1).map((composer) => `${titles[0]} ${composer}`),
    `${titles[0]} soundtrack`,
  ]
}

async function findSoundtrackOnItunes(
  title: SoundtrackTitle,
): Promise<MusicPreview | null> {
  const tried = new Set<number>()

  for (const term of getItunesTerms(title)) {
    const search = await fetchService<ItunesAnswer>(
      ITUNES,
      `/search?${qs.stringify({
        term,
        media: 'music',
        entity: 'album',
        limit: ALBUM_SEARCH_LIMIT,
      })}`,
    )
    const albums = orderAlbums(
      title,
      (search.results ?? []).filter(
        (album) =>
          !!album.collectionId &&
          !tried.has(album.collectionId) &&
          isSoundtrackAlbum(title, toItunesAlbum(album)),
      ),
      toItunesAlbum,
    )

    for (const album of albums) {
      tried.add(album.collectionId as number)

      const lookup = await fetchService<ItunesAnswer>(
        ITUNES,
        `/lookup?${qs.stringify({
          id: album.collectionId,
          entity: 'song',
          limit: 200,
        })}`,
      )
      const track = pickThemeTrack(
        title,
        (lookup.results ?? [])
          .filter((result) => result.wrapperType === 'track')
          .map((track) => ({
            title: track.trackName ?? '',
            // A second disc's tracks come after the first's
            position:
              ((track.discNumber ?? 1) - 1) * 1000 + (track.trackNumber ?? 0),
            url: track.previewUrl,
          }))
          .filter((track) => isPreviewUrl(track.url)),
      )

      if (track?.url) {
        return { source: 'itunes', url: track.url }
      }
    }
  }

  return null
}

async function findSongOnDeezer(song: Song): Promise<MusicPreview | null> {
  const search = await fetchDeezer<{ data?: DeezerTrack[] }>(
    `/search/track?${qs.stringify({
      q: getSongQuery(song),
      limit: SONG_SEARCH_LIMIT,
    })}`,
  )
  const track = pickSong(
    song,
    (search?.data ?? []).filter(isPlayable).map((track) => ({
      id: track.id,
      title: track.title ?? '',
      artist: track.artist?.name ?? '',
    })),
  )

  return track && { source: 'deezer', id: track.id }
}

async function findSongOnItunes(song: Song): Promise<MusicPreview | null> {
  const search = await fetchService<ItunesAnswer>(
    ITUNES,
    `/search?${qs.stringify({
      term: getSongQuery(song),
      media: 'music',
      entity: 'song',
      limit: SONG_SEARCH_LIMIT,
    })}`,
  )
  const track = pickSong(
    song,
    (search.results ?? [])
      .map((track) => ({
        title: track.trackName ?? '',
        artist: track.artistName ?? '',
        url: track.previewUrl,
      }))
      .filter((track) => isPreviewUrl(track.url)),
  )

  return track?.url ? { source: 'itunes', url: track.url } : null
}

// Each service in turn. Null when none has it, and an error when none had it
// and one of them couldn't be asked.
async function findFirst(
  finders: (() => Promise<MusicPreview | null>)[],
): Promise<MusicPreview | null> {
  let failure: unknown = null

  for (const find of finders) {
    try {
      const preview = await find()

      if (preview) {
        return preview
      }
    } catch (error) {
      failure = error
    }
  }

  if (failure) {
    throw failure
  }

  return null
}

// A track of the movie's or show's soundtrack. Deezer first, as it knows
// which track of the album is played the most.
export function searchSoundtrack(
  title: SoundtrackTitle,
): Promise<MusicPreview | null> {
  return findFirst([
    () => findSoundtrackOnDeezer(title),
    () => findSoundtrackOnItunes(title),
  ])
}

export function searchSong(song: Song): Promise<MusicPreview | null> {
  return findFirst([() => findSongOnDeezer(song), () => findSongOnItunes(song)])
}

// A link to the track's preview that works for the next minutes. Null when
// Deezer no longer has the track.
export async function fetchDeezerPreview(id: number): Promise<string | null> {
  const track = await fetchDeezer<DeezerTrack>(`/track/${id}`)

  return isPreviewUrl(track?.preview) ? track.preview : null
}

// The artist's picture, which anyone can load, for emails that can't load the
// media server's. Only for the same name, as a close one is someone else.
export async function searchArtistPicture(
  name: string,
): Promise<string | null> {
  const answer = await fetchDeezer<{ data?: DeezerArtist[] }>(
    `/search/artist?${new URLSearchParams({ q: name, limit: '5' })}`,
  )
  const artist = answer?.data?.find(
    (result) => result.name?.toLocaleLowerCase() === name.toLocaleLowerCase(),
  )
  const picture = artist?.picture_medium

  // Deezer's stand-in for an artist without a picture leaves its ID out
  return isPreviewUrl(picture) && !picture.includes('/artist//')
    ? picture
    : null
}
