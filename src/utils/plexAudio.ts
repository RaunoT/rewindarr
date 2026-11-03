import { Settings } from '@/types/settings'
import { createHmac, timingSafeEqual } from 'crypto'
import { REWIND_MUSIC_TYPES } from './constants'
import {
  isGatewayError,
  isHostDown,
  markHostDown,
  markHostUp,
} from './hostBackoff'

// An item's theme song, or a song itself
export type PlexAudioKind = 'theme' | 'track'

type AudioPath = {
  path: string | null
  expiresAt: number
}

export const PLEX_THEME_URL = '/api/rewind/theme'
export const PLEX_TRACK_URL = '/api/rewind/track'

// Only how long Plex has to start answering; the song itself can take longer
const PLEX_TIMEOUT_MS = 10 * 1000
const AUDIO_PATH_TTL_MS = 60 * 60 * 1000
// Where Plex serves an item's theme song and a song's file. Plex fetches any
// other path with the server's token, so nothing else is requested.
const THEME_PATH = /^\/library\/metadata\/\d+\/theme\/\d+$/
const TRACK_PATH = /^\/library\/parts\/\d+\/\d+\/file\.([a-z0-9]+)$/i
const PASSED_STATUSES = [200, 206, 416]
const PASSED_HEADERS = ['Content-Length', 'Content-Range', 'Accept-Ranges']
// Browsers ask for parts of the song, each of which would look the item up
const audioPaths = new Map<string, AudioPath>()

// Plex only serves the library with a token. Jellyfin's items aren't Plex's.
function canStreamFromPlex({ connection }: Settings): boolean {
  return (
    connection.mediaServerType === 'plex' &&
    !!connection.plexUrl &&
    !!connection.plexToken
  )
}

export function getPlexThemeUrl(
  settings: Settings,
  ratingKey: string | number | null | undefined,
): string | null {
  return canStreamFromPlex(settings) && ratingKey
    ? `${PLEX_THEME_URL}?key=${ratingKey}`
    : null
}

function signTrack(ratingKey: string): Buffer {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(`track:${ratingKey}`)
    .digest()
}

// Signed, so viewers can only play the songs their Rewind picked, not any in
// the library, which their Plex share might leave out
export function getPlexTrackUrl(
  settings: Settings,
  ratingKey: string | null | undefined,
): string | null {
  if (
    !canStreamFromPlex(settings) ||
    !ratingKey ||
    !process.env.NEXTAUTH_SECRET
  ) {
    return null
  }

  const signature = signTrack(ratingKey).toString('base64url')

  return `${PLEX_TRACK_URL}?key=${ratingKey}&sig=${signature}`
}

export function isSignedTrack(ratingKey: string, signature: string): boolean {
  if (!process.env.NEXTAUTH_SECRET) {
    return false
  }

  const expected = signTrack(ratingKey)
  const given = Buffer.from(signature, 'base64url')

  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function isThemePath(path: unknown): path is string {
  return typeof path === 'string' && THEME_PATH.test(path)
}

export function isTrackPath(path: unknown): path is string {
  return typeof path === 'string' && TRACK_PATH.test(path)
}

// A redirect isn't followed, as the token would go with it
async function fetchPlex(
  settings: Settings,
  path: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response | null> {
  const { plexUrl, plexToken } = settings.connection

  if (!plexToken || isHostDown(plexUrl)) {
    return null
  }

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), PLEX_TIMEOUT_MS)

  try {
    const response = await fetch(`${plexUrl}${path}`, {
      headers: { ...headers, 'X-Plex-Token': plexToken },
      redirect: 'manual',
      cache: 'no-store',
      signal: signal
        ? AbortSignal.any([signal, timeout.signal])
        : timeout.signal,
    })

    if (isGatewayError(response.status)) {
      markHostDown(plexUrl)
    } else {
      markHostUp(plexUrl)
    }

    return response
  } catch (error) {
    // A visitor moving on isn't Plex being down
    if (!signal?.aborted) {
      markHostDown(plexUrl)
      console.error(`[PLEX] - Couldn't get ${path}!`, error)
    }

    return null
  } finally {
    clearTimeout(timer)
  }
}

// Only a song has a file to play, so a movie's or an episode's isn't served
function findAudioPath(
  kind: PlexAudioKind,
  item: Record<string, unknown> | undefined,
): string | null {
  if (kind === 'theme') {
    const theme = item?.theme

    return isThemePath(theme) ? theme : null
  }

  const media = item?.Media as { Part?: { key?: unknown }[] }[] | undefined
  const part = item?.type === 'track' ? media?.[0]?.Part?.[0]?.key : null

  return isTrackPath(part) ? part : null
}

async function getAudioPath(
  settings: Settings,
  kind: PlexAudioKind,
  ratingKey: string,
): Promise<string | null> {
  const cacheKey = `${settings.connection.plexUrl}|${kind}|${ratingKey}`
  const cached = audioPaths.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.path
  }

  const response = await fetchPlex(settings, `/library/metadata/${ratingKey}`, {
    Accept: 'application/json',
  })

  if (!response?.ok) {
    await response?.body?.cancel()

    return null
  }

  const data = await response.json().catch(() => null)
  const path = findAudioPath(kind, data?.MediaContainer?.Metadata?.[0])

  audioPaths.set(cacheKey, { path, expiresAt: Date.now() + AUDIO_PATH_TTL_MS })

  return path
}

// A song is served as its file's type. Plex calls a theme's MP3 audio/mpeg3,
// which isn't a type every browser knows. Null for a file browsers can't play.
function getAudioType(path: string, response: Response): string | null {
  const extension = path.match(TRACK_PATH)?.[1].toLowerCase()

  if (extension) {
    return Object.hasOwn(REWIND_MUSIC_TYPES, extension)
      ? REWIND_MUSIC_TYPES[extension]
      : null
  }

  const type = response.headers.get('content-type') ?? ''

  return type.startsWith('audio/') && type !== 'audio/mpeg3'
    ? type
    : 'audio/mpeg'
}

// The item's audio as Plex serves it, passed on with the parts of the song
// the browser asked for. A 404 without one.
export async function streamPlexAudio(
  settings: Settings,
  kind: PlexAudioKind,
  ratingKey: string,
  request: Request,
): Promise<Response> {
  const path = await getAudioPath(settings, kind, ratingKey)
  const range = request.headers.get('range')
  const audio = path
    ? await fetchPlex(
        settings,
        path,
        range ? { Range: range } : {},
        request.signal,
      )
    : null
  const type = path && audio ? getAudioType(path, audio) : null

  if (!audio || !type || !PASSED_STATUSES.includes(audio.status)) {
    await audio?.body?.cancel()

    return new Response(null, { status: 404 })
  }

  const headers = new Headers({
    'Content-Type': type,
    'Cache-Control': 'private, max-age=86400',
    'Content-Security-Policy': 'sandbox',
  })

  for (const name of PASSED_HEADERS) {
    const value = audio.headers.get(name)

    if (value) {
      headers.set(name, value)
    }
  }

  return new Response(audio.body, { status: audio.status, headers })
}
